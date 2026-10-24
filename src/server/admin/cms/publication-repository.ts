import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { CloudflareEnv } from '../../../env.d';
import { createDrizzleClient, schema } from '../../db';
import type { CmsPublicationAttempt } from '../../db/schema/cms';
import { ConflictError, NotFoundError } from '../../errors';
import type { DeploymentEvidence } from './deployment-verifier';

type AttemptInsert = typeof schema.cmsPublicationAttempts.$inferInsert;

/** D1 状态转换集中在此，所有 Git 写入都先由 prepared 条件认领。 */
export function publicationRepository(env: CloudflareEnv) {
  const db = createDrizzleClient(env);
  const attempts = schema.cmsPublicationAttempts;
  const drafts = schema.cmsDrafts;
  return {
    async pendingForDraft(draftId: string) {
      const attempt = await db.query.cmsPublicationAttempts.findFirst({
        where: and(
          eq(attempts.draftId, draftId),
          inArray(attempts.status, ['prepared', 'in_flight', 'unknown']),
        ),
      });
      if (!attempt) return null;
      const { sourceSnapshot, ...summary } = attempt;
      void sourceSnapshot;
      return summary;
    },
    async pendingPublications(): Promise<Omit<CmsPublicationAttempt, 'sourceSnapshot'>[]> {
      const rows = await db.query.cmsPublicationAttempts.findMany({
        where: inArray(attempts.status, ['prepared', 'in_flight', 'unknown']),
        columns: { sourceSnapshot: false },
        orderBy: [desc(attempts.updatedAt)],
      });
      return rows;
    },
    async get(operationId: string): Promise<CmsPublicationAttempt> {
      const attempt = await db.query.cmsPublicationAttempts.findFirst({
        where: eq(attempts.operationId, operationId),
      });
      if (!attempt) throw new NotFoundError('发布操作不存在');
      return attempt;
    },
    async latestCommittedForPath(path: string): Promise<CmsPublicationAttempt | null> {
      const [row] = await db
        .select()
        .from(drafts)
        .innerJoin(attempts, eq(attempts.draftId, drafts.id))
        .where(and(eq(drafts.targetPath, path), eq(attempts.status, 'committed')))
        .orderBy(desc(attempts.createdAt), desc(attempts.operationId))
        .limit(1);
      return row?.cms_publication_attempts ?? null;
    },
    async create(input: AttemptInsert): Promise<CmsPublicationAttempt> {
      try {
        const [attempt] = await db.insert(attempts).values(input).returning();
        return attempt;
      } catch (error) {
        // 同操作 ID 返回原意图；不同 ID 命中活动草稿唯一索引时拒绝并发发布。
        const existing = await db.query.cmsPublicationAttempts.findFirst({
          where: eq(attempts.operationId, input.operationId),
        });
        if (existing) return existing;
        const pending = await db.query.cmsPublicationAttempts.findFirst({
          where: and(
            eq(attempts.draftId, input.draftId),
            inArray(attempts.status, ['prepared', 'in_flight', 'unknown']),
          ),
        });
        if (pending) throw new ConflictError('这篇草稿已有待完成的发布操作');
        throw error;
      }
    },
    async claim(operationId: string): Promise<boolean> {
      // 只有一个请求能将 prepared 改为 in_flight，其余请求转去按固定操作 ID 对账。
      const [claimed] = await db
        .update(attempts)
        .set({ status: 'in_flight', updatedAt: Date.now() })
        .where(and(eq(attempts.operationId, operationId), eq(attempts.status, 'prepared')))
        .returning({ operationId: attempts.operationId });
      return Boolean(claimed);
    },
    async finish(
      operationId: string,
      status: 'committed' | 'conflict' | 'failed' | 'unknown',
      result?: { blobSha: string; commitSha: string },
    ): Promise<CmsPublicationAttempt> {
      // 条件终结允许 unknown 经可信对账转为确定结果；重复回执不覆盖已确定的状态。
      const [updated] = await db
        .update(attempts)
        .set({
          status,
          ...(result ? { resultBlobSha: result.blobSha, resultCommitSha: result.commitSha } : {}),
          ...(status === 'unknown' ? {} : { completedAt: Date.now() }),
          updatedAt: Date.now(),
        })
        .where(
          and(
            eq(attempts.operationId, operationId),
            inArray(attempts.status, ['in_flight', 'unknown']),
          ),
        )
        .returning();
      return updated ?? this.get(operationId);
    },
    async settleDraft(attempt: CmsPublicationAttempt): Promise<void> {
      if (attempt.status !== 'committed' || !attempt.resultBlobSha || !attempt.resultCommitSha)
        return;
      const now = Date.now();
      // 发布期间若又有新修订，只推进 Git 基准并保留活动草稿；否则关闭已发布的那一版。
      await db
        .update(drafts)
        .set({
          baseBlobSha: attempt.resultBlobSha,
          status: sql`CASE WHEN ${drafts.revision} = ${attempt.draftRevision} THEN 'published' ELSE 'active' END`,
          closedAt: sql`CASE WHEN ${drafts.revision} = ${attempt.draftRevision} THEN ${now} ELSE NULL END`,
          publishedCommitSha: sql`CASE WHEN ${drafts.revision} = ${attempt.draftRevision} THEN ${attempt.resultCommitSha} ELSE NULL END`,
          updatedAt: now,
        })
        .where(and(eq(drafts.id, attempt.draftId), eq(drafts.status, 'active')));
    },
    async recordDeployment(operationId: string, evidence: DeploymentEvidence) {
      const [updated] = await db
        .update(attempts)
        .set({
          deploymentStatus: evidence.status,
          deploymentRef: evidence.ref,
          deployedAt: evidence.deployedAt,
          updatedAt: Date.now(),
        })
        .where(and(eq(attempts.operationId, operationId), eq(attempts.status, 'committed')))
        .returning();
      if (!updated) throw new ConflictError('仅已确认提交的发布操作可核验部署');
      return updated;
    },
  };
}
