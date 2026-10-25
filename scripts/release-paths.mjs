// 只把 Wrangler 实际扫描的顶层 SQL 视为迁移；快照 JSON 和其他 SQL 不触发远程操作。
export const migrationDirectory = 'drizzle/migrations';
export const migrationNamePattern = /^\d{4}_[\w-]+\.sql$/;

export function parseChangedPaths(output) {
  const fields = String(output).split('\0');
  if (fields.pop() !== '') throw new Error('Git 变更清单格式不完整');
  if (fields.length % 2 !== 0) throw new Error('Git 变更清单格式不完整');
  return Array.from({ length: fields.length / 2 }, (_, i) => ({
    status: fields[i * 2],
    path: fields[i * 2 + 1],
  }));
}

export function classifyMigrationChanges(entries) {
  if (!Array.isArray(entries)) throw new Error('无法确定 SQL 变更范围');
  const added = [];
  const modified = [];
  for (const entry of entries) {
    if (!entry || typeof entry.path !== 'string' || !/^[AMD]$/.test(entry.status)) {
      throw new Error('Git 变更状态无效；必须禁用重命名折叠');
    }
    const { path, status } = entry;
    if (
      path.includes('\\') ||
      path.split('/').some((part) => !part || part === '..' || part === '.')
    ) {
      throw new Error('Git 变更路径无效');
    }
    if (!path.startsWith(`${migrationDirectory}/`) || !path.endsWith('.sql')) continue;
    const file = path.slice(migrationDirectory.length + 1);
    if (!migrationNamePattern.test(file)) throw new Error(`迁移文件名或层级不受支持：${path}`);
    // 修改只触发核验，是否可执行必须再看远程 pending，不能在 Git 层猜测。
    // 重命名由 --no-renames 表现为删除+新增；删除仍一律停止。
    if (status === 'D') throw new Error(`禁止删除或重命名历史迁移，请新增 SQL：${path}`);
    const target = status === 'A' ? added : modified;
    if (added.includes(file) || modified.includes(file)) throw new Error('重复的迁移变更');
    target.push(file);
  }
  return Object.freeze({
    migrationChanged: added.length + modified.length > 0,
    added: Object.freeze(added.sort()),
    modified: Object.freeze(modified.sort()),
  });
}
