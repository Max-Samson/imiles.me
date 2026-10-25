import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { hashBuildArtifact } from '../../scripts/build-artifact.mjs';
import {
  currentVersion,
  parseReleaseArguments,
  release,
  resolveReleaseBase,
} from '../../scripts/release.mjs';

const base = 'a'.repeat(40);
const head = 'b'.repeat(40);
const requirements = {
  migrations: ['0004_old.sql', '0005_test.sql'],
  tables: [
    { name: 'cms_posts', columns: [{ name: 'id', type: 'text', notNull: true }], indexes: [] },
  ],
  schemaSha256: 'schema-hash',
  configSha256: 'config-hash',
};
function fixture({
  diff = '',
  dirty = '',
  hash = 'artifact',
  manifestHead = head,
  sql = false,
  failApply = false,
  productionChanged = false,
  schemaMissing = false,
  schemaStillMissing = false,
  historical = false,
  schemaDrift = false,
  migrationSql = 'CREATE TABLE x(id integer);',
} = {}) {
  const calls = [];
  let deployed = false;
  let applied = false;
  let statusCalls = 0;
  let schemaQueries = 0;
  const initial = { id: 'deployment-a', versions: [{ version_id: 'version-a', percentage: 100 }] };
  const final = { id: 'deployment-b', versions: [{ version_id: 'version-b', percentage: 100 }] };
  const deps = {
    log() {},
    loadRequirements: async () => requirements,
    artifactHash: async () => hash,
    readSql: async () => migrationSql,
    read: async (path) =>
      path.endsWith('.sql')
        ? migrationSql
        : JSON.stringify({ head: manifestHead, artifact: 'artifact' }),
    run: async (command, args) => {
      calls.push([command, args]);
      if (command === 'git') {
        if (args[0] === 'status') return dirty;
        if (args[0] === 'diff') {
          assert.equal(args[4], base);
          assert.equal(args[5], head);
          return diff;
        }
        if (args[1] === '--is-shallow-repository') return 'false';
        if (args[0] === 'merge-base') return '';
        if (args[0] === 'rev-parse') return head;
      }
      if (args.includes('d1')) {
        if (args.includes('execute')) schemaQueries++;
        if (args.includes('execute'))
          return JSON.stringify([
            {
              success: true,
              results:
                (schemaMissing && !applied) ||
                schemaStillMissing ||
                (schemaDrift && schemaQueries > 1)
                  ? []
                  : [
                      {
                        kind: 'column',
                        table_name: 'cms_posts',
                        object_name: 'id',
                        data_type: 'text',
                        not_null: 1,
                      },
                    ],
            },
          ]);
        if (args.includes('apply')) {
          if (failApply) throw new Error('未知远程结果');
          applied = true;
          return '';
        }
        return applied || !sql
          ? '✅ No migrations to apply!'
          : `Migrations to be applied:\n│ Name │\n│ ${historical ? '0004_old.sql' : '0005_test.sql'} │`;
      }
      if (args.includes('status')) {
        statusCalls++;
        return JSON.stringify(deployed || (productionChanged && statusCalls > 1) ? final : initial);
      }
      if (args.includes('versions'))
        return JSON.stringify([
          {
            id: deployed ? 'version-b' : 'version-a',
            annotations: { 'workers/tag': `git-${deployed ? head : base}` },
          },
        ]);
      if (args.includes('deploy')) {
        deployed = true;
        return 'deployed';
      }
      throw new Error(`未预期调用：${command} ${args.join(' ')}`);
    },
  };
  return { deps, calls };
}

test('参数、生产灰度状态、缺失/冲突提交基线均严格校验', () => {
  assert.deepEqual(parseReleaseArguments(['--plan', '--base', base]), { planOnly: true, base });
  for (const args of [
    ['--base'],
    ['--approve', 'yes'],
    ['--env', 'test'],
    ['--base', base, '--base', base],
  ])
    assert.throws(() => parseReleaseArguments(args));
  assert.throws(() => currentVersion({ id: 'x', versions: [{ version_id: 'a', percentage: 50 }] }));
  const deployment = { id: 'x', versions: [{ version_id: 'a', percentage: 100 }] };
  assert.throws(() => resolveReleaseBase(deployment, []));
  assert.equal(resolveReleaseBase(deployment, [], base), base);
  assert.throws(() =>
    resolveReleaseBase(
      deployment,
      [{ id: 'a', annotations: { 'workers/tag': `git-${head}` } }],
      base,
    ),
  );
});

