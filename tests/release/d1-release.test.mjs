import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  auditMigrationEntries,
  D1ReleaseService,
  parsePendingMigrationNames,
  readMigrationSql,
} from '../../scripts/d1-release.mjs';
import { classifyMigrationChanges, parseChangedPaths } from '../../scripts/release-paths.mjs';

const file = '0005_test.sql';
const changes = { migrationChanged: true, added: [file] };
const revision = { base: 'a'.repeat(40), head: 'b'.repeat(40) };
const table = (names) =>
  `Migrations to be applied:\n┌────────────────┐\n│ Name │\n├────────────────┤\n${names.map((name) => `│ ${name} │`).join('\n')}\n└────────────────┘`;
const empty = '✅ No migrations to apply!';
function fixture(
  outputs = [table([file]), table([file]), '', empty],
  sql = 'CREATE TABLE test (id integer);',
) {
  const calls = [];
  return {
    calls,
    service: new D1ReleaseService({
      run: async (command, args) => {
        calls.push([command, args]);
        const output = outputs.shift();
        if (output instanceof Error) throw output;
        assert.notEqual(output, undefined, '出现未预期的远程调用');
        return output;
      },
      readSql: async () => sql,
    }),
  };
}

test('Git 使用 NUL 分隔，只有新增或修改 SQL 触发，删除/重命名拒绝', () => {
  const entries = parseChangedPaths('M\0src/a.ts\0A\0drizzle/migrations/0005_test.sql\0');
  assert.deepEqual(classifyMigrationChanges(entries).added, [file]);
  assert.equal(
    classifyMigrationChanges([{ status: 'M', path: 'drizzle/migrations/meta/_journal.json' }])
      .migrationChanged,
    false,
  );
  assert.equal(
    classifyMigrationChanges([{ status: 'A', path: 'other.sql' }]).migrationChanged,
    false,
  );
  assert.deepEqual(
    classifyMigrationChanges([{ status: 'M', path: `drizzle/migrations/${file}` }]).modified,
    [file],
  );
  for (const status of ['D', 'R100'])
    assert.throws(() => classifyMigrationChanges([{ status, path: `drizzle/migrations/${file}` }]));
  for (const path of ['../a.sql', 'drizzle/migrations/nested/0005_test.sql'])
    assert.throws(() => classifyMigrationChanges([{ status: 'A', path }]));
  assert.throws(() => parseChangedPaths('A\0incomplete'));
  assert.throws(() => classifyMigrationChanges(null));
});

test('迁移输出只能是明确无迁移，或完整且无重复的文件表格', () => {
  assert.deepEqual(parsePendingMigrationNames(empty), []);
  assert.deepEqual(parsePendingMigrationNames(table([file])), [file]);
  for (const value of [
    '',
    'network error',
    file,
    table([]),
    table([file, file]),
    table(['../bad.sql']),
    `${table([file])}\n${empty}`,
  ]) {
    assert.throws(() => parsePendingMigrationNames(value));
  }
});

test('没有 SQL 变化时连迁移查询都不运行', async () => {
  const { service, calls } = fixture([]);
  const prepared = await service.prepare({ migrationChanged: false, added: [] }, revision);
  await service.apply(prepared);
  assert.equal(calls.length, 0);
  await assert.rejects(service.prepare({}, revision));
});

test('待迁移已应用时不重复执行', async () => {
  const { service, calls } = fixture([empty]);
  const prepared = await service.prepare(changes, revision);
  assert.equal(prepared.reason, 'already-applied');
  await service.apply(prepared);
  assert.equal(calls.length, 1);
});

test('SQL 审计确实阻止破坏性迁移；普通注释不误中', async () => {
  assert.equal(
    auditMigrationEntries([{ file, sql: '-- DROP TABLE x\nCREATE TABLE x (id integer)' }]).length,
    0,
  );
  for (const sql of ['', 'DROP TABLE x;', 'ALTER TABLE x RENAME TO y;', 'DELETE FROM x;']) {
    const { service, calls } = fixture([table([file])], sql);
    await assert.rejects(service.prepare(changes, revision), { code: 'D1_SQL_REVIEW_REQUIRED' });
    assert.equal(calls.length, 1);
  }
});

test('清单外迁移、runner 失败和无效环境不能降级为跳过', async () => {
  const { service } = fixture([table(['0003_old.sql'])]);
  await assert.rejects(service.prepare(changes, revision), { code: 'D1_PENDING_UNEXPECTED' });
  await assert.rejects(
    fixture([new Error('network')]).service.prepare(changes, revision),
    /network/,
  );
  assert.throws(() => new D1ReleaseService({ config: { environment: 'test' } }), {
    code: 'D1_ENV_INVALID',
  });
});

