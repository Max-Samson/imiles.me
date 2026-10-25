import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

/** 只读取静态图片引用，绝不执行 HTML、JSX 或属性表达式。前后台共用同一份契约。 */
export interface ImageAstNode {
  type: string;
  value?: string;
  url?: string;
  alt?: string | null;
  title?: string | null;
  identifier?: string;
  name?: string | null;
  attributes?: { type: string; name?: string; value?: unknown }[];
  children?: ImageAstNode[];
}
export interface ContentImage {
  url: string;
  alt: string;
  title?: string;
}

function decodeAttribute(value: string) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (entity, key: string) => {
    const names: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
    if (!key.startsWith('#')) return names[key.toLowerCase()] ?? entity;
    const n =
      key[1]?.toLowerCase() === 'x' ? Number.parseInt(key.slice(2), 16) : Number(key.slice(1));
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : entity;
  });
}

export function collectContentImages(tree: ImageAstNode) {
  const images: ContentImage[] = [];
  const issues: string[] = [];
  const definitions = new Map<string, ImageAstNode>();
  const visit = (node: ImageAstNode, fn: (node: ImageAstNode) => void) => {
    fn(node);
    for (const child of node.children ?? []) visit(child, fn);
  };
  visit(tree, (node) => {
    if (node.type === 'definition' && node.identifier)
      definitions.set(node.identifier.toLowerCase(), node);
  });
  const add = (url: unknown, alt: unknown = '', title?: unknown) => {
    if (typeof url !== 'string' || !url.trim()) {
      issues.push('图片 src 必须是非空静态字符串');
      return;
    }
    images.push({
      url: url.trim(),
      alt: typeof alt === 'string' ? alt : '',
      ...(typeof title === 'string' ? { title } : {}),
    });
  };
  visit(tree, (node) => {
    if (node.type === 'image') add(node.url, node.alt, node.title);
    if (node.type === 'imageReference') {
      const def = definitions.get(node.identifier?.toLowerCase() ?? '');
      if (def) add(def.url, node.alt, def.title);
      else issues.push('图片引用缺少对应定义');
    }
    if (
      (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') &&
      node.name === 'img'
    ) {
      const attrs = node.attributes ?? [];
      if (attrs.filter((a) => a.name === 'src').length > 1) {
        issues.push('图片不能有重复 src 属性');
        return;
      }
      if (
        attrs.some(
          (a) => a.type !== 'mdxJsxAttribute' || (a.name === 'src' && typeof a.value !== 'string'),
        )
      ) {
        issues.push('图片 src 和展开属性必须可静态确定，不能使用 JSX 表达式');
        return;
      }
      const value = (key: string) => attrs.find((a) => a.name === key)?.value;
      add(value('src'), value('alt'), value('title'));
    }
    if (node.type !== 'html') return;
    // 仅扫描解析器已识别的 HTML 片段；引号内的 > 不截断标签，注释不作为图片。
    const html = (node.value ?? '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
    for (const match of html.matchAll(/<!--[\s\S]*?-->|<(?:[^<>"']|"[^"]*"|'[^']*')*>/g)) {
      const tag = match[0];
      if (!/^<img(?:\s|\/?>)/i.test(tag)) continue;
      const attrs = new Map<string, string>();
      for (const attr of tag
        .slice(4)
        .matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
        const key = attr[1].toLowerCase();
        // 避免浏览器与校验器对重复 src 的选择不同。
        if (attrs.has(key) && key === 'src') {
          issues.push('图片不能有重复 src 属性');
          continue;
        }
        attrs.set(key, decodeAttribute(attr[2] ?? attr[3] ?? attr[4] ?? ''));
      }
      add(attrs.get('src'), attrs.get('alt'), attrs.get('title'));
    }
  });
  return { images, issues };
}

/** 源码尚未写完时尽量显示已有图片，不因半个 JSX 标签阻止继续输入。 */
export function getSourceImages(source: string, mdx: boolean) {
  let tree: ImageAstNode;
  try {
    const parser = unified().use(remarkParse);
    if (mdx) parser.use(remarkMdx);
    tree = parser.parse(source) as ImageAstNode;
  } catch {
    tree = unified().use(remarkParse).parse(source) as ImageAstNode;
  }
  const result = collectContentImages(tree);
  return {
    ...result,
    images: result.images.filter(
      (image, i, all) => all.findIndex((v) => v.url === image.url) === i,
    ),
  };
}

/** 只改变显示地址，不将后台预览地址或 localhost 写回文章。 */
export function cmsImagePreviewUrl(source: string): string | null {
  const normalized = source.startsWith('public/') ? source.slice(6) : source;
  const match = /^\/images\/blog\/(cma_[a-f0-9]{32})\.(?:png|jpe?g|webp)$/.exec(normalized);
  return match ? `/api/v1/admin/cms/assets/${match[1]}/preview` : null;
}
export function isSafeImagePreviewUrl(source: string) {
  return (
    /^https?:\/\//i.test(source) ||
    (/^\/(?!\/)/.test(source) &&
      !source.includes(String.fromCharCode(92)) &&
      ![...source].some((char) => char.charCodeAt(0) < 32))
  );
}
