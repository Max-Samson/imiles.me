# imiles.me 首页性能优化方案

更新时间：2026-06-11

## 约束

- 不为了性能分数牺牲首页动画效果、WebGL plexus 背景、光线氛围、逐字标题动效或社交 dock 交互。
- 优先做资源按需加载、执行时机调度、chunk 拆分、缓存和字体策略优化。
- 所有优化都要保持当前视觉观感；如果某项可能造成明显 FOUT、动画延迟、画面降级，先记录方案，不直接实施。

## 当前基线

基于用户提供的 2026-06-05 PageSpeed/Lighthouse 桌面截图：

- Performance `56`，Accessibility `100`，Best Practices `96`，SEO `100`。
- FCP `0.8s`，LCP `1.4s`，TBT `11,490ms`，CLS `0.001`。
- LCP 本身已经达标，核心问题是主线程长时间阻塞导致性能分被 TBT 拉低。
- LCP 元素是首页标题逐字渲染中的字符：`<span class="landing-hero-char ...">G</span>`。
- LCP 拆解：TTFB `0ms`，元素渲染延迟约 `3,910ms`。这说明瓶颈更像 React/motion/Three 初始化、字体与绘制调度，而不是图片下载。
- 渲染阻塞请求预计可节省约 `550ms`：
  - `/_astro/about.*.css`：`23.0KiB`，约 `100ms`。
  - Adobe Typekit `qyu8tlw.css` 与 `p.css`：约 `3.7KiB`，约 `400ms`。
  - KaTeX CSS：约 `4.5KiB`，约 `200ms`。
  - Google Fonts CSS：约 `1.6KiB`，约 `200ms`。
- 缓存生命周期提示：
  - Cloudflare Insights beacon：`12KiB`，TTL `1天`。
  - Typekit CSS：截图显示 TTL `7天`。
- 字体显示提示：建议 `font-display: swap` 或 `optional`，预计节省约 `10ms`。

## 最新复测

基于用户提供的完成第一轮优化后的 2026-06-05 PageSpeed/Lighthouse 桌面截图：

- Performance `57`，Accessibility `100`，Best Practices `96`，SEO `100`。
- FCP `0.8s`，LCP `1.2s`，TBT `9,620ms`，CLS `0`，Speed Index `7.4s`。
- LCP 与 CLS 已经很稳，继续优化时不应压缩或移除可见动画、WebGL 背景和社交 dock。
- 剩余主要问题仍是主线程长任务：React/motion、Three/WebGL、dock hover runtime、字体加载和第三方脚本需要继续分层调度。
- 渲染阻塞请求预计可节省约 `490ms`，主要来自 Adobe Typekit、首页共享 CSS 和少量字体 CSS。
- 字体显示仍提示可节省约 `450ms`，说明需要继续观察 Typekit 非阻塞加载和首屏字体 fallback 的实际效果。

## 当前首页架构

- 技术栈：Astro server output、React islands、Tailwind CSS v4、motion/react、Three.js via `@react-three/fiber`。
- 首页路由：
  - `src/pages/index.astro`
  - `src/pages/zh/index.astro`
- 首页核心岛：
  - `src/components/Hero.tsx`
  - `src/components/LandingExperience.tsx`
  - `src/components/ui/plexus-background.tsx`
  - `src/components/ui/plexus-webgl/PlexusScene.tsx`
- 全站布局：
  - `src/layouts/BaseLayout.astro`
- 当前首页首屏有三个主要成本中心：
  - `Hero client:load` 水合 `LandingExperience`，包含 motion 动画、文字 scramble、SocialDock。
  - `PlexusBackground` 懒 import Three 场景，但仍跟随首页 React 岛进入首轮初始化路径。
  - `LightRays client:load` 使用 motion/react 生成光线动画。
- 当前全站 head 同步加载 KaTeX、Google Fonts、Adobe Typekit。首页不需要 KaTeX，但仍被阻塞。

## 优化目标

- 保持动画视觉完整，不移除首页动效。
- Performance 第一阶段：`56 -> 75+`。
- Performance 第二阶段：`85+`，前提是不降低视觉效果。
- TBT 第一阶段：`11,490ms -> < 3,000ms`。
- TBT 第二阶段：`< 600ms`。
- LCP：保持 `< 2.5s`，尽量维持当前 `1.4s` 水平。
- FCP：保持 `< 1.0s - 1.2s`。
- CLS：保持 `< 0.01`。
- 首页渲染阻塞第三方/非必要 CSS：先去掉 KaTeX，再评估字体加载策略。

