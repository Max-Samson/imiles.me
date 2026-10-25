import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { getPlatformProxy, type PlatformProxy } from 'wrangler';
import { composeDraftSource } from '../../packages/pageel-workbench/integration/draft-source';
import {
  inspectImportedContent,
  resolveImportedDraftTarget,
  suggestedImportSlug,
} from '../../packages/pageel-workbench/integration/import-content';
import { documentService } from '../../src/server/admin/cms/document-service';
import { snapshotRepository } from '../../src/server/admin/cms/repository';
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
  ]) {
    const sql = readFileSync(`drizzle/migrations/${migration}`, 'utf8');
    for (const statement of sql.split('--> statement-breakpoint').filter((part) => part.trim())) {
      await platform.env.DB.prepare(statement).run();
    }
  }
});
after(async () => platform?.dispose());

test('D1 草稿多次保存、重开、列表摘要与乐观并发冲突', async () => {
  const service = documentService(platform.env, () => snapshotRepository({}));
  const input = {
    collection: 'blog' as const,
    lang: 'zh' as const,
    slug: 'cms-draft-test',
    source: '---\ntitle: "初稿"\n---\n\n正文',
  };
  const created = await service.createDraft(input, 'user:test');
  assert.equal(created.revision, 1);
  assert.equal(created.targetPath, 'content/blog/cms-draft-test-zh.mdx');
  assert.equal(created.publicPath, '/zh/blog/cms-draft-test');
  assert.equal((await service.getDraft(created.id)).source, input.source);
  const updated = await service.saveDraft(created.id, 1, `${input.source}\n修改`, 'user:test');
  assert.equal(updated.revision, 2);
  assert.equal(updated.sourceBytes, new TextEncoder().encode(updated.source).length);
  await assert.rejects(service.saveDraft(created.id, 1, '旧窗口覆盖', 'user:test'), {
    code: 'CONFLICT',
  });
  await assert.rejects(service.createDraft(input, 'user:test'), { code: 'CONFLICT' });
  const listed = await service.listDrafts();
  assert.equal(listed.length, 1);
  assert.equal('source' in listed[0], false);
});

test('已有仓库文章以同次读取的 blob SHA 建立二次编辑草稿', async () => {
  const repository = snapshotRepository({ 'content/stories/fragment.md': '原文' });
  const service = documentService(platform.env, () => repository);
  await assert.rejects(
    service.createDraft(
      {
        collection: 'stories',
        lang: 'en',
        slug: 'fragment',
        path: 'content/stories/fragment.md',
        baseBlobSha: 'old',
        source: '草稿',
      },
      'user:test',
    ),
    { code: 'CONFLICT' },
  );
  const version = await repository.readVersion('content/stories/fragment.md');
  const draft = await service.createDraft(
    {
      collection: 'stories',
      lang: 'en',
      slug: 'fragment',
      path: 'content/stories/fragment.md',
      baseBlobSha: version.blobSha,
      source: '草稿',
    },
    'user:test',
  );
  assert.equal(draft.baseBlobSha, version.blobSha);
  assert.equal(await repository.read('content/stories/fragment.md'), '原文');

  // 废弃活动草稿后，未显式提供 baseBlobSha 时自动采用库中当前基线版本建立新草稿
  await service.discardDraft(draft.id, draft.revision, 'user:test');
  const draftWithoutSha = await service.createDraft(
    {
      collection: 'stories',
      lang: 'en',
      slug: 'fragment',
      path: 'content/stories/fragment.md',
      source: '草稿二',
    },
    'user:test',
  );
  assert.equal(draftWithoutSha.baseBlobSha, version.blobSha);
});

test('中文文件名导入后指定地址标识，草稿可保存并重开', async () => {
  const filename = '从 0 到被 Google 看见：AI 时代的 SEO 生存指南.md';
  const original = '---\ntitle: "从 0 到被 Google 看见"\n---\n\n正文';
  const inspected = inspectImportedContent(filename, original, 'blog');
  assert.equal(suggestedImportSlug(filename, inspected.frontmatter), '');
  const target = resolveImportedDraftTarget('blog', 'zh', filename, 'google-seo-guide');
  const source = composeDraftSource(
    inspected.rawContent,
    inspected.frontmatter,
    { ...inspected.frontmatter, lang: 'zh' },
    inspected.body,
    false,
  );
  const service = documentService(platform.env, () => snapshotRepository({}));
  const created = await service.createDraft(
    {
      collection: target.collection,
      lang: target.lang,
      slug: target.slug,
      format: target.format,
      source,
    },
    'user:test',
  );
  assert.equal(created.targetPath, 'content/blog/google-seo-guide-zh.md');
  assert.equal((await service.getDraft(created.id)).source, source);
  assert.match(source, /lang: "zh"/);
});
