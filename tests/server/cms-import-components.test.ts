import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDocumentComponents } from '../../packages/pageel-workbench/integration/components/useDocumentComponents';
import { inspectImportedContent } from '../../packages/pageel-workbench/integration/import-content';
import {
  buildInsertPayload,
  canInsertComponent,
} from '../../packages/pageel-workbench/integration/insertion';
import { contentComponents } from '../../src/config/content-components';

const header =
  '---\ntitle: 测试\ndescription: 简介\npubDate: 2026-10-23\ntags: []\ndraft: true\n---\n';
test('MDX AST 忽略围栏与行内代码，准确识别同名嵌套和对象表达式', () => {
  const source =
    '```mdx\n<ExploreCard />\n```\n\n`<ExploreCard />`\n\n<ExploreCard title="outer"><ExploreCard title="inner">文字</ExploreCard></ExploreCard>\n\n<TechStackTerminal profile={{ role: ">" }} />';
  const result = parseDocumentComponents(source);
  assert.equal(result.error, undefined);
  assert.equal(result.totalCount, 3);
  assert.equal(result.instances[1].depth, 1);
  assert.equal(result.instances[1].parentInstanceId, result.instances[0].id);
  assert.ok(parseDocumentComponents('<ExploreCard title={').error);
});
test('全部插入配置包含 hydration，终端包含对象表达式，Stories 禁止插入', () => {
  for (const component of contentComponents) {
    const payload = buildInsertPayload(component);
    assert.ok(component.hydration);
    assert.deepEqual(payload.props[component.hydration], { type: 'expression', value: 'true' });
    assert.equal(canInsertComponent('stories', component).allowed, false);
    if (component.name === 'TechStackTerminal')
      assert.equal(typeof payload.props.profile, 'object');
    if (component.name === 'PreviewLink') assert.notEqual(payload.props.href, 'https://');
  }
});
test('导入保留原始内容，拒绝无效属性、错误扩展与不合法 MDX', () => {
  const raw =
    header +
    'import ExploreCard from "@/components/article/ExploreCard";\n\n<ExploreCard title="测试">正文</ExploreCard>\n';
  assert.equal(inspectImportedContent('new.mdx', raw, 'blog').rawContent, raw);
  assert.throws(() => inspectImportedContent('../new.mdx', raw, 'blog'));
  assert.equal(inspectImportedContent('new.mdx', '正文', 'blog').body, '正文');
  assert.throws(() => inspectImportedContent('new.mdx', `${header}<ExploreCard title={`, 'blog'));
  assert.throws(() => inspectImportedContent('new.mdx', raw, 'stories'));
  assert.throws(() => inspectImportedContent('new.md', `${header}# heading`, 'stories'));
  assert.throws(() => inspectImportedContent('new.md', `${header}<Aside />`, 'stories'));
  assert.equal(
    inspectImportedContent('new.md', `${header}文字\n\n<br/>\n\n---\n\n结尾`, 'stories').frontmatter
      .title,
    '测试',
  );
});

test('无 YAML 或属性不完整仍可导入，缺项留到发布前提示', () => {
  const plain = '# 正文标题\n\n原始正文。';
  const imported = inspectImportedContent('待配置文章.md', plain, 'blog');
  assert.equal(imported.body, plain);
  assert.equal(imported.rawContent, plain);
  assert.equal(imported.frontmatter.title, '待配置文章');
  assert.equal(imported.frontmatter.draft, true);
  assert.ok(imported.warnings.some((message) => message.includes('摘要')));
  assert.ok(imported.warnings.some((message) => message.includes('发布日期')));
  const incomplete = '---\ntitle: 自定义标题\ntags: wrong\npubDate: invalid\n---\n正文';
  const result = inspectImportedContent('test.mdx', incomplete, 'blog');
  assert.equal(result.frontmatter.tags, 'wrong');
  assert.equal(result.rawContent, incomplete);
  assert.ok(result.warnings.some((message) => message.includes('tags')));
  const invalidOptional = `${header.replace('---\n', '---\nupdatedDate: invalid\nllms: yes\nheroImage: 42\nshareText: false\n')}正文`;
  const optionalResult = inspectImportedContent('test.mdx', invalidOptional, 'blog');
  for (const field of ['updatedDate', 'llms', 'heroImage', 'shareText']) {
    assert.ok(optionalResult.warnings.some((message) => message.includes(field)));
  }
  assert.throws(() => inspectImportedContent('bad.md', '---\ntitle: [\n---\n正文', 'blog'));
});

test('导入沿用现有解析器，完整保留代码语言、meta、未知语言和图片引用', () => {
  const body = [
    '# 导入正文',
    '```mermaid\nflowchart LR\n  A --> B\n```',
    '```tsx\nexport const Example = () => <span>示例</span>;\n```',
    '```bash title="install.sh"\npnpm install\n```',
    '```future-language custom-meta\n原样保留未知语法\n```',
    '```\n无语言代码块\n```',
    '![原始附件](attachments/diagram.svg)',
  ].join('\n\n');
  for (const format of ['md', 'mdx']) {
    const imported = inspectImportedContent(`代码块.${format}`, body, 'blog');
    assert.equal(imported.rawContent, body);
    assert.equal(imported.body, body);
  }
});
