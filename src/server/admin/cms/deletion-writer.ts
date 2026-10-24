import type { CloudflareEnv } from '../../../env.d';
import { AppError } from '../../errors';
import { postRepository } from './post-repository';

export interface DeletionWriter {
  delete(input: {
    path: string;
    expectedBlobSha: string;
    operationId: string;
  }): Promise<
    { kind: 'committed'; commitSha: string } | { kind: 'conflict' | 'failed' | 'unknown' }
  >;
  reconcile(input: { path: string; operationId: string }): Promise<string | null>;
}

/** GitHub DELETE 使用文件 blob SHA 条件删除；操作 ID 写入提交消息供未知结果对账。 */
export function githubDeletionWriter(
  env: CloudflareEnv,
  fetcher: typeof fetch = fetch,
): DeletionWriter {
  const repository = env.CMS_GITHUB_REPO;
  const branch = env.CMS_GITHUB_BRANCH;
  const token = env.CMS_GITHUB_TOKEN;
  if (!repository || !/^[\w.-]+\/[\w.-]+$/.test(repository) || !branch || !token)
    throw new AppError('CMS GitHub 删除配置尚未完成', 503, 'CMS_NOT_CONFIGURED');
  const base = `https://api.github.com/repos/${repository}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'imiles-cms',
  };
  const pathUrl = (path: string) =>
    `${base}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
  return {
    async delete({ path, expectedBlobSha, operationId }) {
      let response: Response;
      try {
        response = await fetcher(pathUrl(path), {
          method: 'DELETE',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `content: delete ${path} [cms-delete:${operationId}]`,
            sha: expectedBlobSha,
            branch,
          }),
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        });
      } catch {
        // 网络失败时请求可能已经到达 GitHub；不能用相同 SHA 再发一次 DELETE。
        return { kind: 'unknown' };
      }
      if (response.status === 409 || response.status === 422) return { kind: 'conflict' };
      if (response.status === 401 || response.status === 403) return { kind: 'failed' };
      // 404 可能是并发删除或网络中间层重放；交给提交记录对账。
      if (response.status === 404 || !response.ok) return { kind: 'unknown' };
      try {
        const data = (await response.json()) as { commit?: { sha?: unknown } };
        if (typeof data.commit?.sha === 'string')
          return { kind: 'committed', commitSha: data.commit.sha };
      } catch {
        // 删除可能已完成，必须保留原操作 ID。
      }
      return { kind: 'unknown' };
    },
    async reconcile({ path, operationId }) {
      // 仅从固定分支、固定路径的提交历史中寻找带操作 ID 的那次删除。
      const query = new URLSearchParams({ path, sha: branch, per_page: '100' });
      const response = await fetcher(`${base}/commits?${query}`, {
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new AppError('GitHub 删除对账查询失败', 502, 'CMS_RECONCILE_ERROR');
      const commits = (await response.json()) as Array<{
        sha?: unknown;
        commit?: { message?: unknown };
      }>;
      if (!Array.isArray(commits))
        throw new AppError('GitHub 删除对账响应无效', 502, 'CMS_RECONCILE_ERROR');
      const found = commits.find(
        (item) =>
          typeof item.commit?.message === 'string' &&
          item.commit.message.includes(`[cms-delete:${operationId}]`),
      );
      if (typeof found?.sha !== 'string') return null;
      // 只认该提交内文件不存在的证据；当前分支是否已重建文件与本次结果无关。
      const version = await fetcher(`${pathUrl(path)}?ref=${encodeURIComponent(found.sha)}`, {
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      });
      if (version.status !== 404)
        throw new AppError('删除提交中的文件状态无法确认', 502, 'CMS_RECONCILE_ERROR');
      return found.sha;
    },
  };
}

/** D1 持久化删除适配器：直接将 cms_posts 归档或删除。 */
export function d1DeletionWriter(env: CloudflareEnv): DeletionWriter {
  const posts = postRepository(env);
  return {
    async delete({ path, expectedBlobSha, operationId }) {
      const post = await posts.findByTargetPath(path);
      if (!post) return { kind: 'failed' };
      if (expectedBlobSha && post.sourceHash !== expectedBlobSha) {
        return { kind: 'conflict' };
      }
      await posts.archive(post.id, 'admin');
      return { kind: 'committed', commitSha: `d1:del:${operationId}` };
    },
    async reconcile({ path, operationId }) {
      const post = await posts.findByTargetPath(path);
      if (!post || post.status === 'archived') {
        return `d1:del:${operationId}`;
      }
      return null;
    },
  };
}
