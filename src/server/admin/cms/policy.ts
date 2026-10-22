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
    throw new ForbiddenError('兼容性验证阶段禁止保存、上传、删除和修改配置');
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
  if (directory && ['content/blog', 'content/stories'].includes(value)) return value;
  if (
    /^content\/blog\/(?:[^/]+\/)*[^/]+\.mdx?$/.test(value) ||
    /^content\/stories\/(?:[^/]+\/)*[^/]+\.md$/.test(value)
  )
    return value;
  throw new ForbiddenError('路径不在 CMS 内容集合中');
}
