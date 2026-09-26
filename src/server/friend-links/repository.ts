import { and, desc, eq, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import type { CloudflareEnv } from '../../env.d';
import { createDrizzleClient } from '../db';
import {
  type FriendLinkInsert,
  type FriendLinkStatus,
  friendLinks as t,
} from '../db/schema/friend-links';
import { ConflictError, InternalServerError, NotFoundError } from '../errors';
import type { ReviewAction } from './validation';

// 不将携带 SQL 参数（邮箱、token 指纹）的 Drizzle 异常写入普通日志。
async function databaseCall<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    let current: unknown = error;
    for (let depth = 0; depth < 4 && current instanceof Error; depth++) {
      if (/UNIQUE constraint failed: friend_links.canonical_url/.test(current.message)) {
        throw new ConflictError('该网址已收录，请管理已有记录');
      }
      current = current.cause;
    }
    throw new InternalServerError('友链数据库操作失败');
  }
}
export function friendLinkRepository(env: CloudflareEnv) {
  const db = createDrizzleClient(env);
  return {
    async bySubmissionKey(hash: string) {
      return databaseCall(
        async () =>
          (
            await db
              .select({ id: t.id, payloadHash: t.submissionPayloadHash })
              .from(t)
              .where(eq(t.submissionKeyHash, hash))
              .limit(1)
          )[0],
      );
    },
    async insert(input: FriendLinkInsert) {
      return databaseCall(
        async () =>
          (
            await db
              .insert(t)
              .values(input)
              .onConflictDoNothing({ target: t.submissionKeyHash })
              .returning({ id: t.id })
          )[0],
      );
    },
    async detail(id: string) {
      const row = await databaseCall(
        async () => (await db.select().from(t).where(eq(t.id, id)).limit(1))[0],
      );
      if (!row) throw new NotFoundError();
      return row;
    },
    async listPublished(page: number, pageSize: number) {
      return databaseCall(() =>
        db
          .select({
            id: t.id,
            name: t.name,
            url: t.canonicalUrl,
            description: t.description,
            hasScreenshot: sql<boolean>`${t.screenshotKey} IS NOT NULL`.mapWith(Boolean),
          })
          .from(t)
          .where(eq(t.status, 'active'))
          .orderBy(desc(t.publishedAt), desc(t.id))
          .limit(pageSize + 1)
          .offset((page - 1) * pageSize),
      );
    },
    async listAdmin(page: number, pageSize: number, status?: FriendLinkStatus) {
      return databaseCall(() =>
        db
          .select({
            id: t.id,
            name: t.name,
            url: t.canonicalUrl,
            description: t.description,
            email: t.contactEmail,
            status: t.status,
            version: t.version,
            reviewedBy: t.reviewedBy,
            reviewedAt: t.reviewedAt,
            publishedAt: t.publishedAt,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
            hasScreenshot: sql<boolean>`${t.screenshotKey} IS NOT NULL`.mapWith(Boolean),
          })
          .from(t)
          .where(status ? eq(t.status, status) : undefined)
          .orderBy(desc(t.createdAt), desc(t.id))
          .limit(pageSize + 1)
          .offset((page - 1) * pageSize),
      );
    },
    async transition(id: string, action: ReviewAction, version: number, actor: string) {
      const now = Date.now();
      const from: FriendLinkStatus =
        action === 'hide' ? 'active' : action === 'restore' ? 'hidden' : 'pending';
      const to: FriendLinkStatus =
        action === 'reject' ? 'rejected' : action === 'hide' ? 'hidden' : 'active';
      const rows = await databaseCall(() =>
        db
          .update(t)
          .set({
            status: to,
            version: sql`${t.version} + 1`,
            updatedAt: now,
            updatedBy: actor,
            ...(from === 'pending' ? { reviewedAt: now, reviewedBy: actor } : {}),
            ...(action === 'approve' ? { publishedAt: now } : {}),
          })
          .where(and(eq(t.id, id), eq(t.status, from), eq(t.version, version)))
          .returning({ id: t.id, status: t.status, version: t.version }),
      );
      if (!rows[0]) throw new ConflictError('记录已处理或版本已变化，请刷新');
      return rows[0];
    },
    async isImageReferenced(key: string) {
      return databaseCall(
        async () =>
          (await db.select({ id: t.id }).from(t).where(eq(t.screenshotKey, key)).limit(1)).length >
          0,
      );
    },
    async detachRejectedImages(before: number) {
      // rejected 不可重新审核。先去除引用，失败删除可通过孤立文件扫描重试。
      return databaseCall(() =>
        db
          .update(t)
          .set({
            screenshotKey: null,
            screenshotMime: null,
            screenshotBytes: null,
            screenshotSha256: null,
            updatedAt: Date.now(),
            version: sql`${t.version} + 1`,
          })
          .where(
            inArray(
              t.id,
              db
                .select({ id: t.id })
                .from(t)
                .where(
                  and(
                    eq(t.status, 'rejected'),
                    lt(t.reviewedAt, before),
                    isNotNull(t.screenshotKey),
                  ),
                )
                .limit(100),
            ),
          )
          .returning({ id: t.id }),
      );
    },
  };
}
export type FriendLinkRepository = ReturnType<typeof friendLinkRepository>;
