import { getRuntimeConfig } from '../../config';
import { ValidationError } from '../../errors';
import { defineRestRoute } from '../../rest';
import { readBoundedBytes } from '../../rest/body';
import { authorizeAdmin, getAdminAccess } from '../../security/access';
import { jsonSuccess } from '../../types';
import { requireReadAction } from './policy';
import { githubRepository, snapshotRepository } from './repository';
import { readCmsOperation } from './service';

// Bundled server-only development fixtures. Never served to anonymous requests.
const sourceFiles = import.meta.env.DEV
  ? import.meta.glob<string>('/content/{blog,stories}/**/*.{md,mdx}', {
      query: '?raw',
      import: 'default',
      eager: true,
    })
  : {};
const files = Object.fromEntries(
  Object.entries(sourceFiles).map(([path, body]) => [path.slice(1), body]),
);

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
    const isSnapshot =
      import.meta.env.DEV &&
      getRuntimeConfig(env).services.adminAuth === 'local-development' &&
      !env.CMS_GITHUB_TOKEN;
    const repo = isSnapshot ? snapshotRepository(files) : githubRepository(env);
    if (action === 'getRepoDetails') {
      const name = isSnapshot ? 'local/content-snapshot' : (env.CMS_GITHUB_REPO ?? '');
      return jsonSuccess({
        id: 0,
        name: name.split('/')[1],
        full_name: name,
        private: true,
        html_url: isSnapshot ? '/admin' : `https://github.com/${name}`,
        description: 'Pageel compatibility prototype',
        pushed_at: '',
        default_branch: env.CMS_GITHUB_BRANCH ?? 'snapshot',
        owner: { login: name.split('/')[0] },
        permissions: { admin: false, push: false, pull: true },
      });
    }
    return jsonSuccess(await readCmsOperation(repo, action, params));
  },
});

/** @deprecated 旧名称兼容别名，推荐使用 cmsRepositoryRoute */
export const cmsGitRoute = cmsRepositoryRoute;

export const cmsSessionRoute = defineRestRoute({
  GET: async ({ env }, route) =>
    jsonSuccess({
      session: await getAdminAccess(route.request, env),
      mode:
        import.meta.env.DEV &&
        getRuntimeConfig(env).services.adminAuth === 'local-development' &&
        !env.CMS_GITHUB_TOKEN
          ? 'snapshot'
          : 'github',
      writable: false,
    }),
});
