import { cmsConfig } from './config';
import { contentPath, requireReadAction } from './policy';
import type { CmsRepository } from './repository';

export async function readCmsOperation(
  repository: CmsRepository,
  action: unknown,
  params: Record<string, unknown>,
) {
  const operation = requireReadAction(action);
  if (operation === 'scanForContentDirectories') return ['content/blog', 'content/stories'];
  if (operation === 'scanForImageDirectories') return [];
  if (operation === 'findProductionUrl') return null;
  if (operation === 'getFileContent' && params.path === '.pageelrc.json')
    return JSON.stringify(cmsConfig);
  const path = contentPath(
    params.path,
    ['getRepoContents', 'listFiles', 'getRepoTree'].includes(operation),
  );
  if (operation === 'getFileContent') return repository.read(path);
  if (operation === 'getFileSha') return repository.sha(path);
  const entries = await repository.list(path);
  // GitHub Contents 只返回当前目录；递归枚举确保代码中新增的嵌套文章也进入列表。
  if (operation === 'listFiles' || operation === 'getRepoTree') {
    const pending = entries.filter((entry) => entry.type === 'dir').map((entry) => entry.path);
    // 去重与目录数上限约束远端扫描，避免异常目录树导致持续递归请求。
    const seen = new Set([path]);
    while (pending.length) {
      const directory = pending.shift();
      if (!directory) break;
      contentPath(directory, true);
      if (seen.has(directory)) continue;
      if (seen.size >= 100) throw new Error('内容目录过多，请缩小扫描范围');
      seen.add(directory);
      const children = await repository.list(directory);
      entries.push(...children);
      pending.push(...children.filter((entry) => entry.type === 'dir').map((entry) => entry.path));
    }
  }
  return entries.filter((entry) => {
    try {
      contentPath(entry.path, entry.type === 'dir');
      return true;
    } catch {
      return false;
    }
  });
}