## TODO

### P0：不改变动画效果的直接优化

- [x] P0-1 首页移除 KaTeX 阻塞 CSS。
  - 截图中 KaTeX CSS 是首页渲染阻塞项，约 `4.5KiB`、`200ms`。
  - 首页、列表页、故事页不需要数学排版。
  - 已新增 `BaseLayout` 的 `loadKatex` prop，仅英文/中文博客文章页开启。
  - 验收：首页 HTML 不再包含 `cdn.jsdelivr.net/npm/katex`；博客文章页仍包含并能正常显示公式。

- [x] P0-2 service worker 注册推迟到空闲期。
  - 原先在 `load` 后立即注册并触发 `registration.update()`。
  - 已改为 `requestIdleCallback`，不支持时用 `setTimeout` 兜底。
  - 验收：离线能力保留，首页首轮主线程竞争降低。

- [x] P0-3 分离首页 LightRays 与主 Hero 岛的执行成本。
  - 当前 `LightRays client:load` 会单独加载 React/motion 岛。
  - 约束：光线效果必须保留。
  - 备选方案 A：保留视觉效果，用 CSS keyframes 实现同样的光线层，减少一个 React/motion 岛。
  - 已采用方案 B：继续使用 React/motion 版本，但移入 `LandingExperience`，与 `Hero client:load` 共用同一个岛，减少重复 runtime 调度。
  - 验收：视觉对比无明显差异；首页初始 JS chunk 或 hydration task 减少。

- [x] P0-4 拆分 `LandingExperience` 首轮初始化路径。
  - 当前 `LandingExperience` 同时负责标题动效、quote scramble、SocialDock、PlexusBackground。
  - 约束：逐字标题动画、quote 变化、WebGL plexus 和 dock 效果都保留。
  - 已采用方案：`LandingExperience` 内部延后挂载 `PlexusBackground`；标题、quote、LightRays 和 dock 继续首屏 `client:load`，WebGL 背景在标题入场后等待浏览器 idle 再初始化。
  - 验收：动画仍在首屏出现；Three 相关 chunk 不阻塞标题首轮动画 task。

- [x] P0-5 保留动画但降低 motion 首轮工作量。
  - 当前标题每个字符都是一个 `motion.span`，LCP 元素正是其中一个字符。
  - 约束：逐字出现、发光过渡和 hover 效果保留。
  - 已采用方案：用 CSS animation/stagger 复刻逐字入场，字符节点改为普通 `span`，减少 React render + motion timeline 数量。
  - 验收：逐字动画肉眼一致；TBT 和 LCP render delay 下降。

### P1：字体和渲染阻塞

- [x] P1-1 审计 Adobe Typekit 字体依赖。
  - 截图中 Typekit CSS 是最大渲染阻塞第三方项，约 `400ms`。
  - 当前 CSS 使用 `elza-text`、`ogg-text`；这些来自 Typekit。
  - 约束：不能因为优化让首页字体气质明显变化。
  - 已采用方案：不自托管 Adobe 字体，保留 Typekit 字体来源，但将 stylesheet 改为 `preload` + `onload` 非阻塞加载，避免在首页 head 中留下外部 `rel="stylesheet"` 字体链接。
  - 验收：字体观感一致，外部 Typekit 不再阻塞或阻塞显著降低。

- [x] P1-2 精简 Google Fonts。
  - 当前全站加载 `Great Vibes`、`IBM Plex Mono`、`Permanent Marker`、`Rock Salt`。
  - 首页实际用到 `Permanent Marker` 和 `Rock Salt`，`IBM Plex Mono` 更偏代码/终端内容，`Great Vibes` 用于其他装饰场景。
  - 已采用方案：将 Google Fonts 的 latin WOFF2 文件本地托管到 `public/fonts/google/`，在 `global.css` 定义 `@font-face`，移除 `fonts.googleapis.com` stylesheet 和 `fonts.gstatic.com` preconnect。
  - 验收：首页 Google Fonts CSS 请求消失，标题/品牌视觉不变。

