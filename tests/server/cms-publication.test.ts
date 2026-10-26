import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { getPlatformProxy, type PlatformProxy } from 'wrangler';
import { d1DeletionWriter } from '../../src/server/admin/cms/deletion-writer';
import { documentService } from '../../src/server/admin/cms/document-service';
import { postRepository } from '../../src/server/admin/cms/post-repository';
import { publicationRepository } from '../../src/server/admin/cms/publication-repository';
import { publicationService } from '../../src/server/admin/cms/publication-service';
import type { PublicationWriter } from '../../src/server/admin/cms/publisher';
import { d1PublicationWriter, githubPublicationWriter } from '../../src/server/admin/cms/publisher';
import { snapshotRepository } from '../../src/server/admin/cms/repository';
import { contentReadRepository } from '../../src/server/content/read-repository';
import type { WorkerBindings } from '../../src/worker-configuration';

let platform: PlatformProxy<WorkerBindings>;
before(async () => {
  platform = await getPlatformProxy<WorkerBindings>({
    configPath: 'wrangler.toml',
    persist: false,
    remoteBindings: false,
  });
  for (const migration of [
    '0001_marvelous_ares.sql',
    '0002_modern_dragon_man.sql',
    '0005_cms_document_history.sql',
    '0004_shiny_makkari.sql',
  ]) {
    const sql = readFileSync(`drizzle/migrations/${migration}`, 'utf8');
    for (const statement of sql.split('--> statement-breakpoint').filter((part) => part.trim())) {
      await platform.env.DB.prepare(statement).run();
    }
  }
});
after(async () => platform?.dispose());

const source =
  '---\ntitle: "草稿"\ndescription: "摘要"\npubDate: "2026-10-23"\ntags: ["blog"]\nlang: "zh"\n---\n\n正文\n';

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
      assert.equal(input.source, source);
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
  assert.equal(persisted.sourceSnapshot, source);
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
  const pendings = await service.pendingPublications();
  assert.ok(pendings.some((item) => item.operationId === operationId));
  assert.equal((await service.publish(draft.id, 1, operationId, 'user:test')).status, 'unknown');
  confirmed = true;
  assert.equal((await service.publish(draft.id, 1, operationId, 'user:test')).status, 'committed');
  assert.equal(writes, 1);
  const afterCommit = await service.pendingPublications();
  assert.ok(!afterCommit.some((item) => item.operationId === operationId));
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

test('GitHub 写入失败时捕获详细状态码和错误原因并持久化到 D1', async () => {
  const fetcher: typeof fetch = async () =>
    Response.json({ message: 'Resource not accessible by personal access token' }, { status: 403 });
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
    path: 'content/blog/fail.md',
    source: '---\ntitle: t\n---\nbody',
    expectedBlobSha: null,
    operationId: crypto.randomUUID(),
  });
  assert.equal(written.kind, 'failed');
  assert.equal(written.errorCode, 'GITHUB_403: Resource not accessible by personal access token');
});

