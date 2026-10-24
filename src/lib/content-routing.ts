import { appConfig } from '../config/app';
import {
  type ContentCollection,
  type ContentLanguage,
  contentCollections,
} from '../config/content-collections';

export interface ContentTarget {
  collection: ContentCollection;
  lang: ContentLanguage;
  format: 'md' | 'mdx';
  slug: string;
  path: string;
  entryId: string;
  publicPath: string;
  publicUrl: string;
}

function assertSlug(slug: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error('地址标识仅允许小写英文字母、数字和单个连字符');
  }
}

/** Astro collection entry.id 到公开路径的唯一映射。 */
export function resolveContentPublicPath(
  collection: ContentCollection,
  lang: ContentLanguage,
  entryId: string,
): string {
  const routeId = collection === 'blog' && lang === 'zh' ? entryId.replace(/-zh$/, '') : entryId;
  return `${contentCollections[collection].route[lang]}/${routeId}`;
}

/** 新建文章的 slug 指最终 URL 尾段；中文 Blog 的 -zh 只加在文件名。 */
export function resolveNewContentTarget(input: {
  collection: ContentCollection;
  lang: ContentLanguage;
  slug: string;
  format?: 'md' | 'mdx';
}): ContentTarget {
  const definition = contentCollections[input.collection];
  if (!definition || !['en', 'zh'].includes(input.lang)) throw new Error('不支持的文章集合或语言');
  assertSlug(input.slug);
  const extension = `.${input.format ?? definition.defaultExtension.slice(1)}` as '.md' | '.mdx';
  if (!(definition.extensions as readonly string[]).includes(extension))
    throw new Error('该集合不支持此文件格式');
  const entryId =
    input.collection === 'blog' && input.lang === 'zh' ? `${input.slug}-zh` : input.slug;
  const path = `${definition.directory}/${entryId}${extension}`;
  const publicPath = resolveContentPublicPath(input.collection, input.lang, entryId);
  return {
    collection: input.collection,
    lang: input.lang,
    format: extension.slice(1) as 'md' | 'mdx',
    slug: input.slug,
    path,
    entryId,
    publicPath,
    publicUrl: new URL(publicPath, appConfig.siteUrl).toString(),
  };
}

/** 已有文件按真实路径计算 Astro entry.id，不擅自重命名历史文章。 */
export function resolveExistingContentTarget(
  collection: ContentCollection,
  lang: ContentLanguage,
  path: string,
): ContentTarget {
  const definition = contentCollections[collection];
  if (!definition || !['en', 'zh'].includes(lang)) throw new Error('不支持的文章集合或语言');
  const prefix = `${definition.directory}/`;
  if (
    path.length > 240 ||
    !path.startsWith(prefix) ||
    /[\\%?#]/.test(path) ||
    [...path].some((char) => char.charCodeAt(0) < 32) ||
    path.split('/').some((part) => part === '.' || part === '..')
  ) {
    throw new Error('文章路径不在允许的集合中');
  }
  const relative = path.slice(prefix.length);
  const extension = relative.endsWith('.mdx') ? '.mdx' : relative.endsWith('.md') ? '.md' : '';
  if (!extension || !(definition.extensions as readonly string[]).includes(extension)) {
    throw new Error('该集合不支持此文件格式');
  }
  const entryId = relative.slice(0, -extension.length);
  if (!entryId || entryId.split('/').some((part) => !part || part.startsWith('.'))) {
    throw new Error('文章路径无效');
  }
  // 现有 Stories 详情是 [slug]，不支持多级 ID；保持后台与公开路由一致。
  if (collection === 'stories' && entryId.includes('/'))
    throw new Error('Stories 不支持嵌套文章路径');
  const publicPath = resolveContentPublicPath(collection, lang, entryId);
  return {
    collection,
    lang,
    format: extension.slice(1) as 'md' | 'mdx',
    slug: entryId,
    path,
    entryId,
    publicPath,
    publicUrl: new URL(publicPath, appConfig.siteUrl).toString(),
  };
}
