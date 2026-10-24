import { mkdirSync, writeFileSync } from 'node:fs';

export function buildBoundaries() {
  let ssr = false;
  let transformed = 0;
  return {
    name: 'imiles-build-boundaries',
    apply: 'build',
    configResolved(config) {
      ssr = Boolean(config.build.ssr);
    },
    buildStart() {
      transformed = 0;
    },
    transform() {
      transformed++;
    },
    generateBundle(_options, bundle) {
      const modules = Object.values(bundle)
        .filter((item) => item.type === 'chunk')
        .flatMap((chunk) => Object.entries(chunk.modules))
        .filter(([, info]) => info.renderedLength > 0);
      // 浏览器专属包不得重新进入 SSR；这是防止依赖边界回退的构建门禁。
      if (ssr) {
        const forbidden = modules.find(
          ([id]) =>
            /node_modules\/(?:three|@react-three\/[^/]+|@mdxeditor\/editor)\//.test(id) ||
            /\/src\/components\/admin\//.test(id) ||
            /\/packages\/pageel-workbench\//.test(id),
        );
        if (forbidden) this.error(`浏览器专属模块进入 SSR：${forbidden[0]}`);
      }
      mkdirSync('.astro', { recursive: true });
      writeFileSync(
        `.astro/build-${ssr ? 'server' : 'client'}-audit.json`,
        JSON.stringify(
          {
            transformed,
            renderedModules: modules.length,
            chunks: Object.values(bundle)
              .filter((item) => item.type === 'chunk')
              .map((chunk) => ({ file: chunk.fileName, bytes: Buffer.byteLength(chunk.code) })),
          },
          null,
          2,
        ),
      );
    },
  };
}
