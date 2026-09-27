import { generateEntityId } from '../db/schema/common';
import type { FriendLinkStatus } from '../db/schema/friend-links';
import { ConflictError, InternalServerError, NotFoundError } from '../errors';
import { createImageService } from '../media/image-service';
import { sha256 } from '../security/hash';
import type { ObjectStorage } from '../storage';
import type { FriendLinkRepository } from './repository';
import type { Submission } from './upload';
import { canonicalizeUrl, type ReviewAction } from './validation';

type ScreenshotScope = 'public' | 'admin';

function pageResult<T>(rows: T[], page: number, pageSize: number) {
  return {
    items: rows.slice(0, pageSize),
    page,
    pageSize,
    hasNextPage: rows.length > pageSize,
  };
}

export function friendLinkService(repo: FriendLinkRepository, images: ObjectStorage) {
  const imageService = createImageService(images);
  return {
    async submit(input: Submission, idempotencyKey: string, verify: () => Promise<void>) {
      const url = canonicalizeUrl(input.url);
      const keyHash = await sha256(idempotencyKey);
      const payloadHash = await sha256(
        JSON.stringify([
          input.name ?? null,
          input.url,
          url,
          input.description,
          input.email,
          input.screenshot?.hash ?? null,
        ]),
      );
      const receipt = (row: { id: string; payloadHash: string }, created = false) => {
        if (row.payloadHash !== payloadHash) throw new ConflictError('该提交标识已用于不同内容');
        return { id: row.id, message: '已收到，等待人工审核', created };
      };
      const previous = await repo.bySubmissionKey(keyHash);
      if (previous) return receipt(previous);
      await verify();
      const image = input.screenshot;
      const stored = image ? await imageService.save(image, 'friend-links/screenshots') : null;
      const key = stored?.key ?? null;
      // 写入/数据库结果不明确时保留对象，交由超过 24 小时的孤立对象维护回收。

      const row = await repo.insert({
        id: generateEntityId('fl'),
        name: input.name ?? null,
        submittedUrl: input.url,
        canonicalUrl: url,
        description: input.description,
        contactEmail: input.email,
        screenshotKey: key,
        screenshotMime: image?.mime ?? null,
        screenshotBytes: image?.bytes.length ?? null,
        screenshotSha256: image?.hash ?? null,
        submissionKeyHash: keyHash,
        submissionPayloadHash: payloadHash,
      });
      if (row) return receipt({ ...row, payloadHash }, true);
      const winner = await repo.bySubmissionKey(keyHash);
      if (!winner) throw new InternalServerError('无法确认提交结果，请使用原幂等键重试');
      // 对象 key 每次上传唯一；清理竞争失败者的对象，不影响已落库的申请结果。
      if (key) {
        try {
          await images.remove(key);
        } catch {
          /* 孤立文件由维护接口重试。 */
        }
      }
      return receipt(winner);
    },
    async listPublished(page: number, pageSize: number) {
      const rows = await repo.listPublished(page, pageSize);
      const result = pageResult(rows, page, pageSize);
      return {
        ...result,
        items: result.items.map(({ hasScreenshot, ...row }) => ({
          ...row,
          screenshotUrl: hasScreenshot ? `/api/v1/friend-links/${row.id}/screenshot` : null,
        })),
      };
    },
    async listAdmin(page: number, pageSize: number, status?: FriendLinkStatus) {
      return pageResult(await repo.listAdmin(page, pageSize, status), page, pageSize);
    },
    async adminDetail(id: string) {
      const row = await repo.detail(id);
      return {
        id: row.id,
        name: row.name,
        url: row.canonicalUrl,
        submittedUrl: row.submittedUrl,
        description: row.description,
        email: row.contactEmail,
        status: row.status,
        version: row.version,
        reviewedBy: row.reviewedBy,
        reviewedAt: row.reviewedAt,
        publishedAt: row.publishedAt,
        updatedBy: row.updatedBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        screenshotUrl: row.screenshotKey ? `/api/v1/admin/friend-links/${row.id}/screenshot` : null,
      };
    },
    review(id: string, action: ReviewAction, expectedVersion: number, actorId: string) {
      return repo.transition(id, action, expectedVersion, actorId);
    },
    async delete(id: string) {
      const deleted = await repo.delete(id);
      if (deleted.screenshotKey) {
        try {
          await images.remove(deleted.screenshotKey);
        } catch {
          // 对象存储删除失败不阻塞数据删除，残留对象交由 cleanup 任务清理
        }
      }
      return {
        id: deleted.id,
        name: deleted.name,
        url: deleted.canonicalUrl,
      };
    },
    async screenshot(id: string, scope: ScreenshotScope) {
      const row = await repo.detail(id);
      if (
        (scope === 'public' && row.status !== 'active') ||
        !row.screenshotKey ||
        !row.screenshotMime
      )
        throw new NotFoundError();
      if (!row.screenshotBytes || !row.screenshotSha256)
        throw new InternalServerError('图片元信息不完整');
      return imageService.read({
        key: row.screenshotKey,
        mime: row.screenshotMime,
        size: row.screenshotBytes,
        hash: row.screenshotSha256,
      });
    },
    async cleanup(cursor?: string) {
      const now = Date.now();
      const detached = await repo.detachRejectedImages(now - 7 * 86400000);
      const page = await images.list({ prefix: 'friend-links/screenshots/', limit: 20, cursor });
      let removed = 0;
      for (const object of page.objects) {
        if (object.modified >= now - 86400000 || (await repo.isImageReferenced(object.key)))
          continue;
        await images.remove(object.key);
        removed++;
      }
      return { detached: detached.length, removed, nextCursor: page.cursor ?? null };
    },
  };
}
