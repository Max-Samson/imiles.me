import type { CloudflareEnv } from '../../../env.d';
import { AppError, NotFoundError, ValidationError } from '../../errors';
import { postRepository } from './post-repository';

export interface CmsEntry {
  name: string;
  path: string;
  type: 'file' | 'dir';
  sha: string;
  size: number;
}
export interface CmsRepository {
  mode: 'snapshot' | 'github' | 'd1';
  readVersion(path: string): Promise<{ content: string; blobSha: string }>;
  read(path: string): Promise<string>;
  list(path: string): Promise<CmsEntry[]>;
  sha(path: string): Promise<string | null>;
}

const sourceFiles =
  typeof import.meta.glob === 'function'
    ? import.meta.glob<string>('/content/{blog,stories}/**/*.{md,mdx}', {
        query: '?raw',
        import: 'default',
        eager: true,
      })
    : {};
const staticFiles = Object.fromEntries(
  Object.entries(sourceFiles).map(([path, body]) => [path.replace(/^\//, ''), body]),
);

async function sha256Hex(content: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** D1 持久化存储库：文章直接读取与列举 D1 数据库中的 cms_posts 表，未同步的静态文章无缝回退。 */
export function d1Repository(env: CloudflareEnv): CmsRepository {
  const posts = postRepository(env);
  return {
    mode: 'd1',
    async readVersion(path) {
      const post = await posts.findByTargetPath(path);
      if (post) return { content: post.source, blobSha: post.sourceHash };
      const staticContent = staticFiles[path];
      if (staticContent !== undefined) {
        return { content: staticContent, blobSha: await sha256Hex(staticContent) };
      }
      throw new NotFoundError('文章不存在');
    },
    async read(path) {
      const post = await posts.findByTargetPath(path);
      if (post) return post.source;
      const staticContent = staticFiles[path];
      if (staticContent !== undefined) return staticContent;
      throw new NotFoundError('文章不存在');
    },
    async list(path) {
      const normalizedPath = path.replace(/\/+$/, '');
      const collection = normalizedPath.startsWith('content/stories') ? 'stories' : 'blog';
      const all = await posts.listPublished(collection);
      const list = all
        .filter((item) => item.targetPath.startsWith(`${normalizedPath}/`))
        .map((item) => ({
          name: item.targetPath.split('/').pop() ?? item.slug,
          path: item.targetPath,
          type: 'file' as const,
          sha: item.sourceHash,
          size: item.sourceBytes,
        }));
      const seenPaths = new Set(list.map((item) => item.path));
      for (const [filePath, content] of Object.entries(staticFiles)) {
        if (filePath.startsWith(`${normalizedPath}/`) && !seenPaths.has(filePath)) {
          const bytes = new TextEncoder().encode(content);
          list.push({
            name: filePath.split('/').pop() ?? filePath,
            path: filePath,
            type: 'file' as const,
            sha: await sha256Hex(content),
            size: bytes.length,
          });
        }
      }
      return list;
    },
    async sha(path) {
      const post = await posts.findByTargetPath(path);
      if (post) return post.sourceHash;
      const staticContent = staticFiles[path];
      if (staticContent !== undefined) return sha256Hex(staticContent);
      return null;
    },
  };
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
