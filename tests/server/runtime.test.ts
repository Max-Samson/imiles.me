import assert from 'node:assert/strict';
import { after, before, mock, test } from 'node:test';
import { z } from 'astro/zod';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { getPlatformProxy, type PlatformProxy } from 'wrangler';
import { executeD1Batch } from '../../src/server/db/batch';
import { auditTimestamps, primaryKeyColumn } from '../../src/server/db/schema/common';
import { handleApiError } from '../../src/server/errors';
import {
  cacheKey,
  getOrLoadCache,
  safeCacheDelete,
  safeCacheGet,
  safeCacheSet,
} from '../../src/server/kv';
import type { WorkerBindings } from '../../src/worker-configuration';

// persist:false + remoteBindings:false 保证测试数据仅存在于本地临时仿真器。
let platform: PlatformProxy<WorkerBindings>;
before(async () => {
  platform = await getPlatformProxy<WorkerBindings>({
    configPath: 'wrangler.toml',
    persist: false,
    remoteBindings: false,
  });
});
after(async () => {
  await platform?.dispose();
});

const entities = sqliteTable('server_test_entities', {
  id: primaryKeyColumn('test'),
  title: text('title').notNull(),
  ...auditTimestamps(),
});

test('本地 D1 插入默认 ID/审计字段，更新自动刷新 updatedAt', async () => {
  const d1 = platform.env.DB;
  await d1
    .prepare(
      'CREATE TABLE server_test_entities (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)',
    )
    .run();
  const db = drizzle(d1);
  const [row] = await db
    .insert(entities)
    .values({ title: 'before', createdAt: 1, updatedAt: 1 })
    .returning();
  assert.match(row.id, /^test_[a-f0-9]{32}$/);
  const [updated] = await db
    .update(entities)
    .set({ title: 'after' })
    .where(eq(entities.id, row.id))
    .returning();
  assert.equal(updated.createdAt, 1);
  assert.ok(updated.updatedAt > 1);
  const [defaultRow] = await db.insert(entities).values({ title: 'defaults' }).returning();
  assert.ok(defaultRow.createdAt > 1);
  assert.ok(defaultRow.updatedAt > 1);
});

test('D1 batch 失败时整批回滚，HTTP 出口不暴露原始错误', async () => {
  const d1 = platform.env.DB;
  await d1.prepare('CREATE TABLE batch_probe (id INTEGER PRIMARY KEY)').run();
  const statements = [
    d1.prepare('INSERT INTO batch_probe VALUES (1)'),
    d1.prepare('INSERT INTO batch_probe VALUES (1)'),
  ];
  await assert.rejects(executeD1Batch(d1, statements), { code: 'INTERNAL_SERVER_ERROR' });
  const count = await d1
    .prepare('SELECT count(*) AS count FROM batch_probe')
    .first<number>('count');
  assert.equal(count, 0);
  assert.deepEqual(await executeD1Batch(d1, []), []);
  const log = mock.method(console, 'error', () => {});
  try {
    await executeD1Batch(d1, [d1.prepare('SELECT * FROM nonexistent_secret_table')]).catch(
      async (error: unknown) => {
        const response = handleApiError(error);
        assert.equal(response.status, 500);
        assert.doesNotMatch(await response.text(), /nonexistent_secret_table|SQL|D1_ERROR/);
      },
    );
  } finally {
    log.mock.restore();
  }
});

test('本地 KV 默认带 TTL，校验缓存，回源与失效闭环', async () => {
  const kv = platform.env.KV;
  const key = cacheKey('test', 'cache-value');
  const schema = z.object({ count: z.number() });
  let loads = 0;
  const load = async () => {
    loads++;
    return { count: 1 };
  };
  const first = await getOrLoadCache(kv, key, load, { parse: schema.parse });
  assert.deepEqual(first, { count: 1 });
  assert.deepEqual(await getOrLoadCache(kv, key, load, { parse: schema.parse }), first);
  assert.equal(loads, 1);
  const listed = await kv.list({ prefix: key });
  assert.ok(listed.keys[0].expiration);
  assert.ok((listed.keys[0].expiration ?? 0) > Date.now() / 1000);
  assert.equal(await safeCacheDelete(kv, key), true);
  assert.equal(await safeCacheGet(kv, key), null);
  await safeCacheSet(kv, key, { broken: true });
  const log = mock.method(console, 'warn', () => {});
  try {
    assert.equal(await safeCacheGet(kv, key, schema.parse), null);
    assert.deepEqual(await getOrLoadCache(kv, key, load, { parse: schema.parse }), { count: 1 });
  } finally {
    log.mock.restore();
  }
  assert.equal(loads, 2);
  for (const ttl of [0, -1, NaN, Infinity, 1.2]) {
    await assert.rejects(safeCacheSet(kv, key, {}, ttl), TypeError);
  }
  await assert.rejects(safeCacheSet(kv, key, undefined), TypeError);
  const missing = cacheKey('test', 'missing');
  await assert.rejects(
    getOrLoadCache(
      kv,
      missing,
      async () => {
        throw new Error('origin failed');
      },
      { parse: schema.parse },
    ),
    /origin failed/,
  );
});

test('KV 网络故障会回源，缓存写入/失效失败可观测且不伪造持久化成功', async () => {
  const failedKv = new Proxy(platform.env.KV, {
    get(target, property) {
      if (['get', 'put', 'delete'].includes(String(property))) {
        return async () => {
          throw new Error('offline');
        };
      }
      return Reflect.get(target, property);
    },
  });
  const log = mock.method(console, 'warn', () => {});
  try {
    assert.equal(await safeCacheGet(failedKv, 'test'), null);
    assert.equal(await safeCacheSet(failedKv, 'test', {}), false);
    assert.equal(await safeCacheDelete(failedKv, 'test'), false);
    assert.deepEqual(
      await getOrLoadCache(failedKv, 'test', async () => ({ count: 3 }), {
        parse: z.object({ count: z.number() }).parse,
      }),
      { count: 3 },
    );
  } finally {
    log.mock.restore();
  }
});
