import katex from 'katex';
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

function renderMath(text: string): string {
  // 1. 保留代码块与行内代码不被公式规则替换
  const codeBlocks: string[] = [];
  let masked = text.replace(/(`{1,3})[\s\S]*?\1/g, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // 2. 替换 display math $$...$$
  masked = masked.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    try {
      return `<div class="katex-display my-4 overflow-x-auto text-center">${katex.renderToString(math.trim(), { displayMode: true, throwOnError: false })}</div>`;
    } catch {
      return `$$${math}$$`;
    }
  });

  // 3. 替换 inline math $...$
  masked = masked.replace(/(?<!\\)\$([^$\n]+?)(?<!\\)\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return `$${math}$`;
    }
  });

  // 4. 还原代码块
  return masked.replace(/__CODE_BLOCK_(\d+)__/g, (_, idx) => codeBlocks[Number(idx)]);
}

/** 将 Markdown 正文渲染为带标题 ID 与 KaTeX 公式支持的安全 HTML */
export function renderMarkdownToHtml(markdown: string): string {
  const withMath = renderMath(markdown);
  const renderer = new marked.Renderer();
  renderer.heading = ({ tokens, depth }) => {
    const text = renderer.parser.parseInline(tokens);
    const plainText = text.replace(/<[^>]+>/g, '');
    const id = slugify(plainText) || `heading-${depth}`;
    return `<h${depth} id="${id}">${text}</h${depth}>\n`;
  };
  return marked.parse(withMath, { renderer, gfm: true, breaks: true }) as string;
}
