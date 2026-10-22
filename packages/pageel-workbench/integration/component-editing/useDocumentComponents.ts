import { useMemo } from 'react';
import { findComponent } from './registry';

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
}

function parseAttributeLiterals(attrString: string): Record<string, string> {
  const result: Record<string, string> = {};
  // match attr="value" or attr='value' or attr={"value"}
  const regex = /([a-zA-Z0-9_-]+)=(?:\{['"]([^'"]+)['"]\}|["']([^'"]+)["'])/g;
  for (const match of attrString.matchAll(regex)) {
    result[match[1]] = match[2] || match[3] || '';
  }
  return result;
}

export function parseDocumentComponents(markdown: string): DocumentComponentsData {
  if (!markdown) {
    return { instances: [], grouped: [], totalCount: 0, typeCount: 0 };
  }

  const rawInstances: Array<{
    name: string;
    attrString: string;
    startIndex: number;
    endIndex: number;
    childrenText: string;
  }> = [];

  const tagRegex = /<([A-Z][a-zA-Z0-9_]*)([\s\S]*?)(\/?>)/g;
  const knownComponentNames = new Set([
    'Highlighter',
    'PreviewLink',
    'ExploreCard',
    'TechSkillsCloud',
    'TechStackTerminal',
    'BlockQuote',
    'PullQuote',
    'Aside',
  ]);

  for (const match of markdown.matchAll(tagRegex)) {
    const tagName = match[1];
    if (!knownComponentNames.has(tagName)) continue;

    const isSelfClosing = match[3] === '/>' || match[2].trim().endsWith('/');
    const attrString = match[2];
    const startIndex = match.index ?? 0;
    let endIndex = startIndex + match[0].length;
    let childrenText = '';

    if (!isSelfClosing) {
      const closeTag = `</${tagName}>`;
      const closeIdx = markdown.indexOf(closeTag, endIndex);
      if (closeIdx !== -1) {
        childrenText = markdown.slice(endIndex, closeIdx).trim();
        endIndex = closeIdx + closeTag.length;
      }
    }

    rawInstances.push({
      name: tagName,
      attrString,
      startIndex,
      endIndex,
      // Strip nested tags for clean summary
      childrenText: childrenText.replace(/<[^>]+>/g, '').trim(),
    });
  }

  // Calculate nesting hierarchy and index by type
  const typeCounters: Record<string, number> = {};
  const instances: DocumentComponentInstance[] = [];

  for (let i = 0; i < rawInstances.length; i++) {
    const raw = rawInstances[i];
    const config = findComponent(raw.name);
    const label = config?.label ?? raw.name;
    const attributes = parseAttributeLiterals(raw.attrString);

    const indexInType = typeCounters[raw.name] ?? 0;
    typeCounters[raw.name] = indexInType + 1;

    // Detect parent instance if this instance is enclosed within an earlier instance
    let depth = 0;
    let parentInstanceId: string | undefined;
    let parentName: string | undefined;

    for (let j = 0; j < instances.length; j++) {
      const prev = instances[j];
      if (raw.startIndex > prev.startIndex && raw.endIndex < prev.endIndex) {
        depth = prev.depth + 1;
        parentInstanceId = prev.id;
        parentName = prev.name;
      }
    }

    // Extract summary
    let summary = '';
    if (config?.extractSummary) {
      summary = config.extractSummary(attributes, raw.childrenText);
    } else if (raw.childrenText) {
      summary = raw.childrenText.slice(0, 30);
    } else if (attributes.title) {
      summary = attributes.title;
    } else if (attributes.headingId) {
      summary = attributes.headingId;
    } else if (attributes.successMessage) {
      summary = attributes.successMessage;
    } else {
      summary = `第 ${indexInType + 1} 处`;
    }

    const id = `${raw.name}-${indexInType}`;
    const displayTitle = `${label} · ${summary}`;

    instances.push({
      id,
      name: raw.name,
      label,
      summary,
      displayTitle,
      attributes,
      rawAttributes: raw.attrString,
      depth,
      parentInstanceId,
      parentName,
      indexInType,
      indexInDocument: i,
      startIndex: raw.startIndex,
      endIndex: raw.endIndex,
    });
  }

  // Group by component name
  const groupMap = new Map<string, DocumentComponentInstance[]>();
  for (const inst of instances) {
    if (!groupMap.has(inst.name)) {
      groupMap.set(inst.name, []);
    }
    groupMap.get(inst.name)?.push(inst);
  }

  const grouped: ComponentGroup[] = [];
  for (const [name, instList] of groupMap.entries()) {
    const label = instList[0]?.label ?? name;
    grouped.push({
      name,
      label,
      count: instList.length,
      instances: instList,
    });
  }

  return {
    instances,
    grouped,
    totalCount: instances.length,
    typeCount: grouped.length,
  };
}

export function useDocumentComponents(markdown: string): DocumentComponentsData {
  return useMemo(() => parseDocumentComponents(markdown), [markdown]);
}