test('超出自动范围的 SQL 仍需批准，批准绑定环境、提交、文件和 SQL 摘要', async () => {
  const { service, calls } = fixture(undefined, 'CREATE UNIQUE INDEX ux ON test(id);');
  const prepared = await service.prepare(changes, revision);
  await assert.rejects(service.apply(prepared), { code: 'D1_CONFIRMATION_REQUIRED' });
  await assert.rejects(service.apply(prepared, '0'.repeat(64)), {
    code: 'D1_CONFIRMATION_REQUIRED',
  });
  assert.equal(calls.length, 1);
  const changed = await fixture().service.prepare(changes, { ...revision, head: 'c'.repeat(40) });
  assert.notEqual(changed.approval, prepared.approval);
  assert.deepEqual(await service.apply(prepared, prepared.approval), { applied: true });
  assert.equal(calls.filter(([, args]) => args.includes('apply')).length, 1);
  assert.ok(calls.every(([, args]) => args.includes('DB') && args.includes('wrangler.toml')));
});

test('批准后清单、SQL 或生产状态变化均阻止写入', async () => {
  const a = fixture([table([file]), empty]);
  const pa = await a.service.prepare(changes, revision);
  await assert.rejects(a.service.apply(pa, pa.approval), { code: 'D1_PENDING_CHANGED' });
  const b = fixture();
  const pb = await b.service.prepare(changes, revision);
  b.service.readSql = async () => 'CREATE TABLE changed (id integer);';
  await assert.rejects(b.service.apply(pb, pb.approval), { code: 'D1_SQL_CHANGED' });
  const c = fixture();
  const pc = await c.service.prepare(changes, revision);
  await assert.rejects(
    c.service.apply(pc, pc.approval, async () => {
      throw new Error('生产变化');
    }),
    /生产变化/,
  );
  for (const x of [a, b, c])
    assert.equal(x.calls.filter(([, args]) => args.includes('apply')).length, 0);
});

test('apply 超时/失败不自动重试，残留 pending 不允许继续部署', async () => {
  const a = fixture([table([file]), table([file]), new Error('unknown outcome')]);
  const pa = await a.service.prepare(changes, revision);
  await assert.rejects(a.service.apply(pa, pa.approval), /unknown outcome/);
  assert.equal(a.calls.filter(([, args]) => args.includes('apply')).length, 1);
  const b = fixture([table([file]), table([file]), '', table([file])]);
  const pb = await b.service.prepare(changes, revision);
  await assert.rejects(b.service.apply(pb, pb.approval), { code: 'D1_STILL_PENDING' });
});

test('SQL 字符串中的注释符不能隐藏后续破坏性操作，文字内容不会误判成 SQL', () => {
  assert.ok(
    auditMigrationEntries([{ file, sql: "INSERT INTO log VALUES ('--'); DROP TABLE users;" }]).some(
      (x) => x.rule === 'drop',
    ),
  );
  assert.equal(
    auditMigrationEntries([
      { file, sql: "INSERT INTO log VALUES ('DROP TABLE users', 'a''--b'); -- note" },
    ]).length,
    0,
  );
  assert.throws(() => parsePendingMigrationNames('ERROR network\nNo migrations to apply!'));
});

