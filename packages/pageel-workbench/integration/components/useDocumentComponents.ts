import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import type { RootContent } from 'mdast';
import { useMemo } from 'react';
import { findComponent } from '../component-config';

export interface DocumentComponentInstance {
  id: string;
  name: string;
  label: string;
  summary: string;
  displayTitle: string;
  attributes: Record<string, string>;
  rawAttributes: string;
  depth: number;
  parentInstanceId?: string;
  parentName?: string;
  indexInType: number;
  indexInDocument: number;
  startIndex: number;
  endIndex: number;
}

export interface ComponentGroup {
  name: string;
  label: string;
  count: number;
  instances: DocumentComponentInstance[];
}

export interface DocumentComponentsData {
  instances: DocumentComponentInstance[];
  grouped: ComponentGroup[];
  totalCount: number;
  typeCount: number;
  error?: string;
}

// 使用成熟 MDX AST：代码围栏不会被当成组件，同名嵌套与表达式保留结构。
const parser = unified().use(remarkParse).use(remarkMdx);
export function parseDocumentComponents(markdown: string): DocumentComponentsData {
  const instances: DocumentComponentInstance[] = [];
  const counts = new Map<string, number>();
  const textOf = (node: RootContent): string => 'children' in node
    ? node.children.map(child => textOf(child as RootContent)).join('')
    : ('value' in node && node.type === 'text' ? node.value : '');
  try {
    const tree = parser.parse(markdown);
    const visit = (node: RootContent, parent?: DocumentComponentInstance) => {
      let nextParent = parent;
      if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && node.name && /^[A-Z]/.test(node.name)) {
        const config = findComponent(node.name);
        const attributes: Record<string, string> = {};
        for (const attr of node.attributes) {
          if (attr.type === 'mdxJsxAttribute' && typeof attr.value === 'string') attributes[attr.name] = attr.value;
        }
        const indexInType = counts.get(node.name) ?? 0;
        counts.set(node.name, indexInType + 1);
        const summary = (config?.extractSummary?.(attributes, textOf(node)) || textOf(node) || `第 ${indexInType + 1} 处`).slice(0, 80);
        const instance: DocumentComponentInstance = {
          id: `${node.name}-${indexInType}`, name: node.name, label: config?.label ?? node.name,
          summary, displayTitle: `${config?.label ?? node.name} · ${summary}`, attributes,
          rawAttributes: '', depth: parent ? parent.depth + 1 : 0,
          parentInstanceId: parent?.id, parentName: parent?.name,
          indexInType, indexInDocument: instances.length,
          startIndex: node.position?.start.offset ?? 0, endIndex: node.position?.end.offset ?? 0,
        };
        instances.push(instance);
        nextParent = instance;
      }
      if ('children' in node) for (const child of node.children) visit(child as RootContent, nextParent);
    };
    for (const node of tree.children) visit(node);
  } catch {
    return { instances: [], grouped: [], totalCount: 0, typeCount: 0, error: 'MDX 暂时无法解析，请在源码中修复后查看组件列表。' };
  }
  const groups = new Map<string, DocumentComponentInstance[]>();
  for (const instance of instances) groups.set(instance.name, [...(groups.get(instance.name) ?? []), instance]);
  const grouped = [...groups].map(([name, entries]) => ({ name, label: entries[0].label, count: entries.length, instances: entries }));
  return { instances, grouped, totalCount: instances.length, typeCount: grouped.length };
}
export function useDocumentComponents(markdown: string): DocumentComponentsData {
  return useMemo(() => parseDocumentComponents(markdown), [markdown]);
}
