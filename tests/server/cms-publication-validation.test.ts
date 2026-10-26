import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validatePublicationFields } from '../../packages/pageel-workbench/integration/publication-validation';
import { preparePublication } from '../../src/server/admin/cms/publication-validation';
import type { CmsDraft } from '../../src/server/db/schema/cms';

test('发布保留文章源文，不写入站点隐藏字段', () => {
  const source =
    '---\ntitle: 示例\ndescription: 摘要\npubDate: 2026-10-26\ntags: []\nlang: zh\n---\n\n正文';
  const draft = {
    source,
    collection: 'blog',
    format: 'md',
    lang: 'zh',
    baseBlobSha: null,
  } as CmsDraft;
  assert.equal(preparePublication(draft).source, source);
});

test('发布前一次列出待补充字段，补齐后消除提示', () => {
  const fields: Record<string, unknown> = { title: '', tags: [] };
  assert.deepEqual(
    validatePublicationFields(fields, 'blog').map((issue) => issue.field),
    ['title', 'description', 'pubDate'],
  );
  Object.assign(fields, { title: '文章', description: '摘要', pubDate: '2026-10-23', lang: 'zh' });
  assert.deepEqual(validatePublicationFields(fields, 'blog'), []);
  assert.equal(validatePublicationFields({ ...fields, pubDate: 0 }, 'blog')[0].field, 'pubDate');
});

test('Blog 可选属性类型错误逐项提示，合法值通过', () => {
  const fields = {
    title: '文章',
    description: '摘要',
    pubDate: '2026-10-23',
    tags: [],
    updatedDate: 'not-a-date',
    heroImage: 42,
    shareText: false,
    llms: 'yes',
  };
  assert.deepEqual(
    validatePublicationFields(fields, 'blog').map((issue) => issue.field),
    ['updatedDate', 'llms', 'heroImage', 'shareText'],
  );
  assert.deepEqual(
    validatePublicationFields(
      {
        ...fields,
        updatedDate: new Date('2026-10-24'),
        heroImage: '/cover.webp',
        shareText: '',
        llms: false,
      },
      'blog',
    ),
    [],
  );
  assert.equal(
    validatePublicationFields({ ...fields, updatedDate: '' }, 'blog')[0].field,
    'updatedDate',
  );
});

test('Stories 检查自身可选属性，不误报 Blog 专属字段', () => {
  const fields = {
    title: '故事',
    description: '摘要',
    pubDate: '2026-10-23',
    tags: [],
    updatedDate: 'invalid',
    llms: 'yes',
    heroImage: 42,
    shareText: false,
  };
  assert.deepEqual(
    validatePublicationFields(fields, 'stories').map((issue) => issue.field),
    ['updatedDate', 'llms'],
  );
});
