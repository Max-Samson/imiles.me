import { ForbiddenError, ValidationError } from '../../errors';

const readActions = new Set([
  'getRepoDetails',
  'getRepoContents',
  'listFiles',
  'getFileContent',
  'getFileSha',
  'scanForContentDirectories',
  'scanForImageDirectories',
  'findProductionUrl',
  'getRepoTree',
]);

export function requireReadAction(action: unknown): string {
  if (typeof action !== 'string' || !readActions.has(action)) {
    throw new ForbiddenError('Pageel Git 兼容接口禁止保存、上传或修改；草稿请使用受保护的文档接口');
  }
  return action;
}

export function contentPath(value: unknown, directory = false): string {
  if (
    typeof value !== 'string' ||
    value.length > 240 ||
    /[\\%?#]/.test(value) ||
    [...value].some((char) => char.charCodeAt(0) < 32) ||
    value.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    throw new ValidationError('内容路径无效');
  }
  if (directory && /^content\/(blog|stories)(?:\/[^/]+)*$/.test(value)) return value;
  if (
    /^content\/blog\/(?:[^/]+\/)*[^/]+\.mdx?$/.test(value) ||
    /^content\/stories\/(?:[^/]+\/)*[^/]+\.md$/.test(value)
  )
    return value;
  throw new ForbiddenError('路径不在 CMS 内容集合中');
}

/** Pageel 只读图片列表仅开放博客素材目录；正文与任意 public 文件仍走原白名单。 */
export function blogImagePath(value: unknown, directory = false): string {
  if (
    typeof value !== 'string' ||
    value.length > 240 ||
    /[\\%?#]/.test(value) ||
    [...value].some((char) => char.charCodeAt(0) < 32) ||
    value.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    throw new ValidationError('图片路径无效');
  }
  if (directory && /^public\/images\/blog(?:\/[^/]+)*$/.test(value)) return value;
  if (/^public\/images\/blog\/(?:[^/]+\/)*[^/]+\.(?:png|jpe?g|webp)$/i.test(value)) return value;
  throw new ForbiddenError('路径不在 CMS 博客图片目录中');
}
