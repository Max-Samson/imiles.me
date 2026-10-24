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
function fixture({
  diff = '',
  dirty = '',
  hash = 'artifact',
  manifestHead = head,
  sql = false,
  failApply = false,
  productionChanged = false,
} = {}) {
  const calls = [];
  let deployed = false;
  let applied = false;
  let statusCalls = 0;
  const initial = { id: 'deployment-a', versions: [{ version_id: 'version-a', percentage: 100 }] };
  const final = { id: 'deployment-b', versions: [{ version_id: 'version-b', percentage: 100 }] };
  const deps = {
    log() {},
    artifactHash: async () => hash,
    readSql: async () => 'CREATE TABLE x(id integer);',
    read: async (path) =>
      path.endsWith('.sql')
        ? 'CREATE TABLE x(id integer);'
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
        if (args.includes('apply')) {
          if (failApply) throw new Error('未知远程结果');
          applied = true;
          return '';
        }
        return applied || !sql
          ? '✅ No migrations to apply!'
          : 'Migrations to be applied:\n│ Name │\n│ 0005_test.sql │';
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

test('无 SQL 变更正常部署同一份产物，完全不访问 D1，也不重复 build', async () => {
  const { deps, calls } = fixture();
  assert.equal((await release(deps, {})).deployed, true);
  assert.equal(calls.filter(([, args]) => args.includes('d1')).length, 0);
  assert.equal(calls.filter(([, args]) => args.includes('build')).length, 0);
  assert.equal(calls.filter(([, args]) => args.includes('deploy')).length, 1);
  assert.ok(calls.some(([, args]) => args.includes(`git-${head}`)));
});

test('仅计划模式不 apply、不 deploy；批准后迁移先于部署', async () => {
  const options = { diff: 'A\0drizzle/migrations/0005_test.sql\0', sql: true };
  const first = fixture(options);
  const plan = await release(first.deps, { planOnly: true });
  assert.equal(
    first.calls.some(([, args]) => args.includes('deploy') || args.includes('apply')),
    false,
  );
  const second = fixture(options);
  await release(second.deps, { approve: plan.prepared.approval });
  const applyIndex = second.calls.findIndex(([, args]) => args.includes('apply'));
  const deployIndex = second.calls.findIndex(([, args]) => args.includes('deploy'));
  assert.ok(applyIndex >= 0 && applyIndex < deployIndex);
});

test('SQL 未批准、apply 失败、历史 SQL 修改均阻止 deploy', async () => {
  const options = { diff: 'A\0drizzle/migrations/0005_test.sql\0', sql: true };
  const first = fixture(options);
  await assert.rejects(release(first.deps, {}), { code: 'D1_CONFIRMATION_REQUIRED' });
  const plan = await release(fixture(options).deps, { planOnly: true });
  const failed = fixture({ ...options, failApply: true });
  await assert.rejects(release(failed.deps, { approve: plan.prepared.approval }), /未知远程结果/);
  const modified = fixture({ diff: 'M\0drizzle/migrations/0004_old.sql\0' });
  await assert.rejects(release(modified.deps, {}), /历史迁移/);
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
