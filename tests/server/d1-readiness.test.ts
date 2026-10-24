import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { is } from 'drizzle-orm';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { getPlatformProxy, type PlatformProxy } from 'wrangler';
import { readMigrationSql } from '../../scripts/d1-release.mjs';
import {
  parseSchemaReadiness,
  readD1Requirements,
  schemaReadinessQuery,
} from '../../scripts/d1-schema.mjs';
import { d1Repository } from '../../src/server/admin/cms/repository';
import { readCmsOperation } from '../../src/server/admin/cms/service';
import * as schema from '../../src/server/db/schema';
import type { WorkerBindings } from '../../src/worker-configuration';

let platform: PlatformProxy<WorkerBindings>;
before(async () => {
  // 真正使用本地 D1 仿真器验证 PRAGMA 查询，不使用生产绑定或持久化数据。
  platform = await getPlatformProxy<WorkerBindings>({
    configPath: 'wrangler.toml',
    persist: false,
    remoteBindings: false,
  });
});
after(async () => platform?.dispose());

test('发布结构要求与当前 Drizzle 源码一致，防止只改 schema 却忘记生成迁移', async () => {
  const requirements = await readD1Requirements({ readSql: readMigrationSql });
  const tables = Object.values(schema).filter((value) => is(value, SQLiteTable));
  assert.equal(tables.length, requirements.tables.length);
  for (const table of tables) {
    const config = getTableConfig(table);
    const expected = requirements.tables.find((item) => item.name === config.name);
    assert.ok(expected, `最终快照缺少 ${config.name}`);
    const columns = config.columns.map((column) => ({
      name: column.name,
      type: column.getSQLType().toLowerCase(),
      notNull: column.notNull,
    }));
    const indexes = config.indexes.map(({ config: index }) => ({
      name: index.name,
      unique: Boolean(index.unique),
      partial: Boolean(index.where),
    }));
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    assert.deepEqual(columns.sort(byName), [...expected.columns].sort(byName));
    assert.deepEqual(indexes.sort(byName), [...expected.indexes].sort(byName));
  }
});

test('本地 D1 复现 CMS 漏迁移，补齐后结构门禁及文章列表同时通过', async () => {
  const requirements = await readD1Requirements({ readSql: readMigrationSql });
  const inspect = async () =>
    parseSchemaReadiness(
      JSON.stringify([await platform.env.DB.prepare(schemaReadinessQuery(requirements)).all()]),
      requirements,
    );
  const migrate = async (file: string) => {
    const sql = await readMigrationSql(`drizzle/migrations/${file}`);
    for (const statement of sql.split('--> statement-breakpoint').filter((part) => part.trim())) {
      await platform.env.DB.prepare(statement).run();
    }
  };
  await migrate(requirements.migrations[0]);
  assert.ok((await inspect()).missing.includes('table:cms_posts'));
  const readBlog = () =>
    readCmsOperation(d1Repository(platform.env), 'getRepoContents', { path: 'content/blog' });
  await assert.rejects(readBlog, /cms_posts/);
  for (const file of requirements.migrations.slice(1)) await migrate(file);
  assert.deepEqual(await inspect(), { ready: true, missing: [] });
  // Node 测试不展开 Vite 静态文章 glob；这里验证空库可正常读取而非抛出 500。
  assert.deepEqual(await readBlog(), []);
});
