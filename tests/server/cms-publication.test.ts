import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { getPlatformProxy, type PlatformProxy } from 'wrangler';
import { documentService } from '../../src/server/admin/cms/document-service';
import { publicationRepository } from '../../src/server/admin/cms/publication-repository';
import { publicationService } from '../../src/server/admin/cms/publication-service';
import type { PublicationWriter } from '../../src/server/admin/cms/publisher';
import { githubPublicationWriter } from '../../src/server/admin/cms/publisher';
import { snapshotRepository } from '../../src/server/admin/cms/repository';
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

const source =
  '---\ntitle: "草稿"\ndescription: "摘要"\npubDate: "2026-10-23"\ntags: ["blog"]\nlang: "zh"\ndraft: true\n---\n\n正文\n';

test('发布固定快照、幂等复用操作 ID，Git 已提交后关闭本轮草稿', async () => {
  const content = snapshotRepository({});
  const draft = await documentService(platform.env, () => content).createDraft(
    { collection: 'blog', lang: 'zh', slug: 'publish-ok', source },
    'user:test',
  );
  let writes = 0;
  const writer: PublicationWriter = {
    async write(input) {
      writes++;
      assert.equal(input.expectedBlobSha, null);
      assert.match(input.source, /draft: false/);
      return { kind: 'committed', blobSha: 'blob-ok', commitSha: 'commit-ok' };
    },
    async reconcile() {
      return null;
    },
  };
  const service = publicationService(platform.env, content, writer);
  const operationId = crypto.randomUUID();
  const result = await service.publish(draft.id, 1, operationId, 'user:test');
  assert.equal(result.status, 'committed');
  assert.equal(result.deploymentStatus, 'unverified');
  assert.equal((await service.publish(draft.id, 1, operationId, 'user:test')).status, 'committed');
  assert.equal(writes, 1);
  const persisted = await publicationRepository(platform.env).get(operationId);
  assert.match(persisted.sourceSnapshot ?? '', /draft: false/);
  const operations = publicationRepository(platform.env);
  const verified = await operations.recordDeployment(operationId, {
    status: 'verified',
    ref: '42',
    deployedAt: 1792800000000,
  });
  assert.equal(verified.deploymentStatus, 'verified');
  assert.equal(verified.deploymentRef, '42');
  const unverified = await operations.recordDeployment(operationId, {
    status: 'unverified',
    ref: null,
    deployedAt: null,
  });
  assert.equal(unverified.deploymentStatus, 'unverified');
  assert.equal(unverified.deploymentRef, null);
  assert.equal(
    (await operations.latestCommittedForPath(draft.targetPath))?.operationId,
    operationId,
  );
  assert.equal(await operations.latestCommittedForPath('content/blog/other.mdx'), null);
  assert.equal(
    (await documentService(platform.env, () => content).getDraft(draft.id)).status,
    'published',
  );
});

test('未知 Git 结果只用原操作对账，不重复写入', async () => {
  const content = snapshotRepository({});
  const draft = await documentService(platform.env, () => content).createDraft(
    { collection: 'blog', lang: 'zh', slug: 'publish-unknown', source },
    'user:test',
  );
  let writes = 0;
  let confirmed = false;
  const writer: PublicationWriter = {
    async write() {
      writes++;
      return { kind: 'unknown' };
    },
    async reconcile() {
      return confirmed ? { blobSha: 'blob-reconciled', commitSha: 'commit-reconciled' } : null;
    },
  };
  const service = publicationService(platform.env, content, writer);
  const operationId = crypto.randomUUID();
  assert.equal((await service.publish(draft.id, 1, operationId, 'user:test')).status, 'unknown');
  assert.equal((await service.publish(draft.id, 1, operationId, 'user:test')).status, 'unknown');
  confirmed = true;
  assert.equal((await service.publish(draft.id, 1, operationId, 'user:test')).status, 'committed');
  assert.equal(writes, 1);
});

test('发布待对账时不能废弃草稿', async () => {
  const content = snapshotRepository({});
  const docs = documentService(platform.env, () => content);
  const draft = await docs.createDraft(
    { collection: 'blog', lang: 'zh', slug: 'discard-pending-publish', source },
    'user:test',
  );
  const writer: PublicationWriter = {
    async write() {
      return { kind: 'unknown' };
    },
    async reconcile() {
      return null;
    },
  };
  const result = await publicationService(platform.env, content, writer).publish(
    draft.id,
    1,
    crypto.randomUUID(),
    'user:test',
  );
  assert.equal(result.status, 'unknown');
  await assert.rejects(docs.discardDraft(draft.id, 1, 'user:test'), { code: 'CONFLICT' });
});

test('发布期间保存的新修订保持活动草稿，并以提交后的 blob 为下次发布基准', async () => {
  const content = snapshotRepository({});
  const docs = documentService(platform.env, () => content);
  const draft = await docs.createDraft(
    { collection: 'blog', lang: 'zh', slug: 'publish-later-edit', source },
    'user:test',
  );
  const writer: PublicationWriter = {
    async write() {
      await docs.saveDraft(draft.id, 1, `${source}\n新编辑`, 'user:test');
      return { kind: 'committed', blobSha: 'blob-next', commitSha: 'commit-next' };
    },
    async reconcile() {
      return null;
    },
  };
  const result = await publicationService(platform.env, content, writer).publish(
    draft.id,
    1,
    crypto.randomUUID(),
    'user:test',
  );
  assert.equal(result.status, 'committed');
  const stillActive = await docs.getDraft(draft.id);
  assert.equal(stillActive.status, 'active');
  assert.equal(stillActive.revision, 2);
  assert.equal(stillActive.baseBlobSha, 'blob-next');
});

