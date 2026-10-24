# SEO / GEO 结构与验收

本站是 Miles 的中英双语个人网站。搜索可见性以可抓取的服务端 HTML、准确的文章元数据、稳定 URL 和真实原创内容为基础。`llms.txt` 只是额外的内容索引，不替代 sitemap、结构化数据或页面正文，也不保证被任何 AI 搜索产品使用。

## 公开路径

| 内容 | 英文 | 中文 | 数据来源 |
| --- | --- | --- | --- |
| Blog | `/blog/<id>` | `/zh/blog/<id 去 -zh>` | `content/blog`，排除 `draft: true` |
| Stories | `/stories/<id>` | `/zh/stories/<id>` | `content/stories`，排除 `draft: true` |
| 其他页面 | `/...` | `/zh/...`（存在时） | Astro 路由 |

`src/lib/content-routing.ts` 是文章 URL 映射的单一规则。详情页、sitemap 和 RSS 均使用该规则。文章只在对应公开译文实际存在时输出 `hreflang`；仅中文文章不输出虚假的英文或 `x-default` 地址。canonical、Open Graph `og:url`、JSON-LD URL 与 sitemap 均使用无尾斜杠的站点 URL，首页除外。

## 页面元数据

- `src/components/layout/SEOMeta.astro` 输出 canonical、robots、语言互链、Open Graph、Twitter Card、Person、WebSite、WebPage/Article JSON-LD。
- 文章 schema 使用真正的标题、摘要、发布日期和可选更新日期；Blog 可使用 `heroImage`。页面显示的文章内容、作者与日期须与结构化数据一致。Stories 使用 `Article` 而非 BlogPosting。
- `src/pages/og/[...slug].png.ts` 在构建时为公开文章生成静态图片。草稿不生成 OG。通用页面使用 `/og/index.png`；新增路由如需专属 OG，应同时更新 `SEOMeta` 的映射和静态生成路径。中文使用随仓库保存的 Noto Sans SC 静态字体，来源为 [Google Fonts](https://github.com/google/fonts/tree/main/ofl/notosanssc)，许可文件见 `src/assets/fonts/OFL-NotoSansSC.txt`。它只参与构建期图片生成，不作为页面字体下载。
- `src/pages/pdf/index.astro` 是纯客户端阅读工具，设置 `noindex`。后台使用独立布局的 `noindex`，且文章编辑页还返回 `X-Robots-Tag`。

## 发现与内容提取

- `/sitemap.xml` 收录公开页面、Blog/Stories、项目、笔记、友链和组件示例，排除草稿、后台、PDF 工具。新公开路由需同步检查 sitemap 与 canonical。
- `/rss.xml` 收录公开 Blog；中文文章链接指向 `/zh/blog/...`。频道包含双语条目，读者应以条目页面语言为准。
- `public/robots.txt` 声明 sitemap；不能用 robots 阻止 Google 读取需要 `noindex` 的页面。
- `scripts/generate-llms-txt.mjs` 在构建前运行，仅列出允许收录的内容；`llms: false` 和 `draft: true` 均不得进入生成索引，Stories 只列实际存在的语言版本。
- 首页、栏目页与正文应保持有意义的 HTML 标题、摘要和可点击 `<a href>` 内链；结构化数据与 `llms.txt` 不能弥补空白或仅客户端渲染的主体内容。

## 发布检查

1. 应用 D1 迁移和媒体配置后，从后台发布测试文章，核对 Git 提交、Deploy 工作流、最终 URL、图片匿名 GET、RSS、sitemap、canonical、hreflang 与 JSON-LD。
2. 本地运行 `pnpm build`、`pnpm check:server`、`pnpm test:server`；检查 `dist/og/` 和生成的静态 HTML。真实收录状态另用 Search Console URL 检查和 sitemap 报告确认。
3. 不把构建通过解释成已经收录、获得富结果或进入 AI 回答。内容质量、外部提及、抓取数据和搜索表现需用真实数据评估。文章更新日期只在内容有实质修改时调整。

参考：[Google SEO 入门指南](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)、[Article 结构化数据](https://developers.google.com/search/docs/appearance/structured-data/article)、[多语言版本](https://developers.google.com/search/docs/specialty/international/localized-versions)、[AI 搜索功能指南](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)。
