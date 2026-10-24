import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { stripVTControlCharacters } from 'node:util';
import { migrationDirectory, migrationNamePattern } from './release-paths.mjs';

// 当前只有生产环境。未配置的测试环境必须报错，绝不能默认使用生产库。
export const productionD1 = Object.freeze({
  environment: 'production',
  databaseName: 'BLOG-DB',
  configPath: 'wrangler.toml',
});

// 迁移必须是普通文件，不能沿符号链接读取迁移目录之外的文件。
export async function readMigrationSql(path) {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error('迁移 SQL 不能是链接、目录或特殊文件');
  return readFile(path, 'utf8');
}

export class D1ReleaseError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function parsePendingMigrationNames(output) {
  const text = stripVTControlCharacters(String(output)).trim();
  if (/\bERROR\b|[✘×]/i.test(text))
    throw new D1ReleaseError('D1_LIST_INVALID', '迁移查询输出包含错误');
  const empty = /(?:^|\n)(?:✅\s*)?No migrations to apply!\s*$/.test(text);
  const marker = 'Migrations to be applied:';
  if (empty && !text.includes(marker)) return [];
  const body = text.split(marker);
  if (empty || body.length !== 2) {
    throw new D1ReleaseError('D1_LIST_INVALID', '无法识别 Wrangler 迁移输出，不能按无迁移处理');
  }
  const names = [];
  // Wrangler 4 的表格输出不是 JSON。只接受完整的文件名单元格，未知输出关闭发布。
  for (const line of body[1].trim().split('\n')) {
    const value = line.trim();
    if (!value || /^[┌┐┬├┤┼└┘─┴┬+-]+$/.test(value)) continue;
    const cell = /^[│|]\s*([^│|]+?)\s*[│|]$/.exec(value)?.[1];
    if (cell === 'Name' || cell === 'name') continue;
    if (!cell || !migrationNamePattern.test(cell) || names.includes(cell)) {
      throw new D1ReleaseError('D1_LIST_INVALID', '迁移清单格式变化或包含重复/未知文件');
    }
    names.push(cell);
  }
  if (!names.length)
    throw new D1ReleaseError('D1_LIST_INVALID', '迁移表格为空，无法确认数据库状态');
  return names.sort();
}

// 仅屏蔽引号与注释，不解析完整 SQL。避免字符串里的 -- 截断后续真正的 DROP。
function sqlWithoutCommentsAndQuotes(sql) {
  let result = '';
  let mode = '';
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const next = sql[i + 1];
    if (mode === 'line') {
      if (char === '\n') {
        mode = '';
        result += '\n';
      }
    } else if (mode === 'block') {
      if (char === '*' && next === '/') {
        mode = '';
        i++;
      }
    } else if (mode) {
      if (char === mode) {
        if (next === mode) i++;
        else mode = '';
      }
    } else if (char === '-' && next === '-') {
      mode = 'line';
      i++;
      result += ' ';
    } else if (char === '/' && next === '*') {
      mode = 'block';
      i++;
      result += ' ';
    } else if (["'", '"', '`', '['].includes(char)) {
      mode = char === '[' ? ']' : char;
      result += ' ';
    } else result += char;
  }
  return result;
}

export function auditMigrationEntries(entries) {
  // 保守筛查，不是 SQL 安全证明；破坏性迁移走单独审查，不允许自动发布。
  const findings = [];
  for (const { file, sql } of entries) {
    if (!sql.trim()) findings.push({ file, rule: 'empty-sql' });
    const clean = sqlWithoutCommentsAndQuotes(sql);
    for (const [rule, pattern] of [
      ['drop', /\bDROP\s+(?:TABLE|COLUMN|INDEX|VIEW|TRIGGER)\b/i],
      ['rename', /\bRENAME\s+(?:TO|COLUMN)\b/i],
      ['delete-data', /\bDELETE\s+FROM\b/i],
    ]) {
      if (pattern.test(clean)) findings.push({ file, rule });
    }
  }
  return findings;
}

export function approvalDigest(plan) {
  return createHash('sha256').update(JSON.stringify(plan)).digest('hex');
}

