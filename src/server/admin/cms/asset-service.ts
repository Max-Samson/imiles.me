import { and, desc, eq, inArray, or } from 'drizzle-orm';
import type { CloudflareEnv } from '../../../env.d';
import { createDrizzleClient, schema } from '../../db';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../errors';
import { DEFAULT_MAX_IMAGE_BYTES, validateImage } from '../../media/images';
import { readBoundedBytes } from '../../rest/body';
import type { ObjectStorage } from '../../storage';
import { createObjectStorage } from '../../storage';
import { draftRepository } from './draft-repository';

// multipart 边界与文件头会增加少量请求体开销；图片自身仍按 validateImage 的上限校验。
const uploadLimit = DEFAULT_MAX_IMAGE_BYTES + 8192;

/** 上传只接收单个 image 字段，图片格式以校验后的实际字节为准。 */
export async function readCmsImage(request: Request) {
  const contentType = request.headers.get('Content-Type') ?? '';
  if (!/^multipart\/form-data\s*;/i.test(contentType))
    throw new ValidationError('请使用 multipart/form-data 上传图片');
  const bytes = await readBoundedBytes(request.body, uploadLimit);
  let form: FormData;
  try {
    form = await new Response(bytes, { headers: { 'Content-Type': contentType } }).formData();
  } catch {
    throw new ValidationError('图片上传表单格式无效');
  }
  const entries = [...form.entries()];
  if (entries.length !== 1 || entries[0][0] !== 'image' || typeof entries[0][1] === 'string')
    throw new ValidationError('表单必须只包含一个 image 文件');
  const file = entries[0][1] as File;
  return validateImage(new Uint8Array(await file.arrayBuffer()), file.type);
}

/**
 * 文章图片复用站点现有公开桶，不再要求独立草稿桶。
 * 公开桶直链可能在文章发布前被访问；下方 staged/committed 只控制本站 Worker 路由。
 */
function articleImageStorage(env: CloudflareEnv): ObjectStorage {
  if (
    !env.SUPABASE_STORAGE_BUCKET ||
    !env.SUPABASE_S3_ENDPOINT ||
    !env.SUPABASE_S3_REGION ||
    !env.SUPABASE_S3_ACCESS_KEY_ID ||
    !env.SUPABASE_S3_SECRET_ACCESS_KEY
  )
    throw new AppError('CMS 文章图片存储尚未配置', 503, 'CMS_MEDIA_NOT_CONFIGURED');
  return createObjectStorage(env);
}

/** D1 媒体元数据可独立于对象存储配置查询；仓库已有图片不依赖上传桶。 */
export async function findCmsAssetForPublication(
  env: CloudflareEnv,
  draftId: string,
  publicPath: string,
) {
  const db = createDrizzleClient(env);
  return db.query.cmsDraftAssets.findFirst({
    where: and(
      eq(schema.cmsDraftAssets.publicPath, publicPath),
      or(eq(schema.cmsDraftAssets.draftId, draftId), eq(schema.cmsDraftAssets.status, 'committed')),
    ),
  });
}

/** Git 提交确认后按固定快照开放本草稿图片；重复执行不会改变其他草稿。 */
export async function commitCmsDraftAssets(env: CloudflareEnv, draftId: string, paths: string[]) {
  if (!paths.length) return;
  const db = createDrizzleClient(env);
  await db
    .update(schema.cmsDraftAssets)
    .set({ status: 'committed', updatedAt: Date.now() })
    .where(
      and(
        eq(schema.cmsDraftAssets.draftId, draftId),
        inArray(schema.cmsDraftAssets.publicPath, paths),
      ),
    );
}

