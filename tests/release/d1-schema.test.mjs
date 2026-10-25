import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import ts from 'typescript';
import {
  auditMigrationEntries,
  D1ReleaseService,
  readMigrationSql,
} from '../../scripts/d1-release.mjs';
import {
  parseSchemaReadiness,
  readD1Requirements,
  schemaReadinessQuery,
} from '../../scripts/d1-schema.mjs';

const requirements = () => readD1Requirements({ readSql: readMigrationSql });
const result = (rows) => JSON.stringify([{ success: true, results: rows }]);

test('真实迁移在隔离 SQLite 上复现历史漏表，补齐后满足最终快照要求', async () => {
  const expected = await requirements();
  assert.ok(expected.tables.some((table) => table.name === 'cms_posts'));
  assert.equal(expected.migrations.length, 6);
  const historyMigration = expected.migrations.at(-1);
  assert.deepEqual(
    auditMigrationEntries([
      {
        file: historyMigration,
        sql: await readMigrationSql(`drizzle/migrations/${historyMigration}`),
      },
    ]),
    [],
  );
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(await readMigrationSql(`drizzle/migrations/${expected.migrations[0]}`));
    const query = schemaReadinessQuery(expected);
    assert.match(query, /^SELECT /);
    const initial = parseSchemaReadiness(result(db.prepare(query).all()), expected);
    assert.equal(initial.ready, false);
    assert.ok(initial.missing.includes('table:cms_posts'));
    for (const file of expected.migrations.slice(1))
      db.exec(await readMigrationSql(`drizzle/migrations/${file}`));
    assert.deepEqual(parseSchemaReadiness(result(db.prepare(query).all()), expected), {
      ready: true,
      missing: [],
    });
    db.exec('DROP INDEX cms_posts_active_target');
    assert.ok(
      parseSchemaReadiness(result(db.prepare(query).all()), expected).missing.includes(
        'index:cms_posts.cms_posts_active_target',
      ),
    );
  } finally {
    db.close();
  }
});

test('未知/失败/重复结果关闭发布，列类型或约束不符不能伪装为已就绪', async () => {
  const expected = {
    tables: [
      { name: 'cms_posts', columns: [{ name: 'id', type: 'text', notNull: true }], indexes: [] },
    ],
  };
  const row = {
    kind: 'column',
    table_name: 'cms_posts',
    object_name: 'id',
    data_type: 'text',
    not_null: 1,
  };
  assert.equal(parseSchemaReadiness(result([row]), expected).ready, true);
  for (const value of [
    '',
    '{}',
    '[{"success":false,"results":[]}]',
    '[{"success":true}]',
    result([{}]),
    result([row, row]),
  ]) {
    assert.throws(() => parseSchemaReadiness(value, expected));
  }
  for (const patch of [{ data_type: 'integer' }, { not_null: 0 }]) {
    assert.equal(parseSchemaReadiness(result([{ ...row, ...patch }]), expected).ready, false);
  }
  assert.throws(() => schemaReadinessQuery({ tables: [{ name: "x');DROP TABLE x;--" }] }));
  const service = new D1ReleaseService({ run: async () => result([]), readSql: readMigrationSql });
  await assert.rejects(service.assertReady(expected), { code: 'D1_SCHEMA_NOT_READY' });
});

test('journal/SQL 不一致停止，结构批准绑定历史 SQL 与配置内容', async () => {
  const before = await requirements();
  const changed = await readD1Requirements({
    readSql: async (path) => (await readMigrationSql(path)) + '\n-- reviewed update',
  });
  assert.notEqual(before.schemaSha256, changed.schemaSha256);
  const config = await readD1Requirements({
    readSql: readMigrationSql,
    read: async (path, ...args) =>
      (await readFile(path, ...args)) + (path === 'wrangler.toml' ? '\n# target change' : ''),
  });
  assert.notEqual(before.configSha256, config.configSha256);
  await assert.rejects(
    readD1Requirements({
      readSql: readMigrationSql,
      list: async (path) => (await readdir(path)).filter((name) => !name.startsWith('0004_')),
    }),
    /journal/,
  );
});

test('历史补齐只接受受跟踪的迁移，不能用补齐参数批准未知远程文件', async () => {
  const service = new D1ReleaseService({
    run: async () => 'Migrations to be applied:\n│ Name │\n│ 9999_unknown.sql │',
    readSql: readMigrationSql,
  });
  await assert.rejects(
    service.prepare(
      { migrationChanged: false, added: [] },
      { base: 'a'.repeat(40), head: 'b'.repeat(40) },
      { reconcileD1: true, knownMigrations: (await requirements()).migrations },
    ),
    { code: 'D1_PENDING_UNEXPECTED' },
  );
});

test('完整类型检查保留原入口，只排除复制的第三方 vendor，而非自有代码', async () => {
  const config = JSON.parse(await readFile('tsconfig.json', 'utf8'));
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(pkg.scripts.check, 'astro check');
  assert.ok(config.exclude.includes('public/vendor'));
  assert.ok(
    !config.exclude.includes('packages') &&
      !config.exclude.includes('src') &&
      !config.exclude.includes('public'),
  );
  assert.ok(config.include.includes('**/*'));
  const project = ts.parseJsonConfigFileContent(config, ts.sys, process.cwd());
  assert.ok(project.fileNames.some((name) => name.endsWith('/public/sw.js')));
  assert.ok(
    project.fileNames.some((name) => name.endsWith('/upstream/components/PostDetailView.tsx')),
  );
  assert.ok(!project.fileNames.some((name) => name.includes('/public/vendor/')));
});
