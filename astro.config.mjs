// @ts-check
import { appConfig } from './src/config/app';
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import cloudflare from '@astrojs/cloudflare';
// https://astro.build/config
export default defineConfig({
  site: appConfig.siteUrl,
  output: 'server',
  adapter: cloudflare(),
  i18n: {
    locales: ['en', 'zh'],
    defaultLocale: 'en',
    routing: {
      prefixDefaultLocale: false,
    },
  },
  integrations: [react(), mdx()],
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex, rehypeSlug],
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@pageel/plugin-mdx': new URL('./packages/pageel-workbench/plugin-mdx/index.ts', import.meta.url).pathname,
        '@pageel/plugin-types': new URL('./packages/pageel-workbench/plugin-types/index.ts', import.meta.url).pathname,
      },
    },
    optimizeDeps: {
      include: ['motion', 'motion/react', 'pdfjs-dist'],
    },
    ssr: {
      noExternal: ['motion'],
    },
  },
});