export function cmsAssetService(
  env: CloudflareEnv,
  storage: ObjectStorage = articleImageStorage(env),
) {
  const db = createDrizzleClient(env);
  const drafts = draftRepository(env);
  const previewUrl = (id: string) => `/api/v1/admin/cms/assets/${id}/preview`;
  // 暂存阶段的 publicUrl 尚未在本站 Worker 开放；公开桶自身的直链不受此状态约束。
  const publicAsset = (asset: typeof schema.cmsDraftAssets.$inferSelect) => ({
    id: asset.id,
    draftId: asset.draftId,
    publicUrl: asset.publicPath.replace(/^public/, ''),
    previewUrl: previewUrl(asset.id),
    mime: asset.mime,
    bytes: asset.bytes,
    contentHash: asset.contentHash,
    status: asset.status,
    createdAt: asset.createdAt,
  });
  return {
    /** 本站公开路由只返回已发布媒体；不承诺阻断公开桶自身的直链访问。 */
    async publicImage(filename: string) {
      const match = /^(cma_[a-f0-9]{32})\.(png|jpe?g|webp)$/.exec(filename);
      if (!match) throw new NotFoundError('图片不存在');
      const asset = await db.query.cmsDraftAssets.findFirst({
        where: and(
          eq(schema.cmsDraftAssets.id, match[1]),
          eq(schema.cmsDraftAssets.publicPath, `public/images/blog/${filename}`),
          eq(schema.cmsDraftAssets.status, 'committed'),
        ),
      });
      if (!asset) throw new NotFoundError('图片不存在');
      const bytes = await storage.get(asset.objectKey, DEFAULT_MAX_IMAGE_BYTES);
      const checked = await validateImage(bytes, asset.mime);
      if (checked.hash !== asset.contentHash || bytes.length !== asset.bytes)
        throw new ConflictError('已发布图片与记录不一致');
      return new Response(bytes, {
        headers: {
          'Content-Type': asset.mime,
          'Content-Disposition': 'inline',
          'Cache-Control': 'public, max-age=3600',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    },
    async publishReferenced(draftId: string, paths: string[]) {
      return commitCmsDraftAssets(env, draftId, paths);
    },
    async availableForPublication(draftId: string, publicPath: string) {
      return findCmsAssetForPublication(env, draftId, publicPath);
    },
    async list(draftId: string) {
      await drafts.get(draftId);
      const assets = await db.query.cmsDraftAssets.findMany({
        where: eq(schema.cmsDraftAssets.draftId, draftId),
        orderBy: [desc(schema.cmsDraftAssets.createdAt)],
      });
      return assets.map(publicAsset);
    },
    async upload(draftId: string, request: Request, actorId: string) {
      const draft = await drafts.get(draftId);
      if (draft.status !== 'active') throw new ConflictError('草稿已关闭，不能上传图片');
      if (draft.collection !== 'blog') throw new ValidationError('Stories 不支持图片');
      const image = await readCmsImage(request);
      const id = `cma_${crypto.randomUUID().replace(/-/g, '')}`;
      const objectKey = `cms/drafts/${draftId}/${id}`;
      const publicPath = `public/images/blog/${id}.${image.extension}`;
      // 先写站点桶内独立的 CMS 对象，D1 失败时清理；不覆盖现有站点图片。
      await storage.put(objectKey, { bytes: image.bytes, contentType: image.mime });
      try {
        const [asset] = await db
          .insert(schema.cmsDraftAssets)
          .values({
            id,
            draftId,
            objectKey,
            contentHash: image.hash,
            mime: image.mime,
            bytes: image.bytes.length,
            publicPath,
            status: 'staged',
            createdBy: actorId,
          })
          .returning();
        return publicAsset(asset);
      } catch (error) {
        // D1 与对象存储没有跨系统事务；尽力清理刚写入的对象，异常中断留下的孤儿需定期对账。
        await storage.remove(objectKey).catch(() => {});
        throw error;
      }
    },
    async preview(id: string) {
      const asset = await db.query.cmsDraftAssets.findFirst({
        where: eq(schema.cmsDraftAssets.id, id),
      });
      if (!asset) throw new NotFoundError('草稿图片不存在');
      const bytes = await storage.get(asset.objectKey, DEFAULT_MAX_IMAGE_BYTES);
      // 存储对象被替换或损坏时不向编辑器返回错误内容。
      const checked = await validateImage(bytes, asset.mime);
      if (checked.hash !== asset.contentHash || bytes.length !== asset.bytes)
        throw new ConflictError('草稿图片与上传记录不一致');
      return new Response(bytes, {
        headers: {
          'Content-Type': asset.mime,
          'Content-Disposition': 'inline',
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    },
    async stagedForDraft(draftId: string, publicPath: string) {
      return db.query.cmsDraftAssets.findFirst({
        where: and(
          eq(schema.cmsDraftAssets.draftId, draftId),
          eq(schema.cmsDraftAssets.publicPath, publicPath),
          eq(schema.cmsDraftAssets.status, 'staged'),
        ),
      });
    },
  };
}