- [x] P1-3 首页 CSS 体积和命名异常检查。
  - 截图显示首页阻塞 CSS 文件名类似 `about.*.css`，需要确认构建产物是否存在共享 chunk 命名误导或页面 CSS 被过度合并。
  - 已采用方案：确认 `about.*.css` 是全站共享 CSS chunk 的命名结果，不是首页真正依赖 about 页面；仅删除全仓库无引用的 legacy splash/film/rolodex/textile/click-hint/final-card 尾部样式。
  - 边界：不删除当前页面可见的 landing、header、article、project、timeline、code block、status 和首页动画样式，避免破坏页面展示。
  - 验收：构建后 CSS 产物从约 `145.7KB` 降到约 `123.1KB`；首页 HTML 保持无外部 stylesheet 字体链接，样式不缺失。

### P2：Three.js 与交互成本

- [x] P2-1 Three 场景 idle mount。
  - 当前 `PlexusScene` 使用 `frameloop="always"`，桌面 `800` 粒子，移动 `250` 粒子。
  - 约束：最终背景效果不降级。
  - 已采用方案：首屏标题动画开始后再 mount canvas；`LandingExperience` 在 `2200ms` 后等待浏览器 idle 再挂载 `PlexusBackground`。
  - 边界：Three/WebGL 动态背景保留，mount 前保留当前 landing 背景和 LightRays，避免视觉空洞。
  - 验收：用户仍看到动态 plexus；Lighthouse 主线程长任务下降。

- [x] P2-2 动画运行时分层。
  - 将文字入场、quote scramble、dock、WebGL 背景分成可独立调度的 islands。
  - 首屏必须显示的标题动画优先；背景增强与 dock 交互可以稍后初始化，但不能消失或降级。
  - 已采用方案：标题逐字动画保持 CSS stagger 首屏执行，quote scramble 和 LightRays 保持随 Hero 水合；`SocialDock` 改为 `React.lazy`，在 `1100ms` 后挂载并加载自己的 chunk，早于外层 `1.6s` fade-in，避免视觉延迟。
  - 验收：主线程长任务被拆小，动画仍连续；构建产物中 `SocialDock`、社交链接数据和相关图标已从 Hero 静态 import 路径改为动态加载路径。

- [x] P2-3 复测 forced reflow 来源。
  - Lighthouse 截图未展开该项，但 TBT 极高时需要用 Chrome Performance 定位长任务。
  - 重点看 `ResizeObserver` 测量标题宽度、motion layout、dock hover measurement、Three canvas 初始化。
  - 已完成源码侧检查：dock hover 是最明确的同步布局风险点，每个图标会随鼠标移动读取 `getBoundingClientRect()`。
  - 已采用方案：不改变 dock 放大尺寸、弹性曲线或 hover tooltip，只把 desktop dock 的 `mouseX` 更新用 `requestAnimationFrame` 合并到每帧一次，减少高频 pointermove 触发的同步测量压力。
  - 验收：减少同步 layout read/write 交错；动画表现保留。

### P3：监控与缓存

- [x] P3-1 Cloudflare Insights 延迟或采样加载。
  - 截图中 beacon 缓存 TTL 只有 `1天`，体积约 `12KiB`。
  - 方案：确认是否必须首屏加载；如可延迟，放到 idle 或交互后。
  - 已完成源码侧检查：仓库中没有 `cloudflareinsights`、`beacon.min.js`、Zaraz 或自定义 analytics 注入；本地首页 HTML 也不包含 Cloudflare beacon。
  - 结论：该项来自 Cloudflare/部署平台自动注入，不能在当前源码内延迟；如需继续优化，需要到 Cloudflare 面板关闭、采样或改为部署层规则。
  - 验收：确认源码不再额外注入监控脚本，真实监控是否保留由部署配置决定。

- [x] P3-2 增加性能预算脚本。
  - 构建后统计首页 HTML、stylesheet、modulepreload、script 数量和 `_astro` 资源体积。
  - 已新增 `npm run perf:budget`，默认输出可读摘要并统计 `dist/_astro` CSS/JS、Hero、PlexusScene、SocialDock chunk 体积。
  - 可选传入 `PERF_URL=http://127.0.0.1:4323/ npm run perf:budget` 抓首页 HTML，检查阻塞 stylesheet、KaTeX、Google Fonts、Cloudflare beacon、Hero island 和独立 SocialDock island。
  - 如需完整机器可读数据，使用 `npm run perf:budget -- --json`。
  - 验收：每次优化都有可比较的本地数据；当前预算检查全部通过。

## 已开始的代码改动

- `src/layouts/BaseLayout.astro`
  - 新增 `loadKatex`，默认不加载 KaTeX。
  - service worker 注册改为 idle 调度。
- `src/pages/blog/[...slug].astro`
  - 博客文章页开启 `loadKatex`。