test('无 SQL 变更只读校验结构，不 list/apply，也不重复 build', async () => {
  const { deps, calls } = fixture();
  assert.equal((await release(deps, {})).deployed, true);
  assert.equal(
    calls.filter(([, args]) => args.includes('d1') && !args.includes('execute')).length,
    0,
  );
  assert.equal(calls.filter(([, args]) => args.includes('execute')).length, 2);
  assert.equal(calls.filter(([, args]) => args.includes('build')).length, 0);
  assert.equal(calls.filter(([, args]) => args.includes('deploy')).length, 1);
  assert.ok(calls.some(([, args]) => args.includes(`git-${head}`)));
});

test('仅计划模式不写入；自动范围迁移无需审批且先于部署', async () => {
  const options = { diff: 'A\0drizzle/migrations/0005_test.sql\0', sql: true };
  const first = fixture(options);
  const plan = await release(first.deps, { planOnly: true });
  assert.equal(
    first.calls.some(([, args]) => args.includes('deploy') || args.includes('apply')),
    false,
  );
  const second = fixture(options);
  assert.equal(plan.prepared.plan.execution, 'automatic');
  await release(second.deps, {});
  const applyIndex = second.calls.findIndex(([, args]) => args.includes('apply'));
  const deployIndex = second.calls.findIndex(([, args]) => args.includes('deploy'));
  assert.ok(applyIndex >= 0 && applyIndex < deployIndex);
});

test('人工范围未批准、apply 失败、已执行 SQL 修改均阻止 deploy', async () => {
  const options = { diff: 'A\0drizzle/migrations/0005_test.sql\0', sql: true };
  const first = fixture({ ...options, migrationSql: 'CREATE UNIQUE INDEX ux ON x(id);' });
  await assert.rejects(release(first.deps, {}), { code: 'D1_CONFIRMATION_REQUIRED' });
  const plan = await release(fixture(options).deps, { planOnly: true });
  const failed = fixture({ ...options, failApply: true });
  await assert.rejects(release(failed.deps, { approve: plan.prepared.approval }), /未知远程结果/);
  const modified = fixture({ diff: 'M\0drizzle/migrations/0004_old.sql\0' });
  await assert.rejects(release(modified.deps, {}), { code: 'D1_APPLIED_MIGRATION_CHANGED' });
  for (const f of [first, failed, modified])
    assert.equal(
      f.calls.some(([, args]) => args.includes('deploy')),
      false,
    );
});

test('脏源码或旧/被替换的产物在远程调用之前拒绝', async () => {
  for (const options of [{ dirty: ' M src/x.ts' }, { hash: 'replaced' }, { manifestHead: base }]) {
    const f = fixture(options);
    await assert.rejects(release(f.deps, {}));
    assert.equal(
      f.calls.some(([command]) => command === 'pnpm'),
      false,
    );
  }
});

