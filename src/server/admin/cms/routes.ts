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

export const cmsGitRoute = defineRestRoute({
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
