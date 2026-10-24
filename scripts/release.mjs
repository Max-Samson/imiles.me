import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { hashBuildArtifact } from './build-artifact.mjs';
import { D1ReleaseService, readMigrationSql } from './d1-release.mjs';
import { readD1Requirements } from './d1-schema.mjs';
import { classifyMigrationChanges, parseChangedPaths } from './release-paths.mjs';

const execute = promisify(execFile);
const shaPattern = /^[a-f0-9]{40}$/;
const configArgs = ['--config', 'wrangler.toml'];

export function parseReleaseArguments(args) {
  const options = { planOnly: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--plan') options.planOnly = true;
    else if (args[i] === '--reconcile-d1') {
      if (options.reconcileD1) throw new Error('发布参数重复');
      options.reconcileD1 = true;
    } else if (['--base', '--approve'].includes(args[i])) {
      const key = args[i].slice(2);
      if (options[key] || !args[i + 1] || args[i + 1].startsWith('--'))
        throw new Error('发布参数缺失或重复');
      options[key] = args[++i];
    } else throw new Error(`不支持的发布参数：${args[i]}`);
  }
  if (options.base && !shaPattern.test(options.base)) throw new Error('--base 必须是完整提交 SHA');
  if (options.approve && !/^[a-f0-9]{64}$/.test(options.approve))
    throw new Error('--approve 必须是完整计划摘要');
  return options;
}

export function currentVersion(deployment) {
  const versions = deployment?.versions;
  if (
    !deployment?.id ||
    !Array.isArray(versions) ||
    versions.length !== 1 ||
    versions[0].percentage !== 100 ||
    typeof versions[0].version_id !== 'string'
  ) {
    throw new Error('无法确定唯一的生产版本；灰度部署请走专门发布流程');
  }
  return versions[0].version_id;
}

export function resolveReleaseBase(deployment, versions, bootstrapBase) {
  const id = currentVersion(deployment);
  if (!Array.isArray(versions)) throw new Error('Worker 版本清单格式无效');
  const version = versions.find((item) => item.id === id);
  const tag = version?.annotations?.['workers/tag'];
  const base = typeof tag === 'string' && /^git-[a-f0-9]{40}$/.test(tag) ? tag.slice(4) : null;
  if (base) {
    if (bootstrapBase && bootstrapBase !== base) throw new Error('不能覆盖已记录的生产提交基线');
    return base;
  }
  // 老部署没有提交标签时，首次接入需人工确认生产实际提交；绝不猜测 HEAD^。
  if (!bootstrapBase || !shaPattern.test(bootstrapBase)) {
    throw new Error('生产版本缺少提交标签，请首次接入时显式提供 --base <当前生产完整提交SHA>');
  }
  return bootstrapBase;
}

export async function release(
  {
    run,
    read = readFile,
    readSql = readMigrationSql,
    artifactHash = hashBuildArtifact,
    log = console.log,
    loadRequirements = readD1Requirements,
  },
  options,
) {
  const git = async (...args) => (await run('git', args)).trim();
  const wrangler = (...args) => run('pnpm', ['exec', 'wrangler', ...args, ...configArgs]);
  const deployment = async () => JSON.parse(await wrangler('deployments', 'status', '--json'));
  const head = await git('rev-parse', 'HEAD');
  if (!shaPattern.test(head)) throw new Error('无法确认当前提交');
  if ((await git('status', '--porcelain', '--untracked-files=normal')) !== '') {
    throw new Error('发布必须使用干净的已提交源码；不会部署本地未提交修改');
  }
  const manifest = JSON.parse(await read('.astro/release-build.json', 'utf8'));
  if (manifest.head !== head || manifest.artifact !== (await artifactHash())) {
    throw new Error('构建产物与当前提交不匹配，请先执行 pnpm build');
  }
  const originalDeployment = await deployment();
  const versions = JSON.parse(await wrangler('versions', 'list', '--json'));
  const base = resolveReleaseBase(originalDeployment, versions, options.base);
  // CF 浅克隆可能不含生产提交；只补全 Git 历史，不读取或操作任何认证材料。
  if ((await git('rev-parse', '--is-shallow-repository')) === 'true') {
    await run('git', ['fetch', '--unshallow', 'origin']);
  }
  await run('git', ['merge-base', '--is-ancestor', base, head]);
  const changes = classifyMigrationChanges(
    parseChangedPaths(
      await run('git', ['diff', '--name-status', '-z', '--no-renames', base, head, '--']),
    ),
  );
  const service = new D1ReleaseService({ run, readSql });
  const requirements = await loadRequirements({ read, readSql });
  // 普通发布仅查询结构，不列迁移、不写数据库；历史漏迁移也不能静默绕过。
  const schema = await service.inspectSchema(requirements);
  if (!schema.ready && !changes.migrationChanged && !options.reconcileD1) {
    throw new Error(
      `数据库结构未就绪：${schema.missing.join(', ')}；请先用 --reconcile-d1 --plan 审查历史迁移`,
    );
  }
  const prepared = await service.prepare(
    changes,
    { base, head },
    {
      ...options,
      knownMigrations: requirements.migrations,
      schemaSha256: requirements.schemaSha256,
      configSha256: requirements.configSha256,
    },
  );
  // 已记录执行、结构却缺失时，禁止重放历史 SQL；需要人工恢复与核验。
  if (prepared.skipped && !schema.ready) await service.assertReady(requirements);
  log(JSON.stringify({ base, head, changes, schema, ...prepared }, null, 2));
  if (options.planOnly) return { planned: true, prepared, schema };

  const verifyUnchanged = async () => {
    // 乐观并发检查不能替代平台串行发布：同一生产 Worker 必须只有一个发布入口。
    const active = await deployment();
    if (
      active.id !== originalDeployment.id ||
      currentVersion(active) !== currentVersion(originalDeployment)
    ) {
      throw new Error('生产部署已被其他任务修改，停止本次发布');
    }
    if (
      (await git('rev-parse', 'HEAD')) !== head ||
      (await git('status', '--porcelain', '--untracked-files=normal')) !== '' ||
      manifest.artifact !== (await artifactHash())
    ) {
      throw new Error('源码或构建产物在发布期间变化，停止发布');
    }
  };
  await service.apply(prepared, options.approve, verifyUnchanged);
  await verifyUnchanged();
  // 迁移成功但结构仍不完整，或校验后被外部修改，都不能继续部署代码。
  await service.assertReady(requirements);
  // 使用同一构建产物部署，不在这里重复构建；标签为下一次发布提供可靠基线。
  const output = await wrangler('deploy', '--tag', `git-${head}`);
  log(output);
  const deployed = await deployment();
  const publishedVersions = JSON.parse(await wrangler('versions', 'list', '--json'));
  if (resolveReleaseBase(deployed, publishedVersions) !== head) {
    throw new Error('部署后提交标签与本次提交不匹配，请核验生产状态，不要盲目重试');
  }
  return { deployed: true, head };
}

async function run(command, args) {
  // 超时只代表本地等待结束，不能推断远程迁移或部署未执行；调用者不会自动重试。
  const { stdout } = await execute(command, args, {
    encoding: 'utf8',
    timeout: 10 * 60 * 1000,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, CI: 'true', NO_COLOR: '1' },
  });
  return stdout;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await release({ run }, parseReleaseArguments(process.argv.slice(2)));
  } catch (error) {
    console.error(`发布停止：${error.message}`);
    process.exitCode = 1;
  }
}
