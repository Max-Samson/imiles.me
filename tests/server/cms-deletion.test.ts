import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { getPlatformProxy, type PlatformProxy } from 'wrangler';
import { deletionService } from '../../src/server/admin/cms/deletion-service';
import {
  type DeletionWriter,
  githubDeletionWriter,
} from '../../src/server/admin/cms/deletion-writer';
import { documentService } from '../../src/server/admin/cms/document-service';
import type { CmsRepository } from '../../src/server/admin/cms/repository';
import type { WorkerBindings } from '../../src/worker-configuration';

let platform: PlatformProxy<WorkerBindings>;
before(async () => {
  platform = await getPlatformProxy<WorkerBindings>({
    configPath: 'wrangler.toml',
    persist: false,
    remoteBindings: false,
  });
  for (const migration of ['0001_marvelous_ares.sql', '0002_modern_dragon_man.sql']) {
    const sql = readFileSync(`drizzle/migrations/${migration}`, 'utf8');
    for (const statement of sql.split('--> statement-breakpoint').filter((part) => part.trim())) {
      await platform.env.DB.prepare(statement).run();
    }
  }
});
after(async () => platform?.dispose());

const path = 'content/blog/delete-test.mdx';
const blobSha = 'a'.repeat(40);
const source =
  '---\ntitle: Delete test\ndescription: Test\npubDate: 2026-10-23\ntags: []\n---\nBody';
const content: CmsRepository = {
  mode: 'github',
  async readVersion() {
    return { content: source, blobSha };
  },
  async read() {
    return source;
  },
  async list() {
    return [];
  },
  async sha() {
    return blobSha;
  },
};

test('草稿废弃需匹配修订，保留审计且不删除仓库文章', async () => {
  const docs = documentService(platform.env, () => content);
  const draft = await docs.createDraft(
    { collection: 'blog', lang: 'en', slug: 'delete-test', path, baseBlobSha: blobSha, source },
    'user:test',
  );
  await assert.rejects(docs.discardDraft(draft.id, 2, 'user:test'), { code: 'CONFLICT' });
  const discarded = await docs.discardDraft(draft.id, 1, 'user:test');
  assert.equal(discarded.status, 'discarded');
  assert.equal((await docs.getDraft(draft.id)).status, 'discarded');
  assert.equal(await content.sha(path), blobSha);
});

test('仓库删除固定 SHA 和操作 ID，确认提交后幂等返回', async () => {
  let writes = 0;
  const writer: DeletionWriter = {
    async delete(input) {
      writes++;
      assert.equal(input.expectedBlobSha, blobSha);
      return { kind: 'committed', commitSha: 'delete-commit' };
    },
    async reconcile() {
      return null;
    },
  };
  const service = deletionService(platform.env, content, writer);
  const operationId = crypto.randomUUID();
  const first = await service.delete(path, blobSha, operationId, 'user:test');
  assert.equal(first.status, 'committed');
  assert.equal(first.resultCommitSha, 'delete-commit');
  assert.equal(first.deploymentStatus, 'unverified');
  assert.equal((await service.delete(path, blobSha, operationId, 'user:test')).status, 'committed');
  assert.equal(writes, 1);
});

test('存在活动 D1 草稿时拒绝删除 Git 文章', async () => {
  const docs = documentService(platform.env, () => content);
  const otherPath = 'content/blog/delete-with-draft.mdx';
  const draft = await docs.createDraft(
    {
      collection: 'blog',
      lang: 'en',
      slug: 'delete-with-draft',
      path: otherPath,
      baseBlobSha: blobSha,
      source,
    },
    'user:test',
  );
  const writer: DeletionWriter = {
    async delete() {
      throw new Error('活动草稿不得进入 Git 删除');
    },
    async reconcile() {
      return null;
    },
  };
  await assert.rejects(
    deletionService(platform.env, content, writer).delete(
      otherPath,
      blobSha,
      crypto.randomUUID(),
      'user:test',
    ),
    { code: 'CONFLICT' },
  );
  await docs.discardDraft(draft.id, 1, 'user:test');
});

test('删除结果未知时只用同一操作 ID 对账', async () => {
  const otherPath = 'content/blog/delete-unknown.mdx';
  let writes = 0;
  let confirmed = false;
  const writer: DeletionWriter = {
    async delete() {
      writes++;
      return { kind: 'unknown' };
    },
    async reconcile() {
      return confirmed ? 'delete-unknown-commit' : null;
    },
  };
  const service = deletionService(platform.env, content, writer);
  const operationId = crypto.randomUUID();
  assert.equal(
    (await service.delete(otherPath, blobSha, operationId, 'user:test')).status,
    'unknown',
  );
  assert.equal(
    (await service.delete(otherPath, blobSha, operationId, 'user:test')).status,
    'unknown',
  );
  confirmed = true;
  assert.equal(
    (await service.delete(otherPath, blobSha, operationId, 'user:test')).status,
    'committed',
  );
  assert.equal(writes, 1);
});

test('GitHub 删除使用固定分支和 SHA，并核对提交中的文件缺失', async () => {
  const operationId = crypto.randomUUID();
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    if (init?.method === 'DELETE') {
      const body = JSON.parse(String(init.body));
      assert.equal(body.sha, blobSha);
      assert.equal(body.branch, 'main');
      assert.match(body.message, new RegExp(operationId));
      return Response.json({ content: null, commit: { sha: 'commit-delete' } });
    }
    if (url.includes('/commits?'))
      return Response.json([
        { sha: 'commit-delete', commit: { message: `[cms-delete:${operationId}]` } },
      ]);
    if (url.includes('?ref=commit-delete')) return new Response(null, { status: 404 });
    throw new Error(`意外请求：${url}`);
  };
  const writer = githubDeletionWriter(
    {
      ...platform.env,
      CMS_GITHUB_REPO: 'owner/repo',
      CMS_GITHUB_BRANCH: 'main',
      CMS_GITHUB_TOKEN: 'test-token',
    },
    fetcher,
  );
  assert.deepEqual(await writer.delete({ path, expectedBlobSha: blobSha, operationId }), {
    kind: 'committed',
    commitSha: 'commit-delete',
  });
  assert.equal(await writer.reconcile({ path, operationId }), 'commit-delete');
});
