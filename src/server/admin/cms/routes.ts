import { z } from 'astro/zod';
import type { CloudflareEnv } from '../../../env.d';
import { ValidationError } from '../../errors';
import { defineRestRoute } from '../../rest';
import { readBoundedBytes } from '../../rest/body';
import { readJsonBody } from '../../rest/validation';
import { authorizeAdmin, authorizeAdminMutation, getAdminAccess } from '../../security/access';
import { jsonSuccess } from '../../types';
import { cmsAssetService } from './asset-service';
import { deletionRepository } from './deletion-repository';
import { deletionService } from './deletion-service';
import { documentService } from './document-service';
import { contentPath, requireReadAction } from './policy';
import { publicationRepository } from './publication-repository';
import { publicationService } from './publication-service';
import { d1Repository } from './repository';
import { readCmsOperation } from './service';

function contentRepository(env: CloudflareEnv) {
  return d1Repository(env);
}

const createDraftInput = z.object({
  collection: z.enum(['blog', 'stories']),
  lang: z.enum(['en', 'zh']),
  slug: z.string().min(1).max(100),
  format: z.enum(['md', 'mdx']).optional(),
  path: z.string().max(240).optional(),
  baseBlobSha: z.string().max(100).optional(),
  source: z.string(),
});
const saveDraftInput = z.object({
  expectedRevision: z.number().int().positive(),
  source: z.string(),
});
const discardDraftInput = z.object({ expectedRevision: z.number().int().positive() });
const publishInput = z.object({
  expectedRevision: z.number().int().positive(),
  operationId: z.string().uuid(),
});
const deleteArticleInput = z.object({
  path: z.string().min(1).max(240),
  expectedBlobSha: z.string().regex(/^[a-f0-9]{40}$/i),
  operationId: z.string().uuid(),
});

function draftId(value: unknown): string {
  if (typeof value !== 'string' || !/^cmd_[a-f0-9]{32}$/.test(value)) {
    throw new ValidationError('草稿 ID 无效');
  }
  return value;
}

function draftSummary(draft: Awaited<ReturnType<ReturnType<typeof documentService>['getDraft']>>) {
  const { source, ...summary } = draft;
  void source;
  return summary;
}

/**
 * CMS 内容仓库操作路由
 *
 * 代理 Pageel CMS 编辑器对博客与故事存储库的只读操作（目录扫描、文件树、文件内容、元数据等）。
 * 服务端隔离 GitHub Token 与开发环境本地快照，严格限制为只读动作，杜绝写操作。
 */
export const cmsRepositoryRoute = defineRestRoute({
  POST: async ({ env }, route) => {
    await authorizeAdmin(route.request, env, 'admin:read');
    const bytes = await readBoundedBytes(route.request.body, 8192);
    let input: { action?: unknown; params?: Record<string, unknown> };
    try {
      input = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new ValidationError('请求必须是 JSON');
    }
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError();
    const action = requireReadAction(input.action);
    const params = input.params ?? {};
    if (!params || typeof params !== 'object' || Array.isArray(params)) throw new ValidationError();
    const repo = contentRepository(env);
    if (action === 'getRepoDetails') {
      return jsonSuccess({
        id: 0,
        name: 'd1',
        full_name: 'cloudflare/d1',
        private: true,
        html_url: '/admin',
        description: 'D1 Native Content Store',
        pushed_at: '',
        default_branch: 'main',
        owner: { login: 'cloudflare' },
        permissions: { admin: false, push: false, pull: true },
      });
    }
    return jsonSuccess(await readCmsOperation(repo, action, params));
  },
});

/** 工作草稿只进入 D1；此接口绝不提交 Git 或触发部署。 */
export const cmsDraftListRoute = defineRestRoute({
  GET: async ({ env }, route) => {
    await authorizeAdmin(route.request, env, 'admin:read');
    const drafts = await documentService(env, () => contentRepository(env)).listDrafts();
    return jsonSuccess(drafts);
  },
  POST: async ({ env }, route) => {
    const actor = await authorizeAdminMutation(route.request, env, 'admin:write');
    const input = await readJsonBody(route.request, createDraftInput, 2 * 1024 * 1024);
    const draft = await documentService(env, () => contentRepository(env)).createDraft(
      input,
      actor.id,
    );
    return jsonSuccess(draftSummary(draft), {
      status: 201,
      headers: { Location: `/api/v1/admin/cms/drafts/${draft.id}` },
    });
  },
});

export const cmsDraftDetailRoute = defineRestRoute({
  GET: async ({ env }, route) => {
    await authorizeAdmin(route.request, env, 'admin:read');
    const draft = await documentService(env, () => contentRepository(env)).getDraft(
      draftId(route.params.id),
    );
    return jsonSuccess({
      ...draft,
      publication: await publicationRepository(env).pendingForDraft(draft.id),
    });
  },
  PUT: async ({ env }, route) => {
    const actor = await authorizeAdminMutation(route.request, env, 'admin:write');
    const input = await readJsonBody(route.request, saveDraftInput, 2 * 1024 * 1024);
    const draft = await documentService(env, () => contentRepository(env)).saveDraft(
      draftId(route.params.id),
      input.expectedRevision,
      input.source,
      actor.id,
    );
    return jsonSuccess(draftSummary(draft));
  },
  DELETE: async ({ env }, route) => {
    const actor = await authorizeAdminMutation(route.request, env, 'admin:write');
    const input = await readJsonBody(route.request, discardDraftInput, 4096);
    const draft = await documentService(env, () => contentRepository(env)).discardDraft(
      draftId(route.params.id),
      input.expectedRevision,
      actor.id,
    );
    return jsonSuccess(draftSummary(draft));
  },
});