test('迁移读取拒绝符号链接和目录，不读取链接目标', async () => {
  const root = await mkdtemp(join(tmpdir(), 'imiles-sql-'));
  try {
    const file = join(root, '0005_test.sql');
    await writeFile(file, 'CREATE TABLE test(id integer);');
    assert.equal(await readMigrationSql(file), 'CREATE TABLE test(id integer);');
    const link = join(root, '0006_link.sql');
    await symlink(file, link);
    await assert.rejects(readMigrationSql(link), /链接/);
    await assert.rejects(readMigrationSql(root), /目录/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('新增兼容 SQL 无需逐计划批准，执行前仍复核 pending 与内容', async () => {
  const { service, calls } = fixture();
  const prepared = await service.prepare(changes, revision);
  assert.equal(prepared.plan.execution, 'automatic');
  assert.deepEqual(await service.apply(prepared), { applied: true });
  assert.equal(calls.filter(([, args]) => args.includes('apply')).length, 1);
});

test('未执行 SQL 修改可自动同步；已执行修改即使没有 pending 也不能跳过', async () => {
  const modified = { migrationChanged: true, added: [], modified: [file] };
  const pending = fixture();
  const plan = await pending.service.prepare(modified, revision);
  assert.equal(plan.plan.execution, 'automatic');
  await pending.service.apply(plan);
  const applied = fixture([empty]);
  await assert.rejects(applied.service.prepare(modified, revision), {
    code: 'D1_APPLIED_MIGRATION_CHANGED',
  });
  assert.equal(applied.calls.filter(([, args]) => args.includes('apply')).length, 0);
});

test('新增与修改混合时须逐项核实，不能用其他 pending 掩盖已执行文件修改', async () => {
  const f = fixture([table([file])]);
  await assert.rejects(
    f.service.prepare(
      { migrationChanged: true, added: [file], modified: ['0004_old.sql'] },
      revision,
    ),
    { code: 'D1_APPLIED_MIGRATION_CHANGED' },
  );
  assert.equal(f.calls.filter(([, args]) => args.includes('apply')).length, 0);
});

test('无 SQL 变化不查 pending、不 apply，不能顺便自动补齐历史', async () => {
  const f = fixture([]);
  const prepared = await f.service.prepare(
    { migrationChanged: false, added: [], modified: [] },
    revision,
  );
  assert.equal(prepared.reason, 'no-migration-changes');
  await f.service.apply(prepared);
  assert.equal(f.calls.length, 0);
});

test('历史 reconcile 即使全为兼容 SQL 也不自动批准', async () => {
  const f = fixture();
  const plan = await f.service.prepare(
    { migrationChanged: false, added: [], modified: [] },
    revision,
    { reconcileD1: true, knownMigrations: [file] },
  );
  assert.equal(plan.plan.execution, 'approval-required');
  await assert.rejects(f.service.apply(plan), { code: 'D1_CONFIRMATION_REQUIRED' });
  assert.equal(f.calls.filter(([, args]) => args.includes('apply')).length, 0);
  await f.service.apply(plan, plan.approval);
});

test('仅正则未命中危险操作不足以自动批准；未知 SQL 和数据写入保留人工门禁', async () => {
  for (const sql of [
    'CREATE UNIQUE INDEX ix ON test(id);',
    'ALTER TABLE test ADD value TEXT NOT NULL DEFAULT 1;',
    'INSERT INTO test VALUES(1);',
    'UPDATE test SET id=2;',
    'PRAGMA user_version=1;',
  ]) {
    const f = fixture(undefined, sql);
    const plan = await f.service.prepare(changes, revision);
    assert.equal(plan.plan.execution, 'approval-required');
    assert.ok(plan.manualReasons.length);
    await assert.rejects(f.service.apply(plan), { code: 'D1_CONFIRMATION_REQUIRED' });
    assert.equal(f.calls.filter(([, args]) => args.includes('apply')).length, 0);
  }
});

test('自动计划被改动或携带旧摘要时停止，执行前重新审计 SQL 策略', async () => {
  const changed = fixture();
  const plan = await changed.service.prepare(changes, revision);
  plan.plan.head = 'c'.repeat(40);
  await assert.rejects(changed.service.apply(plan), { code: 'D1_PLAN_CHANGED' });
  const stale = fixture();
  const valid = await stale.service.prepare(changes, revision);
  await assert.rejects(stale.service.apply(valid, '0'.repeat(64)), {
    code: 'D1_CONFIRMATION_REQUIRED',
  });
  const manual = fixture(undefined, 'CREATE UNIQUE INDEX ix ON test(id);');
  const forged = await manual.service.prepare(changes, revision);
  // 即使调用方错误地重新计算了摘要，执行时也不能把未知 SQL 伪装成自动策略。
  forged.plan.execution = 'automatic';
  const { approvalDigest } = await import('../../scripts/d1-release.mjs');
  forged.approval = approvalDigest(forged.plan);
  await assert.rejects(manual.service.apply(forged), { code: 'D1_SQL_REVIEW_REQUIRED' });
  for (const f of [changed, stale, manual])
    assert.equal(f.calls.filter(([, args]) => args.includes('apply')).length, 0);
});

test('新增 SQL 已执行后的重跑不 apply；修改 SQL 已执行后无内容凭证则停止而不重放', async () => {
  const f = fixture([empty]);
  const plan = await f.service.prepare(changes, revision);
  await f.service.apply(plan);
  assert.equal(plan.reason, 'already-applied');
  assert.equal(f.calls.length, 1);
  const edit = fixture([empty]);
  await assert.rejects(
    edit.service.prepare({ migrationChanged: true, added: [], modified: [file] }, revision),
    { code: 'D1_APPLIED_MIGRATION_CHANGED' },
  );
  assert.equal(edit.calls.length, 1);
});

test('无效或重复新增/修改清单在任何远程调用之前拒绝', async () => {
  for (const value of [
    { migrationChanged: true, added: [], modified: [] },
    { migrationChanged: false, added: [file], modified: [] },
    { migrationChanged: true, added: [file], modified: [file] },
    { migrationChanged: true, added: [], modified: ['../bad.sql'] },
    { migrationChanged: true, added: [], modified: 'bad' },
  ]) {
    const f = fixture([]);
    await assert.rejects(f.service.prepare(value, revision), { code: 'D1_CHANGES_INVALID' });
    assert.equal(f.calls.length, 0);
  }
});
