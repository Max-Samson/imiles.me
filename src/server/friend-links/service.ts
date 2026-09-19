import { generateEntityId } from '../db/schema/common';
import { ConflictError, InternalServerError, NotFoundError } from '../errors';
import { createImageService } from '../media/image-service';
import { sha256 } from '../security/hash';
import type { ObjectStorage } from '../storage';
import type { FriendLinkRepository } from './repository';
import type { Submission } from './upload';
import { canonicalizeUrl } from './validation';

export function friendLinkService(repo: FriendLinkRepository, images: ObjectStorage) {
  const imageService = createImageService(images);
  return {
    async submit(input: Submission, idempotencyKey: string, verify: () => Promise<void>) {
      const url = canonicalizeUrl(input.url);
      const keyHash = await sha256(idempotencyKey);
      const payloadHash = await sha256(
        JSON.stringify([
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
      // 新 key 无其他写入者；清理失败不会将已成功提交伪装成失败。
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
      return {
        items: rows.slice(0, pageSize).map(({ hasScreenshot, ...row }) => ({
          ...row,
          screenshotUrl: hasScreenshot ? `/api/v1/friend-links/${row.id}/screenshot` : null,
        })),
        page,
        pageSize,
        hasNextPage: rows.length > pageSize,
      };
    },
    async screenshot(id: string, admin: boolean) {
      const row = await repo.detail(id);
      if ((!admin && row.status !== 'active') || !row.screenshotKey || !row.screenshotMime)
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
