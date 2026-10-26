# imiles.me

> Miles 的双语（English / 中文）个人网站与数字花园，基于 [Astro](https://astro.build)、React 和 Three.js 构建。

[English](./README.md) | **简体中文** · [访问网站](https://imiles.me)

## 功能说明

| 模块 | 当前实现 |
| --- | --- |
| 首页与导航 | 分屏展示项目、经历、长文、技术云和数字花园；提供章节导航及 `⌘/Ctrl+K` 搜索弹窗。英文使用根路径，中文使用 `/zh/`。 |
| 博客与故事 | 仓库内容集合和 D1 已发布文章共同组成公开列表。文章显示阅读时间、标签，并支持分享、复制 Markdown、标题锚点、代码复制；标题足够多时显示移动端目录。博客 MDX 支持 KaTeX、引用和交互组件；故事采用纯文本阅读版式。 |
| 项目与笔记 | 项目页展示状态、技术、功能网格与演示；笔记有独立列表和详情页；关于页展示双语经历时间线。 |
| PDF 阅读 | `/pdf` 基于 PDF.js 渲染页面，支持目录和缩略图导航、全文搜索、缩放及下载；博客可通过 `PDFCard`、`PDFLink` 链接到阅读器。 |
| 友链 | `/friends` 和 `/zh/friends` 展示已审核友链，支持前端搜索。访客可经 Turnstile 验证提交站点与可选截图；管理员可批准、拒绝、隐藏或恢复友链。配置邮件服务后可发送通知。 |
| 后台与 CMS | `/admin` 提供概览、友链审核及博客/故事工作台。工作台管理 D1 草稿、文章图片、发布、删除和修订历史；生产环境的管理 API 校验 Cloudflare Access 身份和权限。 |
| 内容分发 | RSS、XML 站点地图、Satori 生成的 OG 图片、生成的 `llms.txt`、Web App Manifest、Service Worker 和 PWA 图标。 |

## 技术栈

| 层级 | 技术与用途 |
| --- | --- |
| 页面渲染 | Astro 5 的 server 输出模式及 Cloudflare 适配器；React 19 岛屿只在交互控件和可视化需要时水合。 |
| 内容 | Astro content collections、MDX/Markdown、用于公式的 `remark-math` 与 `rehype-katex`、用于标题 ID 的 `rehype-slug`。仓库内容与 D1 已发布内容在运行时合并。 |
| UI 与动效 | Tailwind CSS v4、Radix 与 shadcn/ui 控件、收录的 Magic UI 和 React Bits 效果、用于转场与滚动交互的 Motion，以及 Lucide、Tabler、Iconify 图标。 |
| 图形与文档 | Three.js 和 React Three Fiber 实现 plexus 场景；PDF.js 实现阅读器；Satori 排版 OG 图片；Sharp 处理图片。 |
| 服务端与数据 | Cloudflare Workers、D1 + Drizzle ORM 与 SQL 迁移、用于缓存和会话的 KV，以及通过 AWS S3 客户端访问的 Supabase Storage。 |
| 安全与集成 | Cloudflare Access 负责后台授权，Turnstile 验证友链申请；可选的 Resend 邮件通知；CMS 的 Git 发布通道使用 GitHub Contents API。 |
| 开发工具 | TypeScript、pnpm、Biome、Astro 检查、Node 测试、Husky/lint-staged、Wrangler 和 GitHub Actions CI。 |

## 视觉设计与运行方式

全站暗色优先，支持浅色切换。首页组合了仅在浏览器运行的 Three.js plexus、贯穿前几屏的环境光、滚动显现效果和独立的数字花园粒子场景；内容页使用更轻的网格与光线效果。交互组件尊重系统的减少动态效果设置；较重的可视化按页面条件延迟或进入视口后水合。

组件按来源存放：项目自研控件在 `src/components/ui/`，shadcn 基础组件在 `src/registry/shadcn/`，收录的动效组件在 `src/registry/magicui/` 和 `src/registry/react-bits/`。[组件演示页](https://imiles.me/playground) 展示按钮、导航、输入框、浮层和轮播；放置规范和视觉设计见 [UI 架构文档](./docs/ui.md)。

已发布的 D1 文章与仓库文章一同展示；D1 读取失败时，仓库中的 Astro 内容集合仍可提供内容。公开友链接口不返回联系邮箱或审核字段，后台路由按权限能力校验。API 和数据边界见[服务端架构](./src/server/README.md)。

## 项目结构

```text
content/                   博客（.md/.mdx）、故事（.md）和经历（.mdx）
src/pages/                 英文和 /zh 路由、后台、API、订阅源、OG 图片
src/components/            React 与 Astro 组件
src/registry/              shadcn 基础组件、Magic UI 与 React Bits 组件
src/layouts/               站点、文章、后台和组件演示页布局
src/server/                REST API、Access 鉴权、CMS、友链、D1、KV、存储
src/data/                  项目、笔记、链接等站点数据
src/locales/               中英文界面文案
src/content.config.ts      Astro 内容集合 schema
drizzle/migrations/        D1 SQL 迁移
packages/pageel-workbench/ 嵌入式文章编辑器
public/                    图片、字体、图标、Service Worker、生成的 llms.txt
scripts/                   构建、发布、内容生成和性能检查脚本
docs/                      设计与运维文档
```

## 本地开发

需要 Node.js **24.22.1**（`.nvmrc`）和 pnpm **11.13.1**（`package.json` 中的 `packageManager`）。

```bash
git clone https://github.com/Max-Samson/imiles.me.git
cd imiles.me
corepack enable
pnpm install
pnpm dev
```

访问 `http://localhost:4321`。开发仓库内容和界面无需生产凭据；D1、Turnstile、对象存储及外部服务支持的功能需要本地绑定和 [`.env.example`](./.env.example) 中相应的配置。密钥应保存在被 Git 忽略的本地文件中，不要提交。完整的 Cloudflare 资源配置见[部署文档](./docs/cloudflare-production-deployment.md)。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` / `pnpm preview` | 启动开发服务器 / 预览构建产物 |
| `pnpm build` | 生成 `llms.txt`、构建 Astro、准备 Cloudflare 资源清单和发布元数据；不写远程 D1 |
| `pnpm check` / `pnpm check:server` | Astro 与服务端 TypeScript 检查 |
| `pnpm lint` / `pnpm format:check` | Biome 检查 |
| `pnpm test:server` / `pnpm test:release` / `pnpm test:boundaries` | 服务端、发布规则与构建边界测试 |
| `pnpm db:generate` / `pnpm db:check` / `pnpm db:migrate:local` | 生成迁移、检查 Drizzle 元数据、迁移本地 D1 |
| `pnpm cf:types` | 重新生成 Cloudflare 绑定类型 |
| `pnpm generate-icons` / `pnpm generate:llms` | 重新生成 PWA 图标 / 面向 LLM 的索引 |
| `pnpm perf:budget` | 构建后检查首页性能预算 |
| `pnpm release:plan` / `pnpm release:cf` | 查看生产发布计划 / 发布已有构建产物 |
| `pnpm deploy` | 先构建，再执行 `release:cf` |

提交前运行 `pnpm lint` 和 `pnpm format:check`。CI 还会检查类型、Drizzle 元数据、本地服务端测试、发布规则及生产构建。

## 内容写作

Astro 内容集合的 schema 位于 [`src/content.config.ts`](./src/content.config.ts)。博客放在 `content/blog/`，支持 `.md` 和 `.mdx`；故事放在 `content/stories/`，使用纯文本 `.md`；经历条目放在 `content/experience/`，使用 `.mdx`。博客和故事的 frontmatter 必填 `title`、`description`、`pubDate`；schema 会将未提供的 `tags` 设为空数组；`lang` 指定中文或英文。在 CMS 中，“保存草稿”将修改留在 D1，“发布”才会公开文章。

博客支持 KaTeX 和 React 岛屿。文章按惯例以 `ExploreCard` 内跨领域的 *Snippet of the Week* 收尾；含文献的文章使用 `Cite` 和 `References`。故事只包含散文。完整写作规范、图片署名及许可证要求见 [`AGENTS.md`](./AGENTS.md)。

管理后台将工作草稿保存在 D1 中，已发布的 CMS 文章在运行时从 D1 读取；发布流程也支持 Git 通道。实现细节见 [CMS 工作台](./packages/pageel-workbench/README.md) 和[服务端架构](./src/server/README.md)。

## 部署

全站由 [`wrangler.toml`](./wrangler.toml) 配置的单个 Cloudflare Worker 承载。GitHub Actions CI 在针对 `main` 或 `master` 的 PR 及推送时运行，只检查和构建，**不会**部署或执行远程迁移。Cloudflare 生产构建使用 `pnpm build`，然后使用 `pnpm release:cf` 发布该构建产物；本地 `pnpm deploy` 会依次执行这两步。

发布命令要求源码已提交、工作区干净，且构建产物与提交匹配。它会检查当前生产基线和 D1 结构；迁移 SQL 的变化按发布规则审核后才部署。首次接入及迁移审批见 [Cloudflare 发布说明](./docs/cloudflare-release.md)，生产密钥和资源配置见[部署配置文档](./docs/cloudflare-production-deployment.md)。

## 致谢与许可证

项目受到 [`urmzd/urmzd.com`](https://github.com/urmzd/urmzd.com) 启发并基于其改造；来源说明见 [`NOTICE`](./NOTICE)。代码使用 [Apache-2.0](./LICENSE)；博客、故事、图片及品牌素材使用 [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/)。
