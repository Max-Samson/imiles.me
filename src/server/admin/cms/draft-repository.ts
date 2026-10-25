import { and, desc, eq, or, sql } from 'drizzle-orm';
import type { CloudflareEnv } from '../../../env.d';
import { createDrizzleClient, schema } from '../../db';
import { generateEntityId } from '../../db/schema/common';
import { ConflictError, NotFoundError } from '../../errors';

type DraftInsert = typeof schema.cmsDrafts.$inferInsert;

/** D1 负责版本条件写入、修订快照与原子性；业务校验放在文档模块。 */
export function draftRepository(env: CloudflareEnv) {
  const db = createDrizzleClient(env);
  return {
    async activeByPath(path: string) {
      return db.query.cmsDrafts.findFirst({
        where: and(eq(schema.cmsDrafts.targetPath, path), eq(schema.cmsDrafts.status, 'active')),
      });
    },
    async create(input: DraftInsert) {
      try {
        const id = input.id ?? generateEntityId('cmd');
        const now = Date.now();
        // D1 batch 是同一事务：草稿与初始修订要么一起成功，要么一起回滚。
        const [[draft]] = await db.batch([
          db
            .insert(schema.cmsDrafts)
            .values({ ...input, id, createdAt: now, updatedAt: now })
            .returning(),
          db.insert(schema.cmsDocumentRevisions).values({
            draftId: id,
            revision: input.revision ?? 1,
            targetPath: input.targetPath,
            source: input.source,
            sourceHash: input.sourceHash,
            sourceBytes: input.sourceBytes,
            titleCache: input.titleCache,
            createdBy: input.createdBy,
            createdAt: now,
          }),
        ]);
        return draft;
      } catch (error) {
        // D1/Drizzle 错误文本不稳定；只在查到实际路径冲突时转换为 409。
        const [collision] = await db
          .select({ id: schema.cmsDrafts.id })
          .from(schema.cmsDrafts)
          .where(
            and(
              eq(schema.cmsDrafts.status, 'active'),
              or(
                eq(schema.cmsDrafts.targetPath, input.targetPath),
                eq(schema.cmsDrafts.publicPath, input.publicPath),
              ),
            ),
          )
          .limit(1);
        if (collision) {
          throw new ConflictError('目标路径或公开地址已有活动草稿');
        }
        throw error;
      }
    },
    async get(id: string) {
      const draft = await db.query.cmsDrafts.findFirst({ where: eq(schema.cmsDrafts.id, id) });
      if (!draft) throw new NotFoundError('草稿不存在');
      return draft;
    },
    async listActive() {
      return db.query.cmsDrafts.findMany({
        where: eq(schema.cmsDrafts.status, 'active'),
        columns: { source: false },
        orderBy: [desc(schema.cmsDrafts.updatedAt), desc(schema.cmsDrafts.id)],
      });
    },
    async save(
      id: string,
      expectedRevision: number,
      input: Pick<
        DraftInsert,
        'source' | 'sourceHash' | 'sourceBytes' | 'titleCache' | 'updatedBy'
      >,
    ) {
      const now = Date.now();
      const drafts = schema.cmsDrafts;
      const matchesVersion = and(
        eq(drafts.id, id),
        eq(drafts.status, 'active'),
        eq(drafts.revision, expectedRevision),
      );
      // 先按旧修订条件追加下一版快照，再更新草稿；两条语句在一个 batch 内原子执行。
      // 旧窗口零命中时两步都不写；快照写入失败时草稿也不会被推进。
      const [, [draft]] = await db.batch([
        db.insert(schema.cmsDocumentRevisions).select(
          db
            .select({
              id: sql<string>`${generateEntityId('cmr')}`.as('id'),
              draftId: drafts.id,
              revision: sql<number>`${expectedRevision + 1}`.as('revision'),
              targetPath: drafts.targetPath,
              source: sql<string>`${input.source}`.as('source'),
              sourceHash: sql<string>`${input.sourceHash}`.as('source_hash'),
              sourceBytes: sql<number>`${input.sourceBytes}`.as('source_bytes'),
              titleCache: sql<string | null>`${input.titleCache ?? null}`.as('title_cache'),
              createdBy: sql<string>`${input.updatedBy}`.as('created_by'),
              createdAt: sql<number>`${now}`.as('created_at'),
            })
            .from(drafts)
            .where(matchesVersion),
        ),
        db
          .update(drafts)
          .set({ ...input, revision: expectedRevision + 1, updatedAt: now })
          .where(matchesVersion)
          .returning(),
      ]);
      if (!draft) throw new ConflictError('草稿已经在其他窗口更新，请比较后再保存');
      return draft;
    },
    async discard(id: string, expectedRevision: number, actorId: string) {
      const now = Date.now();
      // 有待写 Git 或待对账的发布操作时保留草稿，避免丢失该操作的恢复入口。
      const [draft] = await db
        .update(schema.cmsDrafts)
        .set({ status: 'discarded', closedAt: now, updatedAt: now, updatedBy: actorId })
        .where(
          and(
            eq(schema.cmsDrafts.id, id),
            eq(schema.cmsDrafts.status, 'active'),
            eq(schema.cmsDrafts.revision, expectedRevision),
            sql`NOT EXISTS (SELECT 1 FROM cms_publication_attempts WHERE draft_id = ${id} AND status IN ('prepared', 'in_flight', 'unknown'))`,
          ),
        )
        .returning();
      if (!draft) throw new ConflictError('草稿已变化或存在待对账的发布，请刷新后重试');
      return draft;
    },
  };
}
