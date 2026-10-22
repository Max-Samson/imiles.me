import type { ContentComponentConfig } from './registry';

export interface JsxInsertPayload {
  name: string;
  kind: 'text' | 'flow';
  props: Record<string, string>;
  children?: Array<{ type: string; value?: string; children?: unknown[] }>;
}

export type InsertJsxHandler = (payload: JsxInsertPayload) => void;

let savedRange: Range | null = null;
let savedText = '';

export function saveEditorSelection(): { range: Range | null; text: string } {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    // Ensure the selection is within the editor
    const container = range.commonAncestorContainer;
    const isInsideEditor =
      container instanceof Element
        ? container.closest('.mdxeditor, [contenteditable="true"]')
        : container.parentElement?.closest('.mdxeditor, [contenteditable="true"]');

    if (isInsideEditor) {
      savedRange = range.cloneRange();
      savedText = selection.toString();
      return { range: savedRange, text: savedText };
    }
  }
  return { range: savedRange, text: savedText };
}

export function restoreEditorSelection(): boolean {
  if (!savedRange) return false;
  const selection = window.getSelection();
  if (!selection) return false;
  try {
    selection.removeAllRanges();
    selection.addRange(savedRange);
    return true;
  } catch {
    return false;
  }
}

export function getSavedSelectionText(): string {
  return savedText;
}

export function clearSavedSelection(): void {
  savedRange = null;
  savedText = '';
}

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
  const props = { ...(component.defaultProps ?? {}), ...(customProps ?? {}) };
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
