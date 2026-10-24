import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import { buildBoundaries } from '../../scripts/build-boundaries.mjs';
import { extractHeadingsFromHtml } from '../../src/lib/content-headings.ts';

const require = createRequire(import.meta.url);
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

test('两个大型图标库只使用实际的单文件入口，并保留上游同名图标', () => {
  let count = 0;
  for (const path of files('src').filter(
    (path) => /\.(?:tsx?|astro)$/.test(path) && !path.endsWith('.d.ts'),
  )) {
    const code = readFileSync(path, 'utf8');
    assert.doesNotMatch(
      code,
      /from ['"](?:@tabler\/icons-react|@icons-pack\/react-simple-icons)['"]/,
    );
    for (const match of code.matchAll(
      /from ['"](@tabler\/icons-react\/dist\/esm\/icons\/(\w+)\.mjs|@icons-pack\/react-simple-icons\/icons\/(\w+)\.mjs)['"]/g,
    )) {
      const target = require.resolve(match[1]);
      const name = match[2] || match[3];
      const root = match[2] ? '@tabler/icons-react' : '@icons-pack/react-simple-icons';
      const manifestPath = require.resolve(`${root}/package.json`);
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      const barrel = readFileSync(join(manifestPath, '..', manifest.module), 'utf8');
      assert.ok(barrel.includes(`default as ${name}`), `单文件必须对应原有导出：${name}`);
      assert.ok(readFileSync(target, 'utf8').length > 0);
      count++;
    }
  }
  assert.ok(count > 30, '必须覆盖现有图标使用点，避免空跑通过');
});

test('公开内容读取不再依赖后台发布与重型 Markdown 渲染模块', () => {
  const paths = files('src/pages').filter((path) =>
    /^src\/pages\/(?:zh\/)?(?:blog|stories)\/.*\.astro$/.test(path),
  );
  for (const path of paths) {
    assert.doesNotMatch(readFileSync(path, 'utf8'), /server\/admin\/cms/);
  }
  assert.doesNotMatch(
    readFileSync('src/server/content/read-repository.ts', 'utf8'),
    /from ['"][^'"]*(?:admin|katex|marked)/,
  );
  assert.doesNotMatch(readFileSync('src/lib/content-headings.ts', 'utf8'), /\bimport\b/);
  assert.deepEqual(
    extractHeadingsFromHtml(
      '<h1 id="top">忽略</h1><h2 id="hello"><b>你好</b></h2><h3 id="detail">详情</h3>',
    ),
    [
      { depth: 2, slug: 'hello', text: '你好' },
      { depth: 3, slug: 'detail', text: '详情' },
    ],
  );
});

test('SSR 门禁拒绝浏览器专属模块，客户端构建仍可使用这些包', () => {
  for (const id of [
    '/x/node_modules/three/build/three.js',
    '/x/node_modules/@react-three/fiber/index.js',
    '/x/node_modules/@mdxeditor/editor/index.js',
    '/x/src/components/admin/AdminApp.tsx',
  ]) {
    const plugin = buildBoundaries();
    plugin.configResolved({ build: { ssr: true } });
    assert.throws(
      () =>
        plugin.generateBundle.call(
          {
            error(message) {
              throw new Error(message);
            },
          },
          {},
          {
            x: {
              type: 'chunk',
              code: 'x',
              fileName: 'x.js',
              modules: { [id]: { renderedLength: 1 } },
            },
          },
        ),
      /浏览器专属/,
    );
  }
  // 客户端可达，不能为了减小 Worker 而误删浏览器功能。
  const source = readFileSync('src/components/ui/plexus-background.tsx', 'utf8');
  assert.match(source, /import\.meta\.env\.SSR/);
  assert.match(source, /import\('\.\/plexus-webgl\/PlexusScene'\)/);
  assert.match(source, /useEffect\(\(\) => setMounted\(true\), \[\]\)/);
});
