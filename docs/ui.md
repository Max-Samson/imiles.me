# UI 组件体系说明

本文档说明当前项目的 UI 组件组成、目录职责、实际应用方式，以及后续添加 Magic UI 组件时的约定。

项目的 UI 不是单一组件库，而是由几层共同组成：

- Astro + React islands：页面由 Astro 组织，交互和动画通过 React 组件按需水合。
- Tailwind CSS v4：主要样式系统，负责布局、颜色、响应式和状态样式。
- shadcn/ui + Radix UI：提供可访问性较好的基础交互组件。
- Magic UI：提供动效型、展示型、装饰型组件。
- 本项目自有组件：围绕个人网站、博客、项目、研究、笔记等内容形态定制。
- Three.js / React Three Fiber：负责首页的 WebGL plexus 背景等重型视觉体验。

## 目录分层

### `src/components/`

这是项目的一方组件根目录，按功能域继续拆分。根目录只保留 `index.tsx` barrel export，不再平铺页面组件。

当前目录职责：

- `article/`：博客正文和文章详情页相关组件，包括 MDX 内容组件、目录、代码增强、引用、分享按钮和文章内视觉 demo。
- `about/`：About 页面组件，包括 `AboutHero`、`WelcomeTimeline`、`TimelineImage`。
- `common/`：跨页面复用的展示组件，包括 `FeatureGrid`、`TechStackGrid`、`ImageShowcase`、`TerminalDemo`、`StatusBadge`。
- `home/`：首页首屏和 landing experience。
- `layout/`：站点外壳和跨页面布局组件，包括 `SocialDock`、`NewsletterSignup`、`LanguageSwitcher`、`SEOMeta`、内容页背景。
- `header/`、`footer/`：导航和页脚。
- `project/`、`note/`、`research/`：对应内容域的卡片和详情 hero。
- `ui/`：shadcn/ui、本地 UI primitive、Three.js plexus 基础设施。

这一层的特点是“按功能组合”。功能组件通常会引用 `src/components/ui/` 的基础组件，也会引用 `src/registry/magicui/` 的视觉组件，再结合项目自己的数据、hooks 和页面语义组成最终体验。

例如：

- `AboutHero` 使用 `AuroraText` 和 `Terminal` 做个人介绍的视觉表达。
- `LandingExperience` 使用本地 `PlexusBackground` 加 Magic UI 的 `LightRays` 组成首页首屏。
- `NoteCard` 使用 `PixelImage` 和 `ShineBorder` 做笔记卡片的图像和边框效果。

### `src/components/ui/`

这是本项目的基础 UI primitive 层。这里的组件更接近“可复用积木”，不应该绑定某个具体页面。

当前主要包含三类组件。

第一类是 shadcn/ui 或 Radix 风格的基础控件：

- `button`
- `dropdown-menu`
- `navigation-menu`

第二类是已经被项目吸收为本地基础能力的 UI 组件：

- `floating-dock`
- `link-preview`
- `navbar-menu`
- `placeholders-and-vanish-input`
- `timeline`

第三类是项目自有的重型视觉基础设施：

- `plexus-background`
- `plexus-shapes`
- `plexus-webgl/`

其中 `plexus-webgl/` 是首页 WebGL 背景的内部实现，包含粒子、连线、后处理、shader 和主题逻辑。这类组件虽然也在 `ui` 目录下，但它们不是普通按钮/菜单，而是项目视觉系统的一部分。

项目的 `components.json` 当前配置为：

```json
{
  "aliases": {
    "ui": "@/components/ui"
  }
}
```

因此，默认运行 shadcn 添加命令时，组件会被写入 `src/components/ui/`。这对 shadcn/ui 基础控件是合理的，但对 Magic UI 组件并不符合当前项目约定。

### `src/registry/magicui/`

这里专门存放从 Magic UI registry 下载的组件。

当前已有组件包括：

- `animated-theme-toggler`
- `aurora-text`
- `flickering-grid`
- `highlighter`
- `light-rays`
- `marquee`
- `pixel-image`
- `shine-border`
- `terminal`

这个目录的价值是保留组件来源边界：看到 `src/registry/magicui/`，就知道它最初来自 Magic UI，可在本地按项目需要微调，但不和本项目自有 primitive 混在一起。

推荐导入方式：

```tsx
import { FlickeringGrid } from "@/registry/magicui/flickering-grid"
```

不推荐把 Magic UI 组件长期放在：

```text
src/components/ui/
```

原因是 `src/components/ui/` 在本项目中承担的是“本地基础 UI 层”，而 Magic UI 更偏“外部 registry 视觉组件层”。混放之后，后续维护时不容易判断一个组件是项目自研、shadcn 基础组件，还是从 Magic UI 下载后改造的组件。

## 当前 UI 库的实际应用

### shadcn/ui 与 Radix UI

shadcn/ui 在项目中主要负责基础交互控件，底层依赖 Radix UI 的可访问性能力。

当前应用包括：

- `Button` 用于移动菜单、订阅表单等明确操作。
- `DropdownMenu`、`NavigationMenu` 用于导航和菜单交互。
- `Slot`、`class-variance-authority`、`tailwind-merge` 等工具支持组件变体和 class 合并。

这一层适合承担稳定、可预测、可访问的交互，不适合承载过多装饰性动画。

### Magic UI

Magic UI 在项目中主要承担视觉增强和动效展示。

