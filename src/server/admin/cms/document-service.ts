import type { ContentCollection, ContentLanguage } from '../../../config/content-collections';
import type { CloudflareEnv } from '../../../env.d';
import {
  resolveExistingContentTarget,
  resolveNewContentTarget,
} from '../../../lib/content-routing';
import { parseSourceDocument } from '../../../lib/content-source';
import { ConflictError, ValidationError } from '../../errors';
import { deletionRepository } from './deletion-repository';
import { draftRepository } from './draft-repository';
import type { CmsRepository } from './repository';

const maxSourceBytes = 1024 * 1024;

/** 草稿保留原文；摘要与字节数用于后续固定发布快照，不改写未完成的 YAML。 */
async function sourceMetadata(source: string) {
  const bytes = new TextEncoder().encode(source);
  if (bytes.length < 1 || bytes.length > maxSourceBytes) {
    throw new ValidationError('草稿源文必须在 1 字节至 1 MiB 之间');
  }
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  let titleCache: string | null = null;
  try {
    const title = parseSourceDocument(source).fields.title;
    if (typeof title === 'string') titleCache = title.slice(0, 200);
  } catch {
    // 未写完的 YAML 也能作为草稿保存；列表使用路径回退。
  }
  return {
    source,
    sourceBytes: bytes.length,
    sourceHash: Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join(
      '',
    ),
    titleCache,
  };
}

/** 文档模块协调源文、集合路由、Git 基准和 D1 草稿；不执行 Git 写入。 */
export function documentService(env: CloudflareEnv, repository: () => CmsRepository) {
  const drafts = draftRepository(env);
  return {
    async createDraft(
      input: {
        collection: ContentCollection;
        lang: ContentLanguage;
        slug: string;
        format?: 'md' | 'mdx';
        path?: string;
        baseBlobSha?: string;
        source: string;
      },
      actorId: string,
    ) {
      const target = input.path
        ? resolveExistingContentTarget(input.collection, input.lang, input.path)
        : resolveNewContentTarget(input);
      if (input.format && input.format !== target.format)
        throw new ValidationError('文件格式与目标路径不一致');
      if (await deletionRepository(env).pendingForPath(target.path))
        throw new ConflictError('目标文章正在删除或待对账，请先完成删除操作');
      let baseBlobSha: string | null = null;
      const content = repository();
      if (input.path) {
        // 已有文章必须使用编辑器打开时拿到的同一版 SHA，不能刷新 SHA 后覆盖他人改动。
        if (!input.baseBlobSha) throw new ValidationError('编辑已有文章必须提供打开时的 blob SHA');
        const version = await content.readVersion(target.path);
        if (version.blobSha !== input.baseBlobSha)
          throw new ConflictError('仓库文章已更新，请先比较版本');
        baseBlobSha = version.blobSha;
      } else if (await content.sha(target.path)) {
        // 新文稿只能创建空路径；仓库已有文件时不能悄悄转成更新。
        throw new ConflictError('目标文件已存在');
      }
      const metadata = await sourceMetadata(input.source);
      const draft = await drafts.create({
        collection: target.collection,
        format: target.format,
        lang: target.lang,
        slug: target.slug,
        targetPath: target.path,
        publicPath: target.publicPath,
        baseBlobSha,
        ...metadata,
        createdBy: actorId,
        updatedBy: actorId,
      });
      return draft;
    },
    getDraft: drafts.get,
    listDrafts: drafts.listActive,
    async discardDraft(id: string, expectedRevision: number, actorId: string) {
      return drafts.discard(id, expectedRevision, actorId);
    },
    async saveDraft(id: string, expectedRevision: number, source: string, actorId: string) {
      // 修订号由 D1 条件更新推进；HTTP 层不能把保存回执误当成 Git 发布成功。
      return drafts.save(id, expectedRevision, {
        ...(await sourceMetadata(source)),
        updatedBy: actorId,
      });
    },
  };
}
