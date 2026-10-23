import type { ContentComponentConfig } from './component-config';

import type { JsxProperties } from '@mdxeditor/editor';
import type { RootContent } from 'mdast';
export interface JsxInsertPayload {
  name: string;
  kind: 'text' | 'flow';
  props: JsxProperties;
  children?: RootContent[];
}
export type InsertJsxHandler = (payload: JsxInsertPayload) => void;

export function canInsertComponent(
  collection: string,
  component: ContentComponentConfig,
): { allowed: boolean; reason?: string } {
  if (collection === 'stories') {
    return {
      allowed: false,
      reason: '故事 (Stories) 为纯文本 Markdown，不开放自定义组件插入。',
    };
  }
  if (!component.enabled) {
    return {
      allowed: false,
      reason: '该组件在当前项目中已被禁用。',
    };
  }
  if (component.collections && !component.collections.includes(collection as 'blog' | 'stories')) {
    return {
      allowed: false,
      reason: `该组件不支持在 ${collection} 集合中插入。`,
    };
  }
  return { allowed: true };
}

export function buildInsertPayload(
  component: ContentComponentConfig,
  customText?: string,
  customProps?: Record<string, string>,
): JsxInsertPayload {
  const props: JsxProperties = { ...(component.defaultProps ?? {}), ...(customProps ?? {}) };
  // 指令使用布尔表达式，避免生成 client:load="true"。
  if (component.hydration) props[component.hydration] = { type: 'expression', value: 'true' };
  for (const [name, value] of Object.entries(component.defaultExpressions ?? {})) {
    props[name] = { type: 'expression', value };
  }
  const text = customText || component.defaultChildren || '内容文字';

  if (component.kind === 'text') {
    return {
      name: component.name,
      kind: 'text',
      props,
      children: [{ type: 'text', value: text }],
    };
  }

  // flow (block)
  return {
    name: component.name,
    kind: 'flow',
    props,
    children: component.hasChildren
      ? [
          {
            type: 'paragraph',
            children: [{ type: 'text', value: text }],
          },
        ]
      : [],
  };
}