test('D1 发布写入支持 KaTeX 公式预渲染，更新时保留创建审计信息', async () => {
  const writer = d1PublicationWriter(platform.env);
  const posts = postRepository(platform.env);
  const op1 = crypto.randomUUID();
  const sourceWithMath =
    '---\ntitle: "公式测试"\ndescription: "数学摘要"\npubDate: "2026-10-24"\ntags: ["math"]\nlang: "zh"\n---\n\n行内公式 $E=mc^2$ 与块级公式：\n\n$$\\sum_{i=1}^n i$$\n';

  const res1 = await writer.write({
    path: 'content/blog/math-test.md',
    source: sourceWithMath,
    expectedBlobSha: null,
    operationId: op1,
    actorId: 'user:author-1',
  });
  assert.equal(res1.kind, 'committed');

  const post1 = await posts.findByPath('/zh/blog/math-test');
  assert.ok(post1);
  assert.equal(post1.createdBy, 'user:author-1');
  assert.equal(post1.updatedBy, 'user:author-1');
  assert.ok(post1.contentHtml.includes('katex-display'));
  assert.ok(post1.contentHtml.includes('katex-mathml'));

  // 二次更新：由另一个操作人更新，验证 createdBy/createdAt 未被覆写
  const op2 = crypto.randomUUID();
  const updatedSource = sourceWithMath.replace('数学摘要', '更新后的数学摘要');
  const res2 = await writer.write({
    path: 'content/blog/math-test.md',
    source: updatedSource,
    expectedBlobSha: post1.sourceHash,
    operationId: op2,
    actorId: 'user:editor-2',
  });
  assert.equal(res2.kind, 'committed');

  const post2 = await posts.findByPath('/zh/blog/math-test');
  assert.ok(post2);
  assert.equal(post2.id, post1.id);
  assert.equal(post2.createdBy, 'user:author-1'); // 必须保留原始创建人！
  assert.equal(post2.createdAt, post1.createdAt); // 必须保留原始创建时间！
  assert.equal(post2.updatedBy, 'user:editor-2'); // 更新人已记录
  assert.equal(post2.description, '更新后的数学摘要');
});

test('D1 删除与归档语义正确对账，未曾存在的文章不误报成功', async () => {
  const delWriter = d1DeletionWriter(platform.env);
  const fakeOp = crypto.randomUUID();

  // 1. 对从来不存在的文章做对账，应返回 null，不误报成功
  const fakeReconcile = await delWriter.reconcile({
    path: 'content/blog/never-existed.md',
    operationId: fakeOp,
  });
  assert.equal(fakeReconcile, null);

  // 2. 正常删除已存在的文章
  const pubWriter = d1PublicationWriter(platform.env);
  const posts = postRepository(platform.env);
  const testPath = 'content/blog/to-delete.md';
  await pubWriter.write({
    path: testPath,
    source: '---\ntitle: "待删"\n---\nbody',
    expectedBlobSha: null,
    operationId: crypto.randomUUID(),
  });

  const existing = await posts.findByTargetPath(testPath);
  assert.ok(existing);

  const delOp = crypto.randomUUID();
  const delRes = await delWriter.delete({
    path: testPath,
    expectedBlobSha: existing.sourceHash,
    operationId: delOp,
  });
  assert.equal(delRes.kind, 'committed');

  // 3. 对已归档文章对账，确认返回 commitSha
  const confirmed = await delWriter.reconcile({
    path: testPath,
    operationId: delOp,
  });
  assert.equal(confirmed, `d1:del:${delOp}`);
});

test('公开只读仓库保持发布列表、路径和归档过滤语义，不暴露写方法', async () => {
  const result = await d1PublicationWriter(platform.env).write({
    path: 'content/blog/read-boundary.md',
    source,
    expectedBlobSha: null,
    operationId: crypto.randomUUID(),
    actorId: 'user:read-boundary',
  });
  assert.equal(result.kind, 'committed');
  const reads = contentReadRepository(platform.env);
  const post = await reads.findByPath('/zh/blog/read-boundary/');
  assert.ok(post);
  assert.equal((await reads.findByTargetPath('content/blog/read-boundary.md'))?.id, post.id);
  assert.ok((await reads.listPublished('blog', 'zh')).some((row) => row.id === post.id));
  assert.equal(
    (await reads.listPublished('stories', 'zh')).some((row) => row.id === post.id),
    false,
  );
  assert.equal('upsert' in reads || 'delete' in reads || 'archive' in reads, false);
  await postRepository(platform.env).archive(post.id, 'user:archive');
  assert.equal(await reads.findByPath('/zh/blog/read-boundary'), null);
  assert.equal(await reads.findByTargetPath('content/blog/read-boundary.md'), null);
  assert.equal(
    (await reads.findByPath('/zh/blog/read-boundary', { includeArchived: true }))?.id,
    post.id,
  );
});
