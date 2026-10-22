import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildInsertPayload,
  canInsertComponent,
} from '../../packages/pageel-workbench/integration/component-editing/insertion';
import {
  componentCategories,
  componentRegistry,
  findComponent,
} from '../../packages/pageel-workbench/integration/component-editing/registry';
import { parseDocumentComponents } from '../../packages/pageel-workbench/integration/component-editing/useDocumentComponents';

test('parseDocumentComponents: 正确解析文章中已用的组件、摘要和数量统计', () => {
  const markdown = `
# 欢迎

我是 <Highlighter color="#87cefa" action="highlight">Miles</Highlighter>，
一名 <Highlighter color="#ffd1dc" action="underline">全栈 Web 工程师</Highlighter>。

访问我的个人项目：<PreviewLink href="https://asksoul.me">AskSoul.me</PreviewLink>。

<ExploreCard title="深度探讨 — Snippet of the Week">
这里是卡片正文。
</ExploreCard>
`;

  const parsed = parseDocumentComponents(markdown);

  assert.equal(parsed.totalCount, 4);
  assert.equal(parsed.typeCount, 3);

  const highlighterGroup = parsed.grouped.find((g) => g.name === 'Highlighter');
  assert.ok(highlighterGroup);
  assert.equal(highlighterGroup.count, 2);
  assert.equal(highlighterGroup.instances[0].summary, 'Miles');
  assert.equal(highlighterGroup.instances[1].summary, '全栈 Web 工程师');

  const previewLinkGroup = parsed.grouped.find((g) => g.name === 'PreviewLink');
  assert.ok(previewLinkGroup);
  assert.equal(previewLinkGroup.count, 1);
  assert.equal(previewLinkGroup.instances[0].summary, 'AskSoul.me');

  const cardGroup = parsed.grouped.find((g) => g.name === 'ExploreCard');
  assert.ok(cardGroup);
  assert.equal(cardGroup.count, 1);
  assert.equal(cardGroup.instances[0].summary, '深度探讨 — Snippet of the Week');
});

test('parseDocumentComponents: 支持嵌套组件层级深度分析', () => {
  const nestedMarkdown = `
<ExploreCard title="容器卡片">
  外层容器包裹文字和
  <Highlighter color="#87cefa">
    <PreviewLink href="https://asksoul.me">嵌套链接</PreviewLink>
  </Highlighter>
</ExploreCard>
`;

  const parsed = parseDocumentComponents(nestedMarkdown);
  assert.equal(parsed.totalCount, 3);

  const card = parsed.instances.find((i) => i.name === 'ExploreCard');
  const highlighter = parsed.instances.find((i) => i.name === 'Highlighter');
  const preview = parsed.instances.find((i) => i.name === 'PreviewLink');

  assert.ok(card && highlighter && preview);
  assert.equal(card.depth, 0);
  assert.equal(highlighter.depth, 1);
  assert.equal(highlighter.parentInstanceId, card.id);
  assert.equal(preview.depth, 2);
  assert.equal(preview.parentInstanceId, highlighter.id);
});

test('canInsertComponent: 故事 (stories) 集合完全禁止插入组件', () => {
  const highlighter = findComponent('Highlighter');
  assert.ok(highlighter);

  const checkStories = canInsertComponent('stories', highlighter);
  assert.equal(checkStories.allowed, false);
  assert.match(checkStories.reason ?? '', /纯文本 Markdown/);

  const checkBlog = canInsertComponent('blog', highlighter);
  assert.equal(checkBlog.allowed, true);
});

test('buildInsertPayload: 正确生成行内 (text) 与块级 (flow) 节点的 AST 载荷', () => {
  const highlighter = findComponent('Highlighter');
  assert.ok(highlighter);

  const inlinePayload = buildInsertPayload(highlighter, '重点内容', { color: '#ff0000' });
  assert.equal(inlinePayload.name, 'Highlighter');
  assert.equal(inlinePayload.kind, 'text');
  assert.equal(inlinePayload.props.color, '#ff0000');
  assert.deepEqual(inlinePayload.children, [{ type: 'text', value: '重点内容' }]);

  const exploreCard = findComponent('ExploreCard');
  assert.ok(exploreCard);

  const blockPayload = buildInsertPayload(exploreCard, '卡片说明正文');
  assert.equal(blockPayload.name, 'ExploreCard');
  assert.equal(blockPayload.kind, 'flow');
  assert.equal(blockPayload.props.title, 'Snippet of the Week — 探索主题');
  assert.ok(Array.isArray(blockPayload.children));
  assert.equal(blockPayload.children?.[0]?.type, 'paragraph');
});

test('componentRegistry: 注册表完整包含分类、说明与支持程度', () => {
  assert.ok(componentRegistry.length >= 5);
  assert.ok(componentCategories.includes('文字与链接'));
  assert.ok(componentCategories.includes('内容容器'));
  assert.ok(componentCategories.includes('展示组件'));

  for (const comp of componentRegistry) {
    assert.ok(comp.name);
    assert.ok(comp.label);
    assert.ok(comp.category);
    assert.ok(comp.description);
    assert.ok(['configurable', 'source'].includes(comp.supportLevel));
    assert.ok(['text', 'flow'].includes(comp.kind));
  }
});