/** 图片复用站点公开桶；本站固定公开路径仍要等文章发布确认后才开放。 */
export const cmsDraftAssetsRoute = defineRestRoute({
  GET: async ({ env }, route) => {
    await authorizeAdmin(route.request, env, 'admin:read');
    return jsonSuccess(await cmsAssetService(env).list(draftId(route.params.id)));
  },
  POST: async ({ env }, route) => {
    const actor = await authorizeAdminMutation(route.request, env, 'admin:write');
    return jsonSuccess(
      await cmsAssetService(env).upload(draftId(route.params.id), route.request, actor.id),
      { status: 201 },
    );
  },
});

export const cmsAssetPreviewRoute = defineRestRoute({
  GET: async ({ env }, route) => {
    await authorizeAdmin(route.request, env, 'admin:read');
    const id = route.params.assetId;
    if (!id || !/^cma_[a-f0-9]{32}$/.test(id)) throw new ValidationError('图片 ID 无效');
    return cmsAssetService(env).preview(id);
  },
});

/** 已发布图片的固定公开 URL；未知 ID 和未发布图片均返回 404。 */
export const cmsPublicImageRoute = defineRestRoute({
  GET: async ({ env }, route) => {
    const filename = route.params.filename;
    if (!filename) throw new ValidationError('图片文件名无效');
    return cmsAssetService(env).publicImage(filename);
  },
});

/** 发布只接受固定草稿修订与幂等 ID；具体仓库和部署分支来自 Worker 环境。 */
export const cmsPublishRoute = defineRestRoute({
  POST: async ({ env }, route) => {
    const actor = await authorizeAdminMutation(route.request, env, 'admin:write');
    const input = await readJsonBody(route.request, publishInput, 4096);
    const content = contentRepository(env);
    const result = await publicationService(env, content).publish(
      draftId(route.params.id),
      input.expectedRevision,
      input.operationId,
      actor.id,
    );
    return jsonSuccess(result);
  },
});

export const cmsPublicationDetailRoute = defineRestRoute({
  GET: async ({ env }, route) => {
    await authorizeAdmin(route.request, env, 'admin:read');
    const operationId = route.params.operationId;
    if (!operationId || !z.string().uuid().safeParse(operationId).success)
      throw new ValidationError('发布操作 ID 无效');
    return jsonSuccess(await publicationService(env, contentRepository(env)).get(operationId));
  },
});

/** 重开文章后按固定文件身份恢复最近一次已提交的部署核验入口，或查询未完成对账的发布操作。 */
export const cmsPublicationListRoute = defineRestRoute({
  GET: async ({ env }, route) => {
    await authorizeAdmin(route.request, env, 'admin:read');
    const url = new URL(route.request.url);
    if (url.searchParams.get('pending') === 'true') {
      return jsonSuccess(
        await publicationService(env, contentRepository(env)).pendingPublications(),
      );
    }
    const path = contentPath(url.searchParams.get('path'));
    return jsonSuccess(
      await publicationService(env, contentRepository(env)).latestCommittedForPath(path),
    );
  },
});

/** 只查询固定 Deploy 工作流证据；数据库仅记录核验结论，不触发部署。 */
export const cmsPublicationVerifyRoute = defineRestRoute({
  POST: async ({ env }, route) => {
    await authorizeAdminMutation(route.request, env, 'admin:write');
    const operationId = route.params.operationId;
    if (!operationId || !z.string().uuid().safeParse(operationId).success)
      throw new ValidationError('发布操作 ID 无效');
    return jsonSuccess(
      await publicationService(env, contentRepository(env)).verifyDeployment(operationId),
    );
  },
});

/** 已发布文章的 Git 删除独立于 D1 草稿废弃；响应区分提交与部署。 */
export const cmsDeletionListRoute = defineRestRoute({
  GET: async ({ env }, route) => {
    await authorizeAdmin(route.request, env, 'admin:read');
    const path = new URL(route.request.url).searchParams.get('path');
    if (path === null) return jsonSuccess(await deletionRepository(env).listPending());
    if (!path || path.length > 240 || !/^content\/(blog|stories)\//.test(path))
      throw new ValidationError('文章路径无效');
    return jsonSuccess(await deletionRepository(env).pendingForPath(path));
  },
  POST: async ({ env }, route) => {
    const actor = await authorizeAdminMutation(route.request, env, 'admin:write');
    const input = await readJsonBody(route.request, deleteArticleInput, 4096);
    return jsonSuccess(
      await deletionService(env, contentRepository(env)).delete(
        input.path,
        input.expectedBlobSha,
        input.operationId,
        actor.id,
      ),
    );
  },
});

export const cmsDeletionDetailRoute = defineRestRoute({
  GET: async ({ env }, route) => {
    await authorizeAdmin(route.request, env, 'admin:read');
    const operationId = route.params.operationId;
    if (!operationId || !z.string().uuid().safeParse(operationId).success)
      throw new ValidationError('删除操作 ID 无效');
    return jsonSuccess(await deletionService(env, contentRepository(env)).get(operationId));
  },
});

/** @deprecated 旧名称兼容别名，推荐使用 cmsRepositoryRoute */
export const cmsGitRoute = cmsRepositoryRoute;

export const cmsSessionRoute = defineRestRoute({
  GET: async ({ env }, route) => {
    const session = await getAdminAccess(route.request, env);
    const writable = session.capabilities.includes('admin:write');

    return jsonSuccess({
      session,
      mode: 'd1',
      repo: 'cloudflare/d1',
      branch: 'main',
      isProductionBranch: true,
      isTestBranch: false,
      isLocalBranch: false,
      isConfigured: true,
      writable,
    });
  },
});
