import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { hashBuildArtifact } from './build-artifact.mjs';

// 保留调用者显式设置的堆限制；默认 4 GiB，为 CF 构建机的非堆内存留出空间。
const options = process.env.NODE_OPTIONS || '';
const env = {
  ...process.env,
  NODE_OPTIONS: /--max[-_]old[-_]space[-_]size(?:=|\s)/.test(options)
    ? options
    : `${options} --max-old-space-size=4096`.trim(),
};
for (const script of [
  'scripts/generate-llms-txt.mjs',
  'node_modules/astro/astro.js',
  'scripts/prepare-wrangler-assets.mjs',
]) {
  execFileSync(process.execPath, [script, ...(script.includes('/astro/') ? ['build'] : [])], {
    env,
    stdio: 'inherit',
  });
}
// 只记录本地提交与产物摘要，不访问 Cloudflare、D1 或任何认证材料。
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
await mkdir('.astro', { recursive: true });
await writeFile(
  '.astro/release-build.json',
  `${JSON.stringify({ head, artifact: await hashBuildArtifact() })}\n`,
);