- `src/pages/zh/blog/[...slug].astro`
  - 中文博客文章页开启 `loadKatex`。
- `src/pages/index.astro`、`src/pages/zh/index.astro`
  - 移除页面级 `LightRays client:load`，保留静态背景层。
- `src/components/LandingExperience.tsx`
  - 在 Hero 岛内部渲染 `LightRays`，保持光线动画效果并减少独立 island。
  - 延后挂载 `PlexusBackground`，让 Three/WebGL chunk 等标题入场后再 idle 初始化。
  - 将 `SocialDock` 改为 `React.lazy`，在外层 dock 容器淡入前预加载并挂载，保留原有社交 dock 动画和 hover 交互。
  - 将标题逐字动画从多个 `motion.span` 改为 CSS stagger，保留入场/光晕效果并降低 motion 节点数量。
- `src/components/ui/floating-dock.tsx`
  - desktop dock 的 `mouseX` 更新改为 `requestAnimationFrame` 合并，减少高频 pointermove 对 motion transform 和布局读取的压力。
- `src/styles/global.css`
  - 为首页 landing 根层增加 `isolate`，稳定 WebGL、LightRays 和内容层叠关系。
  - 新增 `landing-char-reveal` CSS 动画和 reduced-motion 兜底。
  - 新增本地 Google Fonts 的 `@font-face`：`Great Vibes`、`IBM Plex Mono`、`Permanent Marker`、`Rock Salt`。
  - 删除全仓库无引用的 legacy splash/film/rolodex/textile/click-hint/final-card 尾部样式，降低全站共享 CSS 体积。
- `public/fonts/google/`
  - 新增本地托管的 Google Fonts WOFF2 文件。
- `src/layouts/BaseLayout.astro`
  - 移除 Google Fonts 外部 stylesheet/preconnect。
  - 预加载首页关键字体 `Rock Salt` 和 `Permanent Marker`。
  - 将 Typekit stylesheet 改为非阻塞 preload/onload 加载。
- `scripts/check-homepage-performance.mjs`
  - 新增构建产物和首页 HTML 性能预算检查。
- `package.json`
  - 新增 `perf:budget` 脚本。

## 本轮任务完成检查

- P2-3：已完成源码侧 forced reflow 检查，并对 dock pointer tracking 做每帧合并；未改变 dock 动画视觉。
- P3-1：已确认 Cloudflare beacon 不来自源码，本地 HTML 无该脚本；后续只剩部署平台配置项。
- P3-2：已完成预算脚本，并通过构建产物和本地首页 HTML 两种检查。
- 当前可自动验证项全部通过：CSS raw `123,133B`，Hero chunks raw `13,334B`，首页阻塞 stylesheet `0`，首页 KaTeX `0`，Google Fonts stylesheet `0`。

## 复测流程

本地构建：

```sh
npm run build
```

本地 HTML 验证：

```sh
npm run dev -- --host 127.0.0.1
```

注意：当前 Cloudflare adapter 不支持 `astro preview`，本地抓首页 HTML 时使用 dev server 或 Cloudflare/Wrangler 预览流程。

首页资源检查：

```sh
npm run perf:budget
PERF_URL=http://127.0.0.1:4321/ npm run perf:budget
npm run perf:budget -- --json
npm run perf:budget -- --help
```

## 性能预算脚本说明

脚本位置：`scripts/check-homepage-performance.mjs`
命令入口：`npm run perf:budget` 或 `pnpm perf:budget`

### 功能

- 读取 `dist/_astro`，统计生产构建产物里的 CSS/JS 资源体积。
- 单独列出首页相关重点 chunk：
  - `Hero.*.js`：首页首屏 React island 和 landing runtime。
  - `PlexusScene.*.js`：Three/WebGL 背景场景，预期较大，但应延迟加载。
  - `SocialDock.*.js`：社交 dock 交互，预期应从 Hero 首轮路径拆出。
- 根据内置预算检查关键项是否过线：
  - CSS raw size `<= 130 KiB`。
  - Hero chunks raw size `<= 24 KiB`。
  - 如果提供 `PERF_URL`，首页阻塞 stylesheet、Google Fonts stylesheet、首页 KaTeX 都必须为 `0`。
- 可选抓取正在运行的首页 HTML，检查源码层是否仍包含：
  - 阻塞 stylesheet。
  - KaTeX CSS。
  - Google Fonts stylesheet。
  - Cloudflare beacon。
  - Hero island。
  - 独立 SocialDock island。

### 使用前提

先运行生产构建：

