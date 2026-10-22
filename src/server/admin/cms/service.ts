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
  return entries.filter((entry) => {
    try {
      contentPath(entry.path, entry.type === 'dir');
      return true;
    } catch {
      return false;
    }
  });
}
