import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { collectContentImages } from '../../../lib/content-images';
import { parseSourceDocument, type SourceDocument } from '../../../lib/content-source';
import type { CmsDraft } from '../../db/schema/cms';
import { ValidationError } from '../../errors';

type AstNode = import('../../../lib/content-images').ImageAstNode;

function validDate(value: unknown): boolean {
  if (typeof value !== 'string' && !(value instanceof Date)) return false;
  if (!String(value).trim()) return false;
  return !Number.isNaN(new Date(value).getTime());
}

/** 发布校验只做 Worker 可确定的规则；Astro 构建仍是最终渲染门槛。 */
export function preparePublication(draft: CmsDraft): { source: string; assetPaths: string[] } {
  let parsed: SourceDocument;
  try {
    parsed = parseSourceDocument(draft.source);
  } catch (error) {
    throw new ValidationError(error instanceof Error ? error.message : 'YAML 文章属性无效');
  }
  if (!parsed.hasFrontmatter) throw new ValidationError('发布前必须补充 YAML 文章属性');
  const fields = parsed.fields;
  const issues: string[] = [];
  if (typeof fields.title !== 'string' || !fields.title.trim()) issues.push('标题不能为空');
  if (typeof fields.description !== 'string' || !fields.description.trim())
    issues.push('摘要不能为空');
  if (!validDate(fields.pubDate)) issues.push('pubDate 必须是有效日期');
  if (fields.updatedDate !== undefined && !validDate(fields.updatedDate))
    issues.push('updatedDate 必须是有效日期');
  if (!Array.isArray(fields.tags) || fields.tags.some((tag) => typeof tag !== 'string'))
    issues.push('tags 必须是字符串数组');
  if (fields.lang !== undefined && fields.lang !== draft.lang)
    issues.push('文章语言与目标地址不一致');
  if (draft.lang === 'zh' && fields.lang !== 'zh') issues.push('中文文章必须设置 lang: zh');
  if (fields.llms !== undefined && typeof fields.llms !== 'boolean')
    issues.push('llms 必须是布尔值');
  if (fields.heroImage !== undefined && typeof fields.heroImage !== 'string')
    issues.push('heroImage 必须是图片路径');
  if (fields.shareText !== undefined && typeof fields.shareText !== 'string')
    issues.push('shareText 必须是文本');
  if (
    draft.collection === 'stories' &&
    (fields.heroImage !== undefined || fields.shareText !== undefined)
  )
    issues.push('Stories 不支持图片或 Blog 分享属性');
  if (draft.collection === 'stories' && draft.format !== 'md')
    issues.push('Stories 只能发布 Markdown');
  if (issues.length) throw new ValidationError('发布前请修正文章属性', issues);

  let tree: AstNode;
  try {
    const parser = unified().use(remarkParse);
    if (draft.format === 'mdx') parser.use(remarkMdx);
    tree = parser.parse(parsed.body) as AstNode;
  } catch (error) {
    throw new ValidationError(
      error instanceof Error ? `正文语法错误：${error.message}` : '正文语法错误',
    );
  }
  const assets = new Set<string>();
  const checkAsset = (url: string) => {
    // 已发布的历史文章可能含外部图片；新文稿必须使用受控的站内公开路径。
    if (/^https:\/\//.test(url) && draft.baseBlobSha) return;
    if (!url.startsWith('/images/') || url.includes('..') || /[?#\\]/.test(url)) {
      throw new ValidationError('文章图片必须引用公开 /images/ 路径；请先完成受控上传');
    }
    assets.add(`public${url}`);
  };
  const walk = (node: AstNode) => {
    if (
      draft.collection === 'stories' &&
      [
        'heading',
        'image',
        'imageReference',
        'code',
        'inlineCode',
        'mdxJsxFlowElement',
        'mdxJsxTextElement',
        'mdxjsEsm',
        'mdxFlowExpression',
        'mdxTextExpression',
      ].includes(node.type)
    ) {
      throw new ValidationError('Stories 只允许纯文字和场景分隔，不支持标题、代码、图片或组件');
    }
    if (
      draft.collection === 'stories' &&
      node.type === 'html' &&
      !/^(?:\s*<br\s*\/?\s*>\s*)+$/.test(node.value ?? '')
    ) {
      throw new ValidationError('Stories 的 HTML 仅允许 <br/>');
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(tree);
  const references = collectContentImages(tree);
  if (references.issues.length) throw new ValidationError('图片引用无效', references.issues);
  for (const image of references.images) checkAsset(image.url);
  if (typeof fields.heroImage === 'string' && fields.heroImage) checkAsset(fields.heroImage);
  const source = draft.source;
  if (new TextEncoder().encode(source).length > 1024 * 1024)
    throw new ValidationError('发布文本超过 1 MiB');
  return { source, assetPaths: [...assets] };
}
