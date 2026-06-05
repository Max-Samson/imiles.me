# imiles.me 首页性能优化方案

更新时间：2026-06-05

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

- [ ] P0-4 拆分 `LandingExperience` 首轮初始化路径。
  - 当前 `LandingExperience` 同时负责标题动效、quote scramble、SocialDock、PlexusBackground。
  - 约束：逐字标题动画、quote 变化、WebGL plexus 和 dock 效果都保留。
  - 方案：把 WebGL 背景封装为单独增强岛，使用 `client:idle` 或组件内部 idle mount；标题和可见文案继续 `client:load`，保证首屏动画及时出现。
  - 验收：动画仍在首屏出现；Three 相关 chunk 不阻塞标题首轮动画 task。

- [ ] P0-5 保留动画但降低 motion 首轮工作量。
  - 当前标题每个字符都是一个 `motion.span`，LCP 元素正是其中一个字符。
  - 约束：逐字出现、发光过渡和 hover 效果保留。
  - 方案：用 CSS animation/stagger 复刻逐字入场，减少 React render + motion timeline 数量；或保留 motion 但只让容器驱动，字符用 CSS 变量控制 delay。
  - 验收：逐字动画肉眼一致；TBT 和 LCP render delay 下降。

### P1：字体和渲染阻塞

- [ ] P1-1 审计 Adobe Typekit 字体依赖。
  - 截图中 Typekit CSS 是最大渲染阻塞第三方项，约 `400ms`。
  - 当前 CSS 使用 `elza-text`、`ogg-text`；这些来自 Typekit。
  - 约束：不能因为优化让首页字体气质明显变化。
  - 方案：确认 license 后本地托管 WOFF2，并在本地 `@font-face` 中设置 `font-display: swap`；如果不能本地托管，只考虑 preload/async 策略并视觉回归。
  - 验收：字体观感一致，外部 Typekit 不再阻塞或阻塞显著降低。

- [ ] P1-2 精简 Google Fonts。
  - 当前全站加载 `Great Vibes`、`IBM Plex Mono`、`Permanent Marker`、`Rock Salt`。
  - 首页实际用到 `Permanent Marker` 和 `Rock Salt`，`IBM Plex Mono` 更偏代码/终端内容，`Great Vibes` 用于其他装饰场景。
  - 方案：按页面声明字体需求，首页只加载首页用到的 family；博客/项目页再按需加载 mono/script。
  - 验收：首页 Google Fonts CSS 请求更小，且标题/品牌视觉不变。

- [ ] P1-3 首页 CSS 体积和命名异常检查。
  - 截图显示首页阻塞 CSS 文件名类似 `about.*.css`，需要确认构建产物是否存在共享 chunk 命名误导或页面 CSS 被过度合并。
  - 方案：构建后分析 `dist/_astro/*.css`，确认首页实际依赖的 CSS，移除未使用页面级样式进入首页的路径。
  - 验收：首页 CSS 传输体积继续下降，样式不缺失。

### P2：Three.js 与交互成本

- [ ] P2-1 Three 场景 idle mount。
  - 当前 `PlexusScene` 使用 `frameloop="always"`，桌面 `800` 粒子，移动 `250` 粒子。
  - 约束：最终背景效果不降级。
  - 方案：首屏标题动画开始后再 mount canvas；mount 前保留同色静态背景层，避免视觉空洞。
  - 验收：用户仍看到动态 plexus；Lighthouse 主线程长任务下降。

- [ ] P2-2 动画运行时分层。
  - 将文字入场、quote scramble、dock、WebGL 背景分成可独立调度的 islands。
  - 首屏必须显示的标题动画优先；背景增强与 dock 交互可以稍后初始化，但不能消失或降级。
  - 验收：主线程长任务被拆小，动画仍连续。

- [ ] P2-3 复测 forced reflow 来源。
  - Lighthouse 截图未展开该项，但 TBT 极高时需要用 Chrome Performance 定位长任务。
  - 重点看 `ResizeObserver` 测量标题宽度、motion layout、dock hover measurement、Three canvas 初始化。
  - 验收：减少同步 layout read/write 交错。

### P3：监控与缓存

- [ ] P3-1 Cloudflare Insights 延迟或采样加载。
  - 截图中 beacon 缓存 TTL 只有 `1天`，体积约 `12KiB`。
  - 方案：确认是否必须首屏加载；如可延迟，放到 idle 或交互后。
  - 验收：真实监控保留，首页初始网络更轻。

- [ ] P3-2 增加性能预算脚本。
  - 构建后统计首页 HTML、stylesheet、modulepreload、script 数量和 `_astro` 资源体积。
  - 验收：每次优化都有可比较的本地数据。

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
- `src/styles/global.css`
  - 为首页 landing 根层增加 `isolate`，稳定 WebGL、LightRays 和内容层叠关系。

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
curl -sL http://127.0.0.1:4321/ -o /tmp/imiles-home.html
node - <<'NODE'
const fs = require("fs");
const html = fs.readFileSync("/tmp/imiles-home.html", "utf8");
console.log({
  htmlBytes: Buffer.byteLength(html),
  stylesheetCount: (html.match(/rel="stylesheet"/g) || []).length,
  modulepreloadCount: (html.match(/rel="modulepreload"/g) || []).length,
  scriptCount: (html.match(/<script/g) || []).length,
  katex: html.includes("katex.min.css"),
  typekit: html.includes("use.typekit.net"),
  googleFonts: html.includes("fonts.googleapis.com"),
});
NODE
```

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
