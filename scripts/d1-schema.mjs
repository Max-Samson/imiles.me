import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { migrationDirectory, migrationNamePattern } from './release-paths.mjs';

const identifier = /^[a-z_][a-z0-9_]*$/;
const hash = (value) => createHash('sha256').update(value).digest('hex');

/**
 * 从受版本控制的迁移与最终快照生成要求，不连接数据库，不手写另一份表清单。
 * @param {{read?: (path: string, encoding: 'utf8') => Promise<string>, list?: (path: string) => Promise<string[]>, readSql?: (path: string) => Promise<string>}} [options]
 */
export async function readD1Requirements({ read = readFile, list = readdir, readSql } = {}) {
  if (typeof readSql !== 'function') throw new Error('缺少安全的迁移读取器');
  const journal = JSON.parse(await read(`${migrationDirectory}/meta/_journal.json`, 'utf8'));
  if (journal.dialect !== 'sqlite' || !Array.isArray(journal.entries) || !journal.entries.length) {
    throw new Error('D1 迁移元数据无效');
  }
  const migrations = journal.entries.map((entry, index) => {
    const name = `${entry.tag}.sql`;
    if (entry.idx !== index || !migrationNamePattern.test(name)) {
      throw new Error('D1 迁移编号或文件名无效');
    }
    return name;
  });
  const files = (await list(migrationDirectory)).filter((name) => name.endsWith('.sql')).sort();
  if (JSON.stringify(files) !== JSON.stringify([...migrations].sort())) {
    throw new Error('迁移 SQL 与 Drizzle journal 不一致，禁止推断数据库已就绪');
  }
  const index = String(migrations.length - 1).padStart(4, '0');
  const snapshot = JSON.parse(
    await read(`${migrationDirectory}/meta/${index}_snapshot.json`, 'utf8'),
  );
  if (snapshot.dialect !== 'sqlite' || !snapshot.tables || !Object.keys(snapshot.tables).length) {
    throw new Error('缺少最终数据库结构快照');
  }
  const tables = Object.values(snapshot.tables).map((table) => {
    if (!identifier.test(table.name) || !table.columns || !Object.keys(table.columns).length) {
      throw new Error('数据库表要求无效');
    }
    const columns = Object.values(table.columns).map((column) => {
      if (!identifier.test(column.name) || typeof column.type !== 'string') {
        throw new Error('数据库列要求无效');
      }
      return {
        name: column.name,
        type: column.type.toLowerCase(),
        notNull: column.notNull === true,
      };
    });
    const indexes = Object.values(table.indexes ?? {}).map((item) => {
      if (!identifier.test(item.name)) throw new Error('数据库索引要求无效');
      return { name: item.name, unique: item.isUnique === true, partial: Boolean(item.where) };
    });
    return { name: table.name, columns, indexes };
  });
  const entries = await Promise.all(
    migrations.map(async (file) => ({
      file,
      sha256: hash(await readSql(`${migrationDirectory}/${file}`)),
    })),
  );
  const configSha256 = hash(await read('wrangler.toml', 'utf8'));
  return {
    migrations,
    tables,
    configSha256,
    schemaSha256: hash(JSON.stringify({ tables, entries })),
  };
}

/** 单条只读查询：不读取文章、身份或业务行，不创建迁移记录表。 */
export function schemaReadinessQuery(requirements) {
  if (
    !requirements.tables?.length ||
    requirements.tables.some((table) => !identifier.test(table.name))
  ) {
    throw new Error('缺少有效的数据库就绪要求');
  }
  const names = requirements.tables.map((table) => `'${table.name}'`).join(', ');
  return `SELECT 'column' AS kind, m.name AS table_name, p.name AS object_name,
    lower(p.type) AS data_type, p."notnull" AS not_null, NULL AS is_unique, NULL AS is_partial
    FROM sqlite_master AS m JOIN pragma_table_info(m.name) AS p
    WHERE m.type = 'table' AND m.name IN (${names})
    UNION ALL
    SELECT 'index', m.name, i.name, NULL, NULL, i."unique", i.partial
    FROM sqlite_master AS m JOIN pragma_index_list(m.name) AS i
    WHERE m.type = 'table' AND m.name IN (${names})`;
}

export function parseSchemaReadiness(output, requirements) {
  const data = JSON.parse(output);
  if (
    !Array.isArray(data) ||
    data.length !== 1 ||
    data[0]?.success !== true ||
    !Array.isArray(data[0].results)
  ) {
    throw new Error('无法识别 D1 结构查询结果，禁止按已就绪处理');
  }
  const rows = data[0].results;
  const seen = new Set();
  for (const row of rows) {
    if (
      !['column', 'index'].includes(row.kind) ||
      typeof row.table_name !== 'string' ||
      typeof row.object_name !== 'string' ||
      (row.kind === 'column' &&
        (typeof row.data_type !== 'string' || ![0, 1].includes(row.not_null))) ||
      (row.kind === 'index' &&
        (![0, 1].includes(row.is_unique) || ![0, 1].includes(row.is_partial)))
    ) {
      throw new Error('D1 结构查询行格式异常');
    }
    const key = JSON.stringify([row.kind, row.table_name, row.object_name]);
    if (seen.has(key)) throw new Error('D1 结构查询包含重复对象');
    seen.add(key);
  }
  const missing = [];
  for (const table of requirements.tables) {
    const columns = rows.filter((row) => row.kind === 'column' && row.table_name === table.name);
    if (!columns.length) {
      missing.push(`table:${table.name}`);
      continue;
    }
    for (const column of table.columns) {
      const row = columns.find((item) => item.object_name === column.name);
      if (
        !row ||
        row.data_type.toLowerCase() !== column.type ||
        Boolean(row.not_null) !== column.notNull
      ) {
        missing.push(`column:${table.name}.${column.name}`);
      }
    }
    for (const index of table.indexes) {
      const row = rows.find(
        (item) =>
          item.kind === 'index' &&
          item.table_name === table.name &&
          item.object_name === index.name,
      );
      if (
        !row ||
        Boolean(row.is_unique) !== index.unique ||
        Boolean(row.is_partial) !== index.partial
      ) {
        missing.push(`index:${table.name}.${index.name}`);
      }
    }
  }
  // 这是结构就绪检查，不是数据、CHECK 表达式或索引列定义的完整一致性证明。
  return { ready: missing.length === 0, missing };
}
