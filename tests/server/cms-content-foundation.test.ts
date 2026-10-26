import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { composeDraftSource } from '../../packages/pageel-workbench/integration/draft-source';
import {
  resolveImportedDraftTarget,
  suggestedImportSlug,
} from '../../packages/pageel-workbench/integration/import-content';
import {
  resolveExistingContentTarget,
  resolveNewContentTarget,
} from '../../src/lib/content-routing';
import { parseSourceDocument, updateSourceFields } from '../../src/lib/content-source';

test('新建文章目标与站点实际的中英文 URL 规则一致', () => {
  assert.deepEqual(resolveNewContentTarget({ collection: 'blog', lang: 'zh', slug: 'hello' }), {
    collection: 'blog',
    lang: 'zh',
    format: 'mdx',
    slug: 'hello',
    path: 'content/blog/hello-zh.mdx',
    entryId: 'hello-zh',
    publicPath: '/zh/blog/hello',
    publicUrl: 'https://imiles.me/zh/blog/hello',
  });
  assert.equal(
    resolveNewContentTarget({ collection: 'stories', lang: 'zh', slug: 'hello' }).publicPath,
    '/zh/stories/hello',
  );
  assert.equal(
    resolveExistingContentTarget('stories', 'zh', 'content/stories/fragments.md').publicPath,
    '/zh/stories/fragments',
  );
  for (const slug of ['', '../x', '含中文', 'a/b', 'A', 'a--b']) {
    assert.throws(() => resolveNewContentTarget({ collection: 'blog', lang: 'en', slug }));
  }
  assert.throws(() =>
    resolveNewContentTarget({ collection: 'stories', lang: 'en', slug: 'a', format: 'mdx' }),
  );
});

test('中文文件名导入后可指定英文地址标识保存草稿', () => {
  const filename = '从 0 到被 Google 看见：AI 时代的 SEO 生存指南.md';
  assert.equal(suggestedImportSlug(filename, { title: '中文文章' }), '');
  assert.deepEqual(
    resolveImportedDraftTarget('blog', 'zh', filename, 'google-seo-guide'),
    resolveNewContentTarget({
      collection: 'blog',
      lang: 'zh',
      slug: 'google-seo-guide',
      format: 'md',
    }),
  );
  assert.throws(() => resolveImportedDraftTarget('blog', 'zh', filename, ''));
});

test('真实 MDX 打开关闭逐字保真，更新属性保留正文和未改 YAML', () => {
  const source = readFileSync('content/blog/miles.mdx', 'utf8');
  const parsed = parseSourceDocument(source);
  assert.equal(parsed.fields.title, "Hi, I'm Miles");
  assert.equal(updateSourceFields(source, {}), source);
  assert.equal(updateSourceFields(source, { title: parsed.fields.title }), source);
  const updated = updateSourceFields(source, { title: '新的标题', shareText: '新的分享文案' });
  assert.equal(parseSourceDocument(updated).fields.title, '新的标题');
  assert.equal(parseSourceDocument(updated).fields.shareText, '新的分享文案');
  assert.equal(parseSourceDocument(updated).body, parsed.body);
  assert.ok(updated.includes('tags: ["introduction", "fullstack", "engineering", "ai"]'));
});

test('字段级 YAML 更新保留注释、换行风格与故事正文', () => {
  const source = '---\r\ntitle: old # 注释\r\ntags: [one, two]\r\n---\r\n\r\n我醒来。\r\n';
  const updated = updateSourceFields(source, { title: 'new', tags: ['one', 'three'] });
  assert.ok(updated.includes('title: "new" # 注释'));
  assert.ok(updated.includes('tags: ["one","three"]'));
  assert.equal(parseSourceDocument(updated).body, '\r\n\r\n我醒来。\r\n');
  assert.equal(
    updateSourceFields('正文\n', { title: '新文稿' }),
    '---\ntitle: "新文稿"\n---\n正文\n',
  );
});

test('编辑台只改属性或正文时保留另一部分，真实 MDX 可无编辑往返', () => {
  const source = readFileSync('content/blog/miles.mdx', 'utf8');
  const { fields, body } = parseSourceDocument(source);
  assert.equal(composeDraftSource(source, fields, fields, body, false), source);
  const withTitle = composeDraftSource(
    source,
    fields,
    { ...fields, title: '修订标题' },
    body.trim(),
    false,
  );
  assert.equal(parseSourceDocument(withTitle).body, body);
  const withBody = composeDraftSource(source, fields, fields, `${body}\n新增内容`, true);
  assert.equal(withBody.slice(0, -'\n新增内容'.length), source);
  const nonLeadingBody = composeDraftSource(
    source,
    fields,
    fields,
    "import { Highlighter } from 'highlighter';",
    true,
  );
  assert.equal(parseSourceDocument(nonLeadingBody).fields.title, "Hi, I'm Miles");
  assert.ok(nonLeadingBody.includes('---\nimport { Highlighter }'));
});
