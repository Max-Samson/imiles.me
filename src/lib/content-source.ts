import { isMap, parseDocument } from 'yaml';

export interface SourceDocument {
  fields: Record<string, unknown>;
  body: string;
  hasFrontmatter: boolean;
}

const frontmatterPattern = /^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n---)(?=\r?\n|[a-zA-Z#<]|$)/;

function parseYamlMapping(source: string) {
  const document = parseDocument(source, { keepSourceTokens: true, uniqueKeys: true });
  if (document.errors.length) throw new Error(`YAML 属性语法错误：${document.errors[0].message}`);
  if (document.contents !== null && !isMap(document.contents))
    throw new Error('YAML 文章属性必须是对象');
  return document;
}

/** 拆分源文但不修剪正文；无编辑往返必须逐字保持原文件。 */
export function parseSourceDocument(source: string): SourceDocument {
  const match = frontmatterPattern.exec(source);
  if (!match) return { fields: {}, body: source, hasFrontmatter: false };
  const document = parseYamlMapping(match[2]);
  return {
    fields: (document.toJS() ?? {}) as Record<string, unknown>,
    body: source.slice(match[0].length),
    hasFrontmatter: true,
  };
}

/** 只替换指定顶层属性值，保留其他 YAML 字段、注释、顺序及正文原始字符。 */
export function updateSourceFields(source: string, updates: Record<string, unknown>): string {
  const entries = Object.entries(updates);
  if (!entries.length) return source;
  for (const [key, value] of entries) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key) || value === undefined) {
      throw new Error('文章属性名称或值无效');
    }
  }
  const match = frontmatterPattern.exec(source);
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const encodeValue = (value: unknown) => {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('文章属性值无法写入 YAML');
    return encoded;
  };
  if (!match) {
    const lines = entries.map(([key, value]) => `${key}: ${encodeValue(value)}`);
    return `---${newline}${lines.join(newline)}${newline}---${newline}${source}`;
  }

  let yamlText = match[2];
  const document = parseYamlMapping(yamlText);
  const pairs = isMap(document.contents) ? document.contents.items : [];
  const currentFields = (document.toJS() ?? {}) as Record<string, unknown>;
  const replacements: Array<{ start: number; end: number; text: string }> = [];
  const additions: string[] = [];
  for (const [key, value] of entries) {
    if (
      Object.hasOwn(currentFields, key) &&
      JSON.stringify(currentFields[key]) === JSON.stringify(value)
    ) {
      continue;
    }
    const pair = pairs.find((item) => item.key && 'value' in item.key && item.key.value === key);
    if (!pair?.key?.range) {
      additions.push(`${key}: ${encodeValue(value)}`);
      continue;
    }
    if (!pair.value?.range) {
      // 例如 `title: # comment`；只替换该字段，不能吞掉下一字段。
      const start = pair.key.range[0];
      const end = yamlText.indexOf(newline, start);
      replacements.push({
        start,
        end: end < 0 ? yamlText.length : end,
        text: `${key}: ${encodeValue(value)}`,
      });
      continue;
    }
    const [start, end] = pair.value.range;
    const original = yamlText.slice(start, end);
    const trailing = original.endsWith('\r\n') ? '\r\n' : original.endsWith('\n') ? '\n' : '';
    replacements.push({ start, end, text: `${encodeValue(value)}${trailing}` });
  }
  if (!replacements.length && !additions.length) return source;
  for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
    yamlText = `${yamlText.slice(0, replacement.start)}${replacement.text}${yamlText.slice(replacement.end)}`;
  }
  if (additions.length) yamlText += `${yamlText ? newline : ''}${additions.join(newline)}`;
  parseYamlMapping(yamlText);
  return `${match[1]}${yamlText}${match[3]}${source.slice(match[0].length)}`;
}

/** 只替换正文；保留 frontmatter 原有字节与结束分隔符后的换行。 */
export function replaceSourceBody(source: string, body: string): string {
  const match = frontmatterPattern.exec(source);
  if (!match) return body;
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const separator = !body || body.startsWith('\r') || body.startsWith('\n') ? '' : newline;
  return `${match[0]}${separator}${body}`;
}
