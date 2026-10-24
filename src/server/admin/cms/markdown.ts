import { marked } from 'marked';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s\u00A0\uFEFF]+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** 将 Markdown 正文渲染为带标题 ID 的安全 HTML */
export function renderMarkdownToHtml(markdown: string): string {
  const renderer = new marked.Renderer();
  renderer.heading = ({ tokens, depth }) => {
    const text = renderer.parser.parseInline(tokens);
    const plainText = text.replace(/<[^>]+>/g, '');
    const id = slugify(plainText) || `heading-${depth}`;
    return `<h${depth} id="${id}">${text}</h${depth}>\n`;
  };
  return marked.parse(markdown, { renderer, gfm: true, breaks: true }) as string;
}

export interface ExtractedHeading {
  depth: number;
  slug: string;
  text: string;
}

/** 从已渲染的 HTML 中提取 h2/h3 标题供目录 (TOC) 展示 */
export function extractHeadingsFromHtml(html: string): ExtractedHeading[] {
  const matches = [...html.matchAll(/<h([23])[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h[23]>/g)];
  return matches.map((m) => ({
    depth: Number(m[1]),
    slug: m[2],
    text: m[3].replace(/<[^>]+>/g, ''),
  }));
}