test('真实产物摘要对文件名/内容敏感，并拒绝符号链接', async () => {
  const root = await mkdtemp(join(tmpdir(), 'imiles-artifact-'));
  try {
    await writeFile(join(root, 'a.js'), 'first');
    const a = await hashBuildArtifact(root);
    assert.equal(await hashBuildArtifact(root), a);
    await writeFile(join(root, 'a.js'), 'other');
    assert.notEqual(await hashBuildArtifact(root), a);
    await symlink(join(root, 'a.js'), join(root, 'link.js'));
    await assert.rejects(hashBuildArtifact(root), /链接/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('并发生产部署变化时停止，不覆盖其他任务的新版本', async () => {
  const f = fixture({ productionChanged: true });
  await assert.rejects(release(f.deps, {}), /其他任务/);
  assert.equal(
    f.calls.some(([, args]) => args.includes('deploy')),
    false,
  );
});

test('历史漏迁移即使没有 SQL diff 也阻止普通发布，显式计划和批准才能补齐', async () => {
  const options = { sql: true, historical: true, schemaMissing: true };
  const ordinary = fixture(options);
  await assert.rejects(release(ordinary.deps, {}), /数据库结构未就绪/);
  assert.equal(
    ordinary.calls.some(
      ([, args]) =>
        args.includes('apply') || args.includes('deploy') || args.includes('migrations'),
    ),
    false,
  );
  const planning = fixture(options);
  const plan = await release(planning.deps, { planOnly: true, reconcileD1: true });
  assert.equal(plan.schema.ready, false);
  assert.equal(plan.prepared.plan.reconcileD1, true);
  assert.equal(plan.prepared.plan.configSha256, requirements.configSha256);
  assert.equal(plan.prepared.plan.schemaSha256, requirements.schemaSha256);
  assert.equal(
    planning.calls.some(([, args]) => args.includes('apply') || args.includes('deploy')),
    false,
  );
  const unapproved = fixture(options);
  await assert.rejects(release(unapproved.deps, { reconcileD1: true }), {
    code: 'D1_CONFIRMATION_REQUIRED',
  });
  const approved = fixture(options);
  assert.equal(
    (await release(approved.deps, { reconcileD1: true, approve: plan.prepared.approval })).deployed,
    true,
  );
  const apply = approved.calls.findIndex(([, args]) => args.includes('apply'));
  const deploy = approved.calls.findIndex(([, args]) => args.includes('deploy'));
  assert.ok(apply > 0 && deploy > apply);
});

test('迁移记录显示无 pending 但结构缺失，或者 apply 后结构仍缺失，一律不部署', async () => {
  for (const options of [
    { schemaMissing: true },
    { sql: true, historical: true, schemaMissing: true, schemaStillMissing: true },
  ]) {
    const f = fixture(options);
    let approval;
    if (options.sql)
      approval = (await release(fixture(options).deps, { planOnly: true, reconcileD1: true }))
        .prepared.approval;
    await assert.rejects(release(f.deps, { reconcileD1: true, approve: approval }), {
      code: 'D1_SCHEMA_NOT_READY',
    });
    assert.equal(
      f.calls.some(([, args]) => args.includes('deploy')),
      false,
    );
  }
});

test('结构查询失败不能被当作无迁移跳过，旧批准不能跨补齐模式复用', async () => {
  const f = fixture();
  const run = f.deps.run;
  f.deps.run = (command, args) =>
    args.includes('execute') ? Promise.reject(new Error('schema network')) : run(command, args);
  await assert.rejects(release(f.deps, {}), /schema network/);
  assert.equal(
    f.calls.some(([, args]) => args.includes('deploy')),
    false,
  );
  const options = { sql: true, diff: 'A\0drizzle/migrations/0005_test.sql\0' };
  const normal = await release(fixture(options).deps, { planOnly: true });
  await assert.rejects(
    release(fixture(options).deps, { reconcileD1: true, approve: normal.prepared.approval }),
    { code: 'D1_CONFIRMATION_REQUIRED' },
  );
  assert.deepEqual(parseReleaseArguments(['--reconcile-d1', '--plan']), {
    planOnly: true,
    reconcileD1: true,
  });
  assert.throws(() => parseReleaseArguments(['--reconcile-d1', '--reconcile-d1']));
});

test('只读预检后数据库被改坏，最终结构复核阻止无 SQL 发布', async () => {
  const f = fixture({ schemaDrift: true });
  await assert.rejects(release(f.deps, {}), { code: 'D1_SCHEMA_NOT_READY' });
  assert.equal(
    f.calls.some(([, args]) => args.includes('deploy') || args.includes('apply')),
    false,
  );
});

test('批准不能复用于结构要求或 Wrangler 配置变化后的计划', async () => {
  const options = { sql: true, diff: 'A\0drizzle/migrations/0005_test.sql\0' };
  const approved = (await release(fixture(options).deps, { planOnly: true })).prepared.approval;
  for (const key of ['schemaSha256', 'configSha256']) {
    const f = fixture(options);
    f.deps.loadRequirements = async () => ({ ...requirements, [key]: 'changed' });
    await assert.rejects(release(f.deps, { approve: approved }), {
      code: 'D1_CONFIRMATION_REQUIRED',
    });
    assert.equal(
      f.calls.some(([, args]) => args.includes('apply') || args.includes('deploy')),
      false,
    );
  }
});

test('仅修改未执行 SQL 也进入迁移同步，自动执行先于 deploy', async () => {
  const f = fixture({ diff: 'M\0drizzle/migrations/0005_test.sql\0', sql: true });
  await release(f.deps, {});
  const apply = f.calls.findIndex(([, args]) => args.includes('apply'));
  const deploy = f.calls.findIndex(([, args]) => args.includes('deploy'));
  assert.ok(apply >= 0 && deploy > apply);
});

test('内容或仅 meta JSON 变更不触发迁移清单或写入，仍检查结构', async () => {
  for (const diff of [
    'M\0src/components/Test.tsx\0',
    'M\0content/blog/test.md\0',
    'M\0drizzle/migrations/meta/_journal.json\0',
  ]) {
    const f = fixture({ diff });
    await release(f.deps, {});
    assert.equal(f.calls.filter(([, args]) => args.includes('migrations')).length, 0);
    assert.equal(f.calls.filter(([, args]) => args.includes('execute')).length, 2);
  }
});

test('兼容 SQL 自动 apply 失败时不 deploy，不自动重试', async () => {
  const f = fixture({ diff: 'A\0drizzle/migrations/0005_test.sql\0', sql: true, failApply: true });
  await assert.rejects(release(f.deps, {}), /未知远程结果/);
  assert.equal(f.calls.filter(([, args]) => args.includes('apply')).length, 1);
  assert.equal(f.calls.filter(([, args]) => args.includes('deploy')).length, 0);
});
