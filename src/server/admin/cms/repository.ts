import type { CloudflareEnv } from '../../../env.d';
import { AppError, NotFoundError, ValidationError } from '../../errors';

export interface CmsEntry {
  name: string;
  path: string;
  type: 'file' | 'dir';
  sha: string;
  size: number;
}
export interface CmsRepository {
  mode: 'snapshot' | 'github';
  readVersion(path: string): Promise<{ content: string; blobSha: string }>;
  read(path: string): Promise<string>;
  list(path: string): Promise<CmsEntry[]>;
  sha(path: string): Promise<string | null>;
}

/** Development snapshot only: no disk writer, no production fallback. */
export function snapshotRepository(files: Record<string, string>): CmsRepository {
  const entries = new Map(Object.entries(files).map(([path, body]) => [path, body]));
  return {
    mode: 'snapshot',
    async readVersion(path) {
      const content = entries.get(path);
      if (content === undefined) throw new NotFoundError();
      return { content, blobSha: `snapshot:${path}` };
    },
    async read(path) {
      const content = entries.get(path);
      if (content === undefined) throw new NotFoundError();
      return content;
    },
    async list(path) {
      return [...entries]
        .filter(([name]) => name.startsWith(`${path}/`))
        .map(([name, body]) => ({
          name: name.split('/').pop() ?? name,
          path: name,
          type: 'file' as const,
          sha: `snapshot:${name}`,
          size: new TextEncoder().encode(body).length,
        }));
    },
    async sha(path) {
      return entries.has(path) ? `snapshot:${path}` : null;
    },
  };
}

/** Request-scoped credentials; only the GitHub Contents read API is enabled. */
export function githubRepository(env: CloudflareEnv, fetcher: typeof fetch = fetch): CmsRepository {
  const repo = env.CMS_GITHUB_REPO;
  const branch = env.CMS_GITHUB_BRANCH;
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo) || !branch || !env.CMS_GITHUB_TOKEN) {
    throw new AppError('CMS GitHub 读取配置尚未完成', 503, 'CMS_NOT_CONFIGURED');
  }
  const base = `https://api.github.com/repos/${repo}/contents/`;
  async function request(path: string) {
    const response = await fetcher(
      `${base}${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch ?? '')}`,
      {
        headers: {
          Authorization: `Bearer ${env.CMS_GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'imiles-cms',
        },
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      },
    );
    if (response.status === 404) throw new NotFoundError('仓库路径不存在');
    if (!response.ok)
      throw new AppError('GitHub 读取失败，请检查服务端配置', 502, 'CMS_UPSTREAM_ERROR');
    return response.json() as Promise<Record<string, unknown> | CmsEntry[]>;
  }
  async function readVersion(path: string) {
    const data = await request(path);
    if (
      Array.isArray(data) ||
      data.encoding !== 'base64' ||
      typeof data.content !== 'string' ||
      typeof data.sha !== 'string'
    ) {
      throw new ValidationError('无法读取该文件内容');
    }
    const content = new TextDecoder().decode(
      Uint8Array.from(atob(data.content.replace(/\s/g, '')), (c) => c.charCodeAt(0)),
    );
    return { content, blobSha: data.sha };
  }
  return {
    mode: 'github',
    readVersion,
    async read(path) {
      return (await readVersion(path)).content;
    },
    async list(path) {
      const data = await request(path);
      if (!Array.isArray(data)) throw new ValidationError('该路径不是目录');
      return data.map(({ name, path, type, sha, size }) => ({ name, path, type, sha, size }));
    },
    async sha(path) {
      try {
        const data = await request(path);
        return Array.isArray(data) ? null : String(data.sha);
      } catch (error) {
        if (error instanceof NotFoundError) return null;
        throw error;
      }
    },
  };
}
