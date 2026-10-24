import type { CloudflareEnv } from '../../../env.d';
import { resolveExistingContentTarget } from '../../../lib/content-routing';
import { parseSourceDocument } from '../../../lib/content-source';
import { AppError } from '../../errors';
import { renderMarkdownToHtml } from './markdown';
import { postRepository } from './post-repository';

export type PublishWriteResult =
  | { kind: 'committed'; blobSha: string; commitSha: string }
  | { kind: 'conflict' | 'failed' | 'unknown'; errorCode?: string };

export interface PublicationWriter {
  write(input: {
    path: string;
    source: string;
    expectedBlobSha: string | null;
    operationId: string;
    actorId?: string;
  }): Promise<PublishWriteResult>;
  reconcile(input: {
    path: string;
    source: string;
    operationId: string;
  }): Promise<{ blobSha: string; commitSha: string } | null>;
}

function encodeBase64(source: string): string {
  const bytes = new TextEncoder().encode(source);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

async function gitBlobSha(source: string): Promise<string> {
  // Git blob SHA 包含类型与字节长度前缀，不等于正文的普通 SHA-1。
  const bytes = new TextEncoder().encode(source);
  const prefix = new TextEncoder().encode(`blob ${bytes.length}\0`);
  const input = new Uint8Array(prefix.length + bytes.length);
  input.set(prefix);
  input.set(bytes, prefix.length);
  const hash = await crypto.subtle.digest('SHA-1', input);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** GitHub Contents API 写入只存在于服务端；操作 ID 写进提交消息以供超时对账。 */
export function githubPublicationWriter(
  env: CloudflareEnv,
  fetcher: typeof fetch = fetch,
): PublicationWriter {
  const repository = env.CMS_GITHUB_REPO;
  const branch = env.CMS_GITHUB_BRANCH;
  const token = env.CMS_GITHUB_TOKEN;
  if (!repository || !/^[\w.-]+\/[\w.-]+$/.test(repository) || !branch || !token) {
    throw new AppError('CMS GitHub 发布配置尚未完成', 503, 'CMS_NOT_CONFIGURED');
  }
  const base = `https://api.github.com/repos/${repository}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'imiles-cms',
  };
  const pathUrl = (path: string) =>
    `${base}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
  return {
    async write({ path, source, expectedBlobSha, operationId }) {
      let response: Response;
      try {
        response = await fetcher(pathUrl(path), {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `content: publish ${path} [cms-operation:${operationId}]`,
            content: encodeBase64(source),
            branch,
            ...(expectedBlobSha ? { sha: expectedBlobSha } : {}),
          }),
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        });
      } catch {
        // 请求可能已经被 GitHub 执行；仅对账，不自动再次提交。
        return { kind: 'unknown' };
      }
      if (response.status === 409 || response.status === 422) {
        let msg = '';
        try {
          const body = (await response.json()) as { message?: string };
          if (body?.message) msg = `: ${body.message}`;
        } catch {
          // ignore
        }
        return { kind: 'conflict', errorCode: `GITHUB_${response.status}_CONFLICT${msg}` };
      }
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        let msg = '';
        try {
          const body = (await response.json()) as { message?: string };
          if (body?.message) msg = `: ${body.message}`;
        } catch {
          // ignore
        }
        return { kind: 'failed', errorCode: `GITHUB_${response.status}${msg}` };
      }
      if (!response.ok) {
        let msg = '';
        try {
          const body = (await response.json()) as { message?: string };
          if (body?.message) msg = `: ${body.message}`;
        } catch {
          // ignore
        }
        return { kind: 'unknown', errorCode: `GITHUB_${response.status}${msg}` };
      }
      try {
        const data = (await response.json()) as {
          content?: { sha?: unknown };
          commit?: { sha?: unknown };
        };
        if (typeof data.content?.sha === 'string' && typeof data.commit?.sha === 'string') {
          return { kind: 'committed', blobSha: data.content.sha, commitSha: data.commit.sha };
        }
      } catch {
        // GitHub 可能已提交，但响应损坏；保留快照供对账。
      }
      return { kind: 'unknown' };
    },
    async reconcile({ path, source, operationId }) {
      // 先定位操作提交，再核对该提交中的文件版本与固定快照，不能只凭当前文件内容确认。
      const query = new URLSearchParams({ path, sha: branch, per_page: '30' });
      const response = await fetcher(`${base}/commits?${query}`, {
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new AppError('GitHub 对账查询失败', 502, 'CMS_RECONCILE_ERROR');
      const commits = (await response.json()) as Array<{
        sha?: unknown;
        commit?: { message?: unknown };
      }>;
      if (!Array.isArray(commits))
        throw new AppError('GitHub 对账响应无效', 502, 'CMS_RECONCILE_ERROR');
      const found = commits.find(
        (item) =>
          typeof item.commit?.message === 'string' &&
          item.commit.message.includes(`[cms-operation:${operationId}]`),
      );
      if (typeof found?.sha !== 'string') return null;
      const version = await fetcher(`${pathUrl(path)}?ref=${encodeURIComponent(found.sha)}`, {
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      });
      if (!version.ok) throw new AppError('无法验证发布提交内容', 502, 'CMS_RECONCILE_ERROR');
      const file = (await version.json()) as { sha?: unknown };
      const expected = await gitBlobSha(source);
      if (file.sha !== expected)
        throw new AppError('发布提交内容与固定快照不一致', 502, 'CMS_RECONCILE_ERROR');
      return { blobSha: expected, commitSha: found.sha };
    },
  };
}

/** D1 持久化发布适配器：直接将文章原子写入 D1 数据库的 cms_posts 表。 */
export function d1PublicationWriter(env: CloudflareEnv): PublicationWriter {
  const posts = postRepository(env);
  return {
    async write({ path, source, expectedBlobSha, actorId }) {
      const parsed = parseSourceDocument(source);
      const collection = path.startsWith('content/stories/') ? 'stories' : 'blog';
      const lang = parsed.fields.lang === 'zh' ? 'zh' : 'en';
      const target = resolveExistingContentTarget(collection, lang, path);
      const sourceBytes = new TextEncoder().encode(source).length;
      const sourceHash = await gitBlobSha(source);

      const existing = await posts.findByTargetPath(path, { includeArchived: true });
      if (expectedBlobSha && existing && existing.sourceHash !== expectedBlobSha) {
        return { kind: 'conflict', errorCode: 'BLOB_SHA_MISMATCH' };
      }

      const actor = actorId || 'admin';
      const contentHtml = renderMarkdownToHtml(parsed.body);
      const post = await posts.upsert({
        collection,
        format: path.endsWith('.mdx') ? 'mdx' : 'md',
        lang,
        slug: target.slug,
        targetPath: path,
        publicPath: target.publicPath,
        title: typeof parsed.fields.title === 'string' ? parsed.fields.title : target.slug,
        description:
          typeof parsed.fields.description === 'string' ? parsed.fields.description : null,
        pubDate: parsed.fields.pubDate
          ? new Date(String(parsed.fields.pubDate)).getTime()
          : Date.now(),
        updatedDate: parsed.fields.updatedDate
          ? new Date(String(parsed.fields.updatedDate)).getTime()
          : null,
        tags: JSON.stringify(Array.isArray(parsed.fields.tags) ? parsed.fields.tags : []),
        heroImage: typeof parsed.fields.heroImage === 'string' ? parsed.fields.heroImage : null,
        shareText: typeof parsed.fields.shareText === 'string' ? parsed.fields.shareText : null,
        llms: Boolean(parsed.fields.llms),
        contentRaw: parsed.body,
        contentHtml,
        source,
        sourceHash,
        sourceBytes,
        draftId: null,
        status: 'published',
        createdBy: actor,
        updatedBy: actor,
      });

      return {
        kind: 'committed',
        blobSha: sourceHash,
        commitSha: `d1:${post.id}`,
      };
    },
    async reconcile({ path }) {
      const post = await posts.findByTargetPath(path);
      if (!post) return null;
      return {
        blobSha: post.sourceHash,
        commitSha: `d1:${post.id}`,
      };
    },
  };
}