test('发布校验拒绝缺少文章属性与 Stories 图片', async () => {
  const content = snapshotRepository({});
  const writer: PublicationWriter = {
    async write() {
      throw new Error('不应写 Git');
    },
    async reconcile() {
      return null;
    },
  };
  const invalid = await documentService(platform.env, () => content).createDraft(
    {
      collection: 'blog',
      lang: 'en',
      slug: 'publish-invalid',
      source: '---\ntitle: ""\n---\n正文',
    },
    'user:test',
  );
  await assert.rejects(
    publicationService(platform.env, content, writer).publish(
      invalid.id,
      1,
      crypto.randomUUID(),
      'user:test',
    ),
    { code: 'VALIDATION_ERROR' },
  );
  const story = await documentService(platform.env, () => content).createDraft(
    {
      collection: 'stories',
      lang: 'en',
      slug: 'publish-story-image',
      source:
        '---\ntitle: "Story"\ndescription: "Text"\npubDate: "2026-10-23"\ntags: []\n---\n\n![x](/images/blog/x.png)',
    },
    'user:test',
  );
  await assert.rejects(
    publicationService(platform.env, content, writer).publish(
      story.id,
      1,
      crypto.randomUUID(),
      'user:test',
    ),
    { code: 'VALIDATION_ERROR' },
  );
});

test('已有 Stories 的中文与空格标签可发布，符合 Astro 内容 schema', async () => {
  const storySource =
    '---\ntitle: "片段"\ndescription: "故事"\npubDate: "2026-03-22"\ntags: ["小说", "short story"]\n---\n\n正文';
  const content = snapshotRepository({ 'content/stories/legacy-story.md': storySource });
  const draft = await documentService(platform.env, () => content).createDraft(
    {
      collection: 'stories',
      lang: 'en',
      slug: 'legacy-story',
      format: 'md',
      path: 'content/stories/legacy-story.md',
      baseBlobSha: 'snapshot:content/stories/legacy-story.md',
      source: storySource,
    },
    'user:test',
  );
  const writer: PublicationWriter = {
    async write() {
      return { kind: 'committed', blobSha: 'story-next', commitSha: 'story-commit' };
    },
    async reconcile() {
      return null;
    },
  };
  const result = await publicationService(platform.env, content, writer).publish(
    draft.id,
    1,
    crypto.randomUUID(),
    'user:test',
  );
  assert.equal(result.status, 'committed');
});

test('不同文件名归一化到同一中文 Blog URL 时阻止发布', async () => {
  const content = snapshotRepository({ 'content/blog/url-collision.md': source });
  const draft = await documentService(platform.env, () => content).createDraft(
    { collection: 'blog', lang: 'zh', slug: 'url-collision', source },
    'user:test',
  );
  const writer: PublicationWriter = {
    async write() {
      throw new Error('不得提交');
    },
    async reconcile() {
      return null;
    },
  };
  await assert.rejects(
    publicationService(platform.env, content, writer).publish(
      draft.id,
      1,
      crypto.randomUUID(),
      'user:test',
    ),
    { code: 'CONFLICT' },
  );
});

test('GitHub 条件写入使用固定分支和 blob SHA，操作 ID 可按提交内容对账', async () => {
  const operationId = crypto.randomUUID();
  const path = 'content/blog/github-write.mdx';
  const expectedSource = '---\ntitle: test\n---\n正文';
  const bytes = Buffer.from(expectedSource);
  const blobSha = createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`))
    .update(bytes)
    .digest('hex');
  let writes = 0;
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    if (init?.method === 'PUT') {
      writes++;
      assert.match(url, /\/contents\/content\/blog\/github-write\.mdx$/);
      const body = JSON.parse(String(init.body));
      assert.equal(body.branch, 'main');
      assert.equal(body.sha, 'base-blob');
      assert.equal(Buffer.from(body.content, 'base64').toString(), expectedSource);
      assert.match(body.message, new RegExp(operationId));
      return Response.json(
        { content: { sha: blobSha }, commit: { sha: 'commit-sha' } },
        { status: 200 },
      );
    }
    if (url.includes('/commits?'))
      return Response.json([
        { sha: 'commit-sha', commit: { message: `[cms-operation:${operationId}]` } },
      ]);
    if (url.includes('?ref=commit-sha')) return Response.json({ sha: blobSha });
    throw new Error(`意外请求：${url}`);
  };
  const writer = githubPublicationWriter(
    {
      ...platform.env,
      CMS_GITHUB_REPO: 'owner/repo',
      CMS_GITHUB_BRANCH: 'main',
      CMS_GITHUB_TOKEN: 'test-token',
    },
    fetcher,
  );
  const written = await writer.write({
    path,
    source: expectedSource,
    expectedBlobSha: 'base-blob',
    operationId,
  });
  assert.deepEqual(written, { kind: 'committed', blobSha, commitSha: 'commit-sha' });
  assert.equal(writes, 1);
  assert.deepEqual(await writer.reconcile({ path, source: expectedSource, operationId }), {
    blobSha,
    commitSha: 'commit-sha',
  });
});