```sh
npm run build
```

脚本依赖 `dist/_astro`，如果没有构建产物会报错。它不是 Lighthouse 替代品，不会直接测 FCP、LCP、TBT 或 CLS；它用于检查“这次代码改动有没有让首页资源预算倒退”。

### 常用命令

只检查构建产物：

```sh
npm run perf:budget
```

检查构建产物，同时抓本地首页 HTML：

```sh
npm run dev -- --host 127.0.0.1
PERF_URL=http://127.0.0.1:4321/ npm run perf:budget
```

输出完整 JSON，便于保存、diff 或接入 CI：

```sh
npm run perf:budget -- --json
```

预算失败时让命令返回非 0 状态，适合 CI：

```sh
PERF_BUDGET_FAIL=1 npm run perf:budget
```

查看脚本帮助：

```sh
npm run perf:budget -- --help
```

### 参数与环境变量

- `--json`：输出完整机器可读 JSON。默认不加时输出人类可读摘要。
- `--help` / `-h`：显示脚本帮助。
- `PERF_URL`：可选。传入正在运行的首页 URL 后，脚本会额外抓 HTML 并检查首页 link/script/island 状态。
- `PERF_BUDGET_FAIL=1`：可选。默认预算失败只在输出中显示 `FAIL`；设置后会让命令以非 0 状态退出。

### 输出解释

默认摘要示例字段：

- `CSS`：全部构建 CSS 的 raw/gzip 体积。当前只有一个共享 CSS chunk，名字可能是 `about.*.css`，这是构建命名结果，不代表首页依赖 about 页面。
- `JS total`：`dist/_astro` 下所有客户端 JS chunk 的总体积。这个值用于观察整体趋势，不等于首页首屏必须下载的 JS。
- `Hero chunks`：首页 Hero 相关 chunk 体积，是首屏预算重点。这里增长通常意味着 landing 首轮水合成本增加。
- `Plexus chunk`：Three/WebGL 背景 chunk。它可以较大，但必须保持动态/延迟加载，不能重新并回 Hero 首轮路径。
- `SocialDock chunks`：社交 dock 交互 chunk。它应保持较小，并与 Hero 首轮路径分离。
- `Home HTML: not checked`：没有设置 `PERF_URL`，所以只检查了构建产物，没有检查实际首页 HTML。
- `Blocking stylesheet links`：首页 HTML 中同步阻塞 stylesheet 数量。目标为 `0`。
- `KaTeX on home`：首页是否加载 KaTeX。目标为 `no`。
- `Google Fonts stylesheet on home`：首页是否加载 `fonts.googleapis.com` stylesheet。目标为 `no`。
- `Cloudflare beacon in source HTML`：源码返回的 HTML 是否包含 Cloudflare beacon。若线上 Lighthouse 仍显示 beacon，但这里是 `no`，说明它来自 Cloudflare/部署平台自动注入。
- `Standalone SocialDock island`：首页 HTML 是否有独立 `SocialDock` island。目标为 `no`，因为首页 dock 现在应由 Hero 内部延迟加载。
- `Checks`：内置预算检查结果。`PASS` 表示该项未超过预算，`FAIL` 表示需要回看最近改动。

### 如何解读用户贴出的输出

如果只看到：

```txt
Home HTML: not checked. Set PERF_URL to inspect the served homepage.
```

说明这次只检查了 `dist/_astro` 文件体积，没有检查真实首页 HTML。需要启动 dev server 后带 `PERF_URL` 再跑。

如果 `CSS` 或 `Hero chunks` 变大但仍是 `PASS`，说明还在预算内，可以结合 Lighthouse 判断是否需要继续拆分。如果变成 `FAIL`，优先检查是否把动画、dock、Three、搜索或文章组件重新并入了首页首轮路径。

线上复测：

- PageSpeed desktop 和 mobile 各测一次。
- 记录 Performance、FCP、LCP、TBT、CLS、Speed Index。
- 展开 Diagnostics，重点记录：
  - Total Blocking Time。
  - Render-blocking requests。
  - LCP phase。
  - Main-thread work。
  - Forced reflow。
  - Network dependency tree。

## 风险

- Typekit/Google Fonts 优化可能改变字体首次显示，需要做视觉对比后再上。
- WebGL 延迟 mount 可能让首屏初始几百毫秒缺少背景动态，必须用静态同风格背景层兜底。
- 将 motion 字符动画改为 CSS 需要逐帧对比，避免破坏当前首页的签名式动效。
