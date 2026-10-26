import { validatePublicationFields } from './publication-validation';
import { resolveNewContentTarget } from '../../../src/lib/content-routing';
import { load } from 'js-yaml';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** 导入文件名可以是中文；保存时的 URL 标识由编辑者单独确定。 */
export function suggestedImportSlug(name: string, fields: Record<string, unknown>): string {
  const frontmatterSlug = fields.slug;
  if (typeof frontmatterSlug === 'string' && slugPattern.test(frontmatterSlug)) return frontmatterSlug;
  const filenameSlug = name.replace(/\.mdx?$/, '');
  return slugPattern.test(filenameSlug) ? filenameSlug : '';
}

export function resolveImportedDraftTarget(
  collection: 'blog' | 'stories',
  lang: 'en' | 'zh',
  filename: string,
  slug: string,
) {
  return resolveNewContentTarget({
    collection,
    lang,
    slug: slug.trim(),
    format: filename.endsWith('.mdx') ? 'mdx' : 'md',
  });
}

/** 导入只验证并打开原文件；不执行 MDX，不改写 frontmatter，不自动发布。 */
export function inspectImportedContent(name: string, content: string, collection: 'blog' | 'stories') {
  if (!/^[^/\\\x00-\x1f]+\.mdx?$/.test(name) || name.startsWith('.')) throw new Error('请选择有效的 .md 或 .mdx 文件');
  if (collection === 'stories' && !name.endsWith('.md')) throw new Error('Stories 只允许纯文字 .md 文件');
  if (new TextEncoder().encode(content).length > 1024 * 1024) throw new Error('文章文件不能超过 1 MiB');
  const match = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|[a-zA-Z#<]|$)/.exec(content);
  // 无 frontmatter 的普通文章也能导入。仅在确实存在 YAML 区段时解析。
  const data = match ? load(match[1]) : {};
  if (data != null && (typeof data !== 'object' || Array.isArray(data))) throw new Error('YAML 属性区须为对象，请修复语法后重新导入');
  const originalFields = (data ?? {}) as Record<string, unknown>;
  // 默认值仅用于编辑台表单；不修改导入的原始文件，也不伪造发布日期。
  const fm: Record<string, unknown> = {
    title: name.replace(/\.mdx?$/, ''), description: '', pubDate: '', tags: [],
    ...originalFields,
  };
  delete fm.draft;
  // 可修正的属性问题只产生提示，不阻止打开；文件类型、语法与集合限制仍抛错。
  const warnings = [
    ...(!match ? ['文件未包含 YAML 文章属性，已使用文件名作为初始标题，可在右侧补充。'] : []),
    ...validatePublicationFields(fm, collection).map(issue => issue.message),
  ];
  const body = match ? content.slice(match[0].length) : content;
  const parser = unified().use(remarkParse);
  if (name.endsWith('.mdx')) parser.use(remarkMdx);
  // 这里只建立语法树，不编译或执行 import、JSX 和属性中的 JavaScript 表达式。
  const tree = parser.parse(body);
  if (collection === 'stories') {
    const walk = (node: { type: string; value?: string; children?: unknown[] }) => {
      if (['heading', 'image', 'imageReference', 'code', 'inlineCode'].includes(node.type) || (node.type === 'html' && !/^(?:\s*<br\s*\/?\s*>\s*)+$/.test(node.value ?? ''))) throw new Error('Stories 不支持标题、代码、图片或组件，仅允许文字与 <br/>');
      for (const child of node.children ?? []) walk(child as Parameters<typeof walk>[0]);
    };
    walk(tree);
  }
  // rawContent 是导入原文；frontmatter 是表单初值，两者不可误当成同一个已保存版本。
  return { frontmatter: fm, body, rawContent: content, warnings };
}
