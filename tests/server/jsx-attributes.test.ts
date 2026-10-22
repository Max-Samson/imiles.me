import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  patchLiteral,
  readLiteral,
} from '../../packages/pageel-workbench/integration/jsx-attributes';
import { contentComponents } from '../../src/config/content-components';

type Attributes = Parameters<typeof patchLiteral>[0];

test('JSX 参数修改保留 hydration、未知属性与表达式，并且不改动输入', () => {
  const attributes: Attributes = [
    { type: 'mdxJsxAttribute', name: 'client:load', value: null },
    { type: 'mdxJsxAttribute', name: 'color', value: '#abc' },
    {
      type: 'mdxJsxAttribute',
      name: 'custom',
      value: { type: 'mdxJsxAttributeValueExpression', value: 'config.value' },
    },
  ];
  const result = patchLiteral(attributes, 'Highlighter', 'color', '#123456');
  assert.equal(result[0], attributes[0]);
  assert.equal(result[2], attributes[2]);
  assert.equal(readLiteral(result, 'color').value, '#123456');
  assert.equal(readLiteral(attributes, 'color').value, '#abc');
  assert.equal(patchLiteral(result, 'Highlighter', 'color', '').length, 2);
});

test('表达式、spread 和重复属性不通过普通表单重写', () => {
  const cases: Attributes[] = [
    [
      {
        type: 'mdxJsxAttribute',
        name: 'href',
        value: { type: 'mdxJsxAttributeValueExpression', value: 'url' },
      },
    ],
    [{ type: 'mdxJsxExpressionAttribute', value: '...props' }],
    [
      { type: 'mdxJsxAttribute', name: 'href', value: '/a' },
      { type: 'mdxJsxAttribute', name: 'href', value: '/b' },
    ],
  ];
  for (const attributes of cases) {
    assert.equal(readLiteral(attributes, 'href').editable, false);
    assert.throws(() => patchLiteral(attributes, 'PreviewLink', 'href', '/changed'));
  }
});

test('只允许白名单参数和有效值；未开放组件保持源码编辑', () => {
  assert.throws(() => patchLiteral([], 'Highlighter', 'client:load', 'true'));
  assert.throws(() => patchLiteral([], 'TechStackTerminal', 'profile', '{}'));
  assert.throws(() => patchLiteral([], 'PreviewLink', 'href', 'javascript:alert(1)'));
  assert.throws(() => patchLiteral([], 'Highlighter', 'action', 'invalid'));
  assert.throws(() => patchLiteral([], 'Highlighter', 'color', 'invalid'));
  assert.equal(
    readLiteral(patchLiteral([], 'PreviewLink', 'href', 'https://example.com'), 'href').value,
    'https://example.com',
  );
});

test('全部已接入组件的安全字符串字段可编辑，必填字段不能删除', () => {
  for (const [component, field] of [
    ['ExploreCard', 'title'],
    ['TechSkillsCloud', 'headingId'],
    ['TechStackTerminal', 'successMessage'],
  ]) {
    assert.equal(readLiteral(patchLiteral([], component, field, '测试'), field).value, '测试');
  }
  assert.throws(() => patchLiteral([], 'ExploreCard', 'title', ''));
  assert.throws(() => patchLiteral([], 'PreviewLink', 'href', ''));
});

test('项目开关关闭属性编辑，但保留旧节点注册信息', () => {
  const config = contentComponents.find((item) => item.name === 'ExploreCard');
  assert.ok(config);
  config.enabled = false;
  try {
    assert.throws(() => patchLiteral([], 'ExploreCard', 'title', '测试'));
    assert.equal(config.source, '@/components/article/ExploreCard');
  } finally {
    config.enabled = true;
  }
});