export class D1ReleaseService {
  constructor({ run, readSql, config = productionD1 }) {
    if (config !== productionD1) throw new D1ReleaseError('D1_ENV_INVALID', '尚未配置该数据库环境');
    this.run = run;
    this.readSql = readSql;
    this.config = config;
  }

  async listPending() {
    const output = await this.run('pnpm', [
      'exec',
      'wrangler',
      'd1',
      'migrations',
      'list',
      this.config.databaseName,
      '--remote',
      '--config',
      this.config.configPath,
    ]);
    return parsePendingMigrationNames(output);
  }

  async prepare(changes, revision) {
    if (
      typeof changes?.migrationChanged !== 'boolean' ||
      !Array.isArray(changes.added) ||
      changes.added.some((file) => typeof file !== 'string' || !migrationNamePattern.test(file)) ||
      changes.migrationChanged !== changes.added.length > 0
    ) {
      throw new D1ReleaseError('D1_CHANGES_INVALID', '无法确定 SQL 变更范围');
    }
    if (!changes.migrationChanged) return { skipped: true, reason: 'no-migration-changes' };
    if (!/^[a-f0-9]{40}$/.test(revision?.base) || !/^[a-f0-9]{40}$/.test(revision?.head)) {
      throw new D1ReleaseError('D1_REVISION_INVALID', '迁移必须绑定完整发布提交');
    }
    const pending = await this.listPending();
    if (!pending.length) return { skipped: true, reason: 'already-applied' };
    if (pending.some((file) => !changes.added.includes(file))) {
      throw new D1ReleaseError(
        'D1_PENDING_UNEXPECTED',
        '存在本次 SQL 变更范围以外的待应用迁移，需要人工核验',
      );
    }
    const entries = await Promise.all(
      pending.map(async (file) => ({
        file,
        sql: await this.readSql(`${migrationDirectory}/${file}`),
      })),
    );
    const findings = auditMigrationEntries(entries);
    if (findings.length) {
      throw new D1ReleaseError(
        'D1_SQL_REVIEW_REQUIRED',
        `迁移需要单独审查：${JSON.stringify(findings)}`,
      );
    }
    const plan = {
      ...this.config,
      base: revision.base,
      head: revision.head,
      migrations: entries.map(({ file, sql }) => ({
        file,
        sha256: createHash('sha256').update(sql).digest('hex'),
      })),
    };
    return { skipped: false, plan, approval: approvalDigest(plan) };
  }

  async apply(prepared, approval, beforeApply = async () => {}) {
    if (prepared.skipped) return { applied: false, ...prepared };
    if (approval !== prepared.approval || approvalDigest(prepared.plan) !== approval) {
      throw new D1ReleaseError(
        'D1_CONFIRMATION_REQUIRED',
        `请审核迁移计划后，用 --approve ${prepared.approval} 明确批准`,
      );
    }
    await beforeApply();
    const names = prepared.plan.migrations.map(({ file }) => file);
    if (JSON.stringify(await this.listPending()) !== JSON.stringify(names)) {
      throw new D1ReleaseError('D1_PENDING_CHANGED', '批准后的待应用迁移清单已变化，停止发布');
    }
    for (const { file, sha256 } of prepared.plan.migrations) {
      const sql = await this.readSql(`${migrationDirectory}/${file}`);
      if (createHash('sha256').update(sql).digest('hex') !== sha256) {
        throw new D1ReleaseError('D1_SQL_CHANGED', '批准后的 SQL 内容已变化，停止发布');
      }
    }
    // runner 超时/失败直接向上传递：远程操作可能已执行，不能自动重试。
    await this.run('pnpm', [
      'exec',
      'wrangler',
      'd1',
      'migrations',
      'apply',
      this.config.databaseName,
      '--remote',
      '--config',
      this.config.configPath,
    ]);
    if ((await this.listPending()).length) {
      throw new D1ReleaseError('D1_STILL_PENDING', '迁移后仍有待应用文件，禁止部署');
    }
    return { applied: true };
  }
}