当前应用包括：

- `LightRays`：用于 about、blog、projects、research、stories、notes 等页面的背景光线效果，也用于 `LandingExperience`。
- `ShineBorder`：用于博客列表和项目/笔记卡片的发光边框。
- `PixelImage`：用于笔记卡片的像素化图像展示。
- `Marquee`：用于笔记相关图片横向滚动展示。
- `AuroraText`：用于 About hero 中的强调文本。
- `Terminal`、`TypingAnimation`、`AnimatedSpan`：用于 About hero 的终端式介绍。
- `AnimatedThemeToggler`：用于 header 中的主题切换按钮。
- `FlickeringGrid`：新下载的闪烁网格组件，应放在 `src/registry/magicui/`，后续可用于背景、分割区域或轻量氛围层。

Magic UI 组件通常更适合放在页面视觉层、卡片装饰层和 hero 区域，不建议用它替代基础表单、菜单、导航等核心交互。

### 本地自定义 UI

项目已有不少从站点气质出发定制的 UI 组件，例如：

- `PlexusBackground`：首页核心 Three.js 背景。
- `FloatingDock`：社交链接悬浮 dock。
- `LinkPreview`：博客正文中的链接预览。
- `Timeline`：About 时间线。
- `PlaceholdersAndVanishInput`：博客搜索输入框。
- `NavbarMenuEnhanced` + `navbar-menu`：桌面导航菜单体验。

这些组件已经是项目视觉语言的一部分。后续新增 Magic UI 组件时，应优先把它们作为增强层组合进现有组件，而不是替换掉已有的核心体验。

## 添加 Magic UI 组件

本项目已经在 `components.json` 中注册 Magic UI：

```json
{
  "registries": {
    "@magicui": "https://magicui.design/r/{name}"
  }
}
```

添加 Magic UI 组件时，请使用 `npx shadcn@latest add`，并显式指定目录：

```bash
npx shadcn@latest add @magicui/flickering-grid --path src/registry/magicui
```

也可以使用短参数：

```bash
npx shadcn@latest add @magicui/flickering-grid -p src/registry/magicui
```

如果不加 `--path`，shadcn 会读取 `components.json` 中的 `aliases.ui`，并默认写入：

```text
src/components/ui/
```

这就是之前执行：

```bash
npx shadcn@latest add @magicui/flickering-grid
```

会生成到：

```text
src/components/ui/flickering-grid.tsx
```

的原因。

对当前项目来说，Magic UI 下载组件应统一放到：

```text
src/registry/magicui/
```

这样目录语义更清晰，也方便后续对照 Magic UI 官方版本进行更新或重下载。

## 关于 `pnpm dlx` 报错

当前项目中添加 Magic UI 组件时，推荐使用：

```bash
npx shadcn@latest add @magicui/<component-name> --path src/registry/magicui
```

不推荐直接使用：

```bash
pnpm dlx shadcn@latest add @magicui/<component-name> --path src/registry/magicui
```

### 原因

这是 shadcn CLI 当前依赖组合与 `pnpm dlx` 临时链接方式的兼容性问题，不是项目源码、Node.js 版本或 Magic UI 组件的问题。

`shadcn@4.16.2` 允许解析到 `zod@3.24.1`，而其依赖的 `@modelcontextprotocol/sdk@1.30.0` 要求 `zod@^3.25 || ^4`，并会导入 `zod/v4`。在 `pnpm dlx` 创建的临时虚拟仓库中，SDK 可能被错误链接到 `zod@3.24.1`；该版本没有导出 `./v4`，所以 CLI 会在启动阶段报错：

```text
Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './v4' is not defined by "exports"
```

### 推荐命令

用 `npx` 仅启动一次 CLI，不会改变项目仍以 pnpm 管理依赖的事实：

```bash
npx shadcn@latest add @magicui/<component-name> --path src/registry/magicui
```

该命令已验证可用。例如：

```bash
npx shadcn@latest add @magicui/morphing-text --path src/registry/magicui
```

如必须使用 `pnpm dlx`，显式将兼容的 Zod 版本加入临时依赖集：

```bash
pnpm --package zod@3.25.76 --package shadcn@latest dlx shadcn add @magicui/<component-name> --path src/registry/magicui
```

这个 pnpm 命令已验证可以正常启动 shadcn，但日常添加组件优先使用更短、更稳定的 `npx shadcn@latest add`。

## 维护约定

新增 UI 组件时按以下规则放置：

- shadcn/ui 基础控件：放在 `src/components/ui/`
- 项目自有、可复用的基础 UI：放在 `src/components/ui/`
- Magic UI 下载组件：放在 `src/registry/magicui/`
- 页面或内容类型强绑定组件：放在 `src/components/` 或对应功能子目录
- Three.js/WebGL 视觉基础设施：保留在 `src/components/ui/plexus-*` 相关文件中

使用 Magic UI 时按以下原则判断：

- 用于增强 hero、背景、卡片、展示区，可以使用。
- 用于核心导航、表单、菜单、可访问性交互时，应优先使用 shadcn/ui、Radix UI 或本地组件。
- 如果 Magic UI 组件经过大量业务改造，并逐渐成为项目基础 primitive，可以再评估是否从 `src/registry/magicui/` 移入 `src/components/ui/`。

整体目标是让目录能表达组件身份：本地基础组件、外部视觉组件、页面业务组件各自清楚，避免后续维护时混乱。
