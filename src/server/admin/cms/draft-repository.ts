import { and, desc, eq, or, sql } from 'drizzle-orm';
import type { CloudflareEnv } from '../../../env.d';
import { createDrizzleClient, schema } from '../../db';
import { ConflictError, NotFoundError } from '../../errors';

type DraftInsert = typeof schema.cmsDrafts.$inferInsert;

/** D1 只负责版本条件写入和唯一性；业务校验放在文档模块。 */
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
        const [draft] = await db.insert(schema.cmsDrafts).values(input).returning();
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
      // WHERE 同时约束活动状态和客户端修订号，两个窗口不能互相覆盖源文。
      const [draft] = await db
        .update(schema.cmsDrafts)
        .set({ ...input, revision: expectedRevision + 1, updatedAt: Date.now() })
        .where(
          and(
            eq(schema.cmsDrafts.id, id),
            eq(schema.cmsDrafts.status, 'active'),
            eq(schema.cmsDrafts.revision, expectedRevision),
          ),
        )
        .returning();
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
