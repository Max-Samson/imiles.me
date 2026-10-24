import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// 对完整构建产物取摘要，防止构建 A 提交却部署 B 提交，或产物在审批期间被替换。
export async function hashBuildArtifact(root = 'dist') {
  const hash = createHash('sha256');
  async function visit(directory, prefix = '') {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const relative = `${prefix}${entry.name}`;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path, `${relative}/`);
      else if (entry.isFile()) {
        const bytes = await readFile(path);
        hash.update(`${relative}\0${bytes.length}\0`).update(bytes);
      } else throw new Error(`构建产物不能包含链接或特殊文件：${relative}`);
    }
  }
  await visit(root);
  return hash.digest('hex');
}
