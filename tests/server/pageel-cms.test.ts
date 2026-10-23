import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentPath, requireReadAction } from '../../src/server/admin/cms/policy';
import { githubRepository, snapshotRepository } from '../../src/server/admin/cms/repository';
import { readCmsOperation } from '../../src/server/admin/cms/service';

test('CMS protocol rejects every mutation, config write and unknown action', () => {
  for (const action of [
    'updateFileContent',
    'createFileFromString',
    'deleteFile',
    'uploadFile',
    'setConfig',
    'constructor',
    null,
  ]) {
    assert.throws(() => requireReadAction(action), /禁止保存/);
  }
  assert.equal(requireReadAction('getFileContent'), 'getFileContent');
});

test('content boundary rejects traversal, query injection and non-content files', () => {
  for (const path of [
    'content/blog/../stories/a.md',
    'content/blog/%2e%2e/a.md',
    'content/blog/a.md?ref=main',
    'content/blog/a.md#x',
    '/content/blog/a.md',
    'content/blog//a.md',
    'content/blog/a\0.md',
    '.env',
    'content/stories/a.mdx',
    'content/experience/a.mdx',
  ]) {
    assert.throws(() => contentPath(path));
  }
  assert.equal(contentPath('content/blog/中文.mdx'), 'content/blog/中文.mdx');
});

test('snapshot is read-only and scoped by collection, with unique identities', async () => {
  const repo = snapshotRepository({
    'content/blog/a.md': '# A',
    'content/blog/b.mdx': '# B',
    'content/stories/c.md': 'C',
  });
  const list = await repo.list('content/blog');
  assert.equal(list.length, 2);
  assert.notEqual(list[0].sha, list[1].sha);
  assert.equal(
    await readCmsOperation(repo, 'getFileContent', { path: 'content/blog/a.md' }),
    '# A',
  );
  await assert.rejects(
    readCmsOperation(repo, 'updateFileContent', {
      path: 'content/blog/a.md',
      content: 'overwrite',
    }),
  );
  assert.equal(await repo.read('content/blog/a.md'), '# A');
});

test('virtual CMS config does not read or expose arbitrary repository configuration', async () => {
  const repo = snapshotRepository({});
  const config = JSON.parse(
    String(await readCmsOperation(repo, 'getFileContent', { path: '.pageelrc.json' })),
  );
  assert.deepEqual(
    config.collections.map((c: { id: string }) => c.id),
    ['blog', 'stories'],
  );
  await assert.rejects(
    readCmsOperation(repo, 'getFileContent', { path: '.github/workflows/deploy.yml' }),
  );
});

test('GitHub reads use explicit branch and server token; upstream error bodies are not disclosed', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = (async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({ encoding: 'base64', content: btoa('hello'), sha: 'abc' });
  }) as typeof fetch;
  const env = {
    CMS_GITHUB_REPO: 'owner/repo',
    CMS_GITHUB_BRANCH: 'cms/test',
    CMS_GITHUB_TOKEN: 'server-only-test',
  };
  const repo = githubRepository(env, fetcher);
  assert.equal(await repo.read('content/blog/a.md'), 'hello');
  assert.equal(new URL(calls[0].url).searchParams.get('ref'), 'cms/test');
  assert.equal(new Headers(calls[0].init?.headers).get('Authorization'), 'Bearer server-only-test');
  assert.equal(calls[0].init?.redirect, 'error');
  const failed = githubRepository(
    env,
    (async () => new Response('SECRET UPSTREAM BODY', { status: 403 })) as typeof fetch,
  );
  await assert.rejects(
    failed.sha('content/blog/a.md'),
    (error: Error) => !error.message.includes('SECRET') && error.message.includes('GitHub'),
  );
  assert.throws(() => githubRepository({}), /配置尚未完成/);
});

test('GitHub 文件列表递归发现代码新增的嵌套 MDX', async () => {
  const repo = {
    mode: 'github' as const,
    read: async () => '',
    sha: async () => null,
    list: async (path: string) =>
      path === 'content/blog'
        ? [{ name: 'notes', path: 'content/blog/notes', type: 'dir' as const, sha: '', size: 0 }]
        : [
            {
              name: 'new.mdx',
              path: 'content/blog/notes/new.mdx',
              type: 'file' as const,
              sha: 'new',
              size: 10,
            },
          ],
  };
  const entries = await readCmsOperation(repo, 'listFiles', { path: 'content/blog' });
  assert.ok(Array.isArray(entries));
  assert.ok(
    entries.some(
      (entry) => typeof entry !== 'string' && entry.path === 'content/blog/notes/new.mdx',
    ),
  );
});
