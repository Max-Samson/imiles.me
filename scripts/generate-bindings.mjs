import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

// Astro 使用 DOM 类型，绑定类型采用模块导入，避免注入整套 Workers 全局类型。
const path = 'src/worker-configuration.d.ts';
execFileSync(
  'wrangler',
  ['types', path, '--env-interface', 'WorkerBindings', '--include-runtime', 'false'],
  { stdio: 'inherit' },
);
// Astro 提供 Worker 入口；不让生成的 RPC 元数据引入 dist 下的打包产物。
const generated = readFileSync(path, 'utf8').replace(
  /^declare namespace Cloudflare \{[\s\S]*?^\}\n/gm,
  '',
);
writeFileSync(
  path,
  `import type { D1Database, Fetcher, KVNamespace } from '@cloudflare/workers-types';\n${generated}\nexport type { WorkerBindings };\n`,
);
execFileSync('biome', ['check', '--write', path], { stdio: 'inherit' });
