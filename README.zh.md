# imiles.me

> [Miles](https://imiles.me) 的个人网站与双语（EN/中文）数字花园 —— 基于 [Astro](https://astro.build)、React 与 Three.js 构建。

[English](./README.md) | **简体中文**

[![Website](https://img.shields.io/badge/website-imiles.me-blue)](https://imiles.me)
[![License: Code Apache-2.0 / Content CC BY-NC-ND 4.0](https://img.shields.io/badge/license-Apache--2.0%20%2B%20CC%20BY--NC--ND%204.0-lightgrey)](#许可证)
[![Built with Astro](https://img.shields.io/badge/built%20with-Astro%205-ff5d01)](https://astro.build)

## 功能特性

- **双语国际化（i18n）** —— 英文在根路径，中文位于 `/zh/` 下，UI 文案按语言拆分（`src/locales/`）。
- **MDX 博客** —— 支持 KaTeX 数学公式（`remark-math` + `rehype-katex`）、标题锚点、代码块复制按钮、动态双向链接的 `Cite`/`References` 引用，以及跨领域的 *Snippet of the Week*（每周片段）写作惯例。
- **Stories（故事）** —— 纯文本、第一人称的 Markdown 叙事，配以专门的阅读布局（`story-prose`）。
- **Notes / Projects / Research** —— 由类型化数据文件驱动的结构化内容页面。
- **交互式视觉** —— 基于 React Three Fiber 的 Three.js plexus 主页背景、滚动/动画岛屿、模糊搜索的博客搜索。
- **PWA** —— Web 清单（manifest）、Service Worker、离线回退页与自动生成的图标。
- **自动生成的产物** —— RSS 订阅、XML 站点地图、基于 [Satori](https://github.com/vercel/satori) 的逐页 OG 图片，以及面向 LLM 索引的 `llms.txt`。
- **性能预算** —— 首页打包体积超预算时可使 CI 失败的检查脚本。
- **暗色优先** —— Tailwind CSS v4，默认暗色主题并支持浅色切换。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 框架 | [Astro](https://astro.build) 5（server 输出）+ [React](https://react.dev) 19 岛屿 |
| 样式 | [Tailwind CSS](https://tailwindcss.com) v4、`tw-animate-css` |
| UI | [shadcn/ui](https://ui.shadcn.com) + [Radix UI](https://www.radix-ui.com)、[Magic UI](https://magicui.design)、自研组件 |
| 3D | [Three.js](https://threejs.org)（基于 [React Three Fiber](https://r3f.docs.pmnd.rs) + [drei](https://github.com/pmndrs/drei)） |
| 内容 | MDX/Markdown + [Astro content collections](https://docs.astro.build/en/guides/content-collections/)（`zod` 校验） |
| 部署 | [Cloudflare Workers](https://workers.cloudflare.com)（`@astrojs/cloudflare` 适配器 + Wrangler） |
| 工具链 | [Biome](https://biomejs.dev)（lint + format）、TypeScript、[Husky](https://typicode.github.io/husky/) + lint-staged |
| 包管理 | [pnpm](https://pnpm.io)（版本通过 `package.json` 的 `packageManager` 字段锁定） |

## UI 与组件库

项目的 UI 并非单一组件库，而是分层组成 —— Astro 页面按需水合 React 岛屿，以 Tailwind CSS v4 为样式系统，由三类组件来源组合而成：

| 层级 | 职责 | 位置 |
| --- | --- | --- |
| [shadcn/ui](https://ui.shadcn.com) + [Radix UI](https://www.radix-ui.com) | 可访问性基础控件：`button`、`dropdown-menu`、`navigation-menu`（new-york 风格、neutral 底色、lucide 图标 —— 见 `components.json`） | `src/components/ui/` |
| [Magic UI](https://magicui.design) | 动效与装饰型组件：aurora 文本、marquee 跑马灯、terminal 终端、shine border 发光边框、light rays 光线… | `src/registry/magicui/` |
| 项目自研 | 悬浮 dock、链接预览、时间线、导航菜单、搜索输入框、WebGL plexus 背景 | `src/components/ui/` |

**Magic UI** 组件统一放置在 `src/registry/magicui/`（已在 `components.json` 中注册，指向 `https://magicui.design/r/{name}`），以此保留外部 registry 的来源边界。当前收录：`AnimatedThemeToggler`、`AuroraText`、`FlickeringGrid`、`Highlighter`、`InteractiveHoverButton`、`LightRays`、`Marquee`、`PixelImage`、`ShineBorder`，以及 `Terminal`（内含 `TypingAnimation` / `AnimatedSpan`）。

实际应用示例：`LightRays` 用于内容页背景光线，`ShineBorder` 用于博客/项目/笔记卡片发光边框，`PixelImage` + `Marquee` 用于笔记卡片图像，`AuroraText` + `Terminal` 用于 About hero，`AnimatedThemeToggler` 用于页头主题切换，自研的 `PlexusBackground`（Three.js / R3F）用于首页首屏。

添加 Magic UI 组件：

```bash
npx shadcn@latest add @magicui/<组件名> --path src/registry/magicui
```

> 注意：此处推荐用 `npx` 而非 `pnpm dlx` —— shadcn CLI 在 `pnpm dlx` 的临时依赖树下会触发 `zod/v4` 解析错误（详见 `docs/ui.md`）。

完整的 UI 架构与放置约定见 [`docs/ui.md`](./docs/ui.md)。

## 项目结构

```
imiles.me/
├── src/
│   ├── pages/           # 路由：/, /blog, /stories, /notes, /projects,
│   │                    #   /research, /about, /zh/*, RSS, sitemap, OG 图片
│   ├── components/      # React (.tsx) 与 Astro (.astro) 组件
│   │   └── ui/          # UI 基础组件（shadcn 风格、Radix、自定义）
│   ├── registry/        # 收纳的 Magic UI 组件（magicui/）
│   ├── layouts/         # BaseLayout.astro, ArticleLayout.astro
│   ├── blog/            # MDX 博客文章（content collection）
│   ├── stories/         # 纯文本 Markdown 故事（content collection）
│   ├── data/            # 静态数据：作者、项目、研究、笔记、社交链接…
│   ├── locales/         # en.ts / zh.ts —— UI 翻译文案
│   ├── hooks/           # React hooks（滚动、减少动效、文字乱码…）
│   ├── lib/             # 工具函数：i18n、search、seo、readTime、mdxToMarkdown…
│   └── content.config.ts# 内容集合 schema（blog、stories）
├── public/              # 静态资源（图片、字体、图标、sw.js、llms.txt）
├── scripts/             # Node 脚本（见下文）
├── docs/                # 设计与分析文档
├── .github/workflows/   # CI 与部署流水线
├── astro.config.mjs
├── components.json     # shadcn/ui 与 Magic UI registry 配置
├── wrangler.toml        # Cloudflare Workers 配置
├── pnpm-workspace.yaml  # pnpm workspace 配置
└── package.json
```

## 环境要求

- [Node.js](https://nodejs.org) **22+**（CI 与本地脚本均使用此版本）
- [pnpm](https://pnpm.io) **11+** —— 项目包管理器，版本由 `package.json` 中的 `packageManager` 字段锁定（Corepack：`corepack enable`）

## 快速开始

```bash
git clone https://github.com/Max-Samson/imiles.me.git
cd imiles.me

pnpm install
pnpm dev
```

开发服务器运行于 `http://localhost:4321`。

> 本地开发无需任何环境变量。可选的变量见[性能预算](#性能预算)。

## 可用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动 Astro 开发服务器 |
| `pnpm build` | 生产构建，随后准备 Cloudflare 资源（写入 `.assetsignore`） |
| `pnpm preview` | 本地预览生产构建产物 |
| `pnpm check` | Astro 类型与内容集合检查 |
| `pnpm lint` / `lint:fix` | Biome 代码检查（含自动修复） |
| `pnpm format` / `format:check` | Biome 格式化（含仅检查模式） |
| `pnpm generate-icons` | 从 `public/images/weblogo.jpeg` 生成 PWA 图标 |
| `pnpm generate:llms` | 根据内容集合重新生成 `public/llms.txt` |
| `pnpm perf:budget` | 针对 `dist/` 检查首页性能预算 |
| `pnpm deploy` | 构建并部署到 Cloudflare Workers（`wrangler deploy`） |

## 脚本（`scripts/`）

| 脚本 | 用途 |
| --- | --- |
| `generate-icons.mjs` | 从 logo 以圆形遮罩生成普通 + maskable 的 PWA 图标（192/512/180） |
| `generate-llms-txt.mjs` | 生成 `public/llms.txt` —— 面向 LLM 的博客、故事、项目、研究与笔记索引，按语言分组 |
| `check-homepage-performance.mjs` | 校验打包体积预算（CSS、Hero/PlexusScene/SocialDock 分包、阻塞样式表、首页 KaTeX/Google Fonts） |
| `prepare-wrangler-assets.mjs` | 写入 `dist/.assetsignore`，避免 Worker 脚本被当作静态资源对外提供 |

### 性能预算

```bash
pnpm build
pnpm perf:budget                          # 摘要报告
PERF_URL=http://127.0.0.1:4321/ pnpm perf:budget   # 额外检查 HTML 链接与岛屿组件
PERF_BUDGET_FAIL=1 pnpm perf:budget       # 预算失败时以非零状态退出（用于 CI）
pnpm perf:budget -- --json                # 机器可读的 JSON 报告
```

## 内容写作

内容存放于 `src/blog/`（`.mdx`）与 `src/stories/`（`.md`），并通过 `src/content.config.ts` 中的 schema 校验。

- **博客文章** —— frontmatter 必填：`title`、`description`、`pubDate`、`tags`；可选：`heroImage`、`updatedDate`、`draft`、`shareText`、`lang`、`llms`。支持 KaTeX 数学公式与 React 岛屿组件（`client:load` / `client:visible`）。
- **故事** —— frontmatter 必填：`title`、`description`、`pubDate`、`tags`；可选：`draft`、`llms`。纯散文：不使用图片、组件、标题或数学公式。破折号用 `--`，场景切换用 `---`。
- 设置 `draft: true` 可将内容从生产环境隐藏。
- 含引用的文章使用 `Cite` / `References` 组件；每篇文章按惯例以 `ExploreCard` 内的 *Snippet of the Week*（每周片段）收尾。

完整的写作规范（样式、片段、引用、图片署名）见 [`AGENTS.md`](./AGENTS.md)。

## 部署

站点以 [Cloudflare Worker](https://workers.cloudflare.com) 形式运行，采用服务端渲染：

```bash
pnpm deploy          # pnpm build && wrangler deploy
```

`wrangler.toml` 将 Worker 绑定到自定义域名 `imiles.me`（启用 `nodejs_compat` 兼容标志）。

### GitHub Actions

| 工作流 | 触发时机 | 内容 |
| --- | --- | --- |
| `ci.yml` | 针对 `main` 的 Pull Request | Lint、格式检查、Astro 类型检查、生产构建、产物上传 |
| `deploy.yml` | 推送到 `main`/`master`、手动触发 | 构建后通过 [`cloudflare/wrangler-action`](https://github.com/cloudflare/wrangler-action) 执行 `wrangler deploy` |

部署工作流需要在仓库 Secrets 中配置 `CLOUDFLARE_API_TOKEN`，且该 Token 具备向目标账号部署 Worker 的权限。

## 致谢

灵感源自 [`urmzd/urmzd.com`](https://github.com/urmzd/urmzd.com) 及更广泛的开源生态（Astro、React、Three.js、Tailwind、shadcn/ui、Biome）。本站在此基础上增加了定制内容、双语本地化、交互式视觉体验，以及完整的生产化工具链（CI/CD、PWA、性能预算、面向 LLM 的输出）—— 属于 Miles 自己的个人站点。

## 许可证

本项目采用双许可证：

- **代码**（源码、配置、工具）—— [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
- **内容**（博客文章、故事、图片、品牌素材）—— [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/)

欢迎以 Apache-2.0 条款贡献代码；贡献的图片必须是原创作品或与 CC BY-NC-ND 4.0 兼容。
