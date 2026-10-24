import { and, desc, eq, inArray } from 'drizzle-orm';
import type { CloudflareEnv } from '../../../env.d';
import { createDrizzleClient, schema } from '../../db';
import { ConflictError, NotFoundError } from '../../errors';

type Insert = typeof schema.cmsDeletionAttempts.$inferInsert;

/** 删除操作保留审计与结果；只允许一次认领，避免超时后重复删除新版本。 */
export function deletionRepository(env: CloudflareEnv) {
  const db = createDrizzleClient(env);
  const attempts = schema.cmsDeletionAttempts;
  return {
    async listPending() {
      return db.query.cmsDeletionAttempts.findMany({
        where: inArray(attempts.status, ['prepared', 'in_flight', 'unknown']),
        orderBy: [desc(attempts.updatedAt)],
      });
    },
    async get(operationId: string) {
      const row = await db.query.cmsDeletionAttempts.findFirst({
        where: eq(attempts.operationId, operationId),
      });
      if (!row) throw new NotFoundError('删除操作不存在');
      return row;
    },
    async pendingForPath(path: string) {
      return db.query.cmsDeletionAttempts.findFirst({
        where: and(
          eq(attempts.targetPath, path),
          inArray(attempts.status, ['prepared', 'in_flight', 'unknown']),
        ),
      });
    },
    async create(input: Insert) {
      try {
        const [row] = await db.insert(attempts).values(input).returning();
        return row;
      } catch (error) {
        // 操作 ID 冲突返回原行；同路径的另一项未结束操作由部分唯一索引阻止。
        const existing = await db.query.cmsDeletionAttempts.findFirst({
          where: eq(attempts.operationId, input.operationId),
        });
        if (existing) return existing;
        if (await this.pendingForPath(input.targetPath))
          throw new ConflictError('这篇文章已有待完成的删除操作');
        throw error;
      }
    },
    async claim(operationId: string) {
      // 条件更新保证只有一个请求真正发起 Git DELETE。
      const [row] = await db
        .update(attempts)
        .set({ status: 'in_flight', updatedAt: Date.now() })
        .where(and(eq(attempts.operationId, operationId), eq(attempts.status, 'prepared')))
        .returning({ operationId: attempts.operationId });
      return Boolean(row);
    },
    async finish(
      operationId: string,
      status: 'committed' | 'conflict' | 'failed' | 'unknown',
      commitSha?: string,
    ) {
      // 未知结果可在可信对账后变成确定结果；已结束的操作不能被迟到回执覆盖。
      const [row] = await db
        .update(attempts)
        .set({
          status,
          ...(commitSha ? { resultCommitSha: commitSha } : {}),
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
      return row ?? this.get(operationId);
    },
  };
}
