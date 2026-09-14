# UI Component Library Specification & Development Guide
# 组件库开发规范与架构设计指南

> **适用对象**：AI 编码助手（Agents）、前端工程师及后续维护者。  
> **核心原则**：本目录（`src/components/ui/`）存放全站核心的通用基础 UI 交互原语。组件必须遵循**成熟 UI 组件库（如 shadcn/ui、Radix UI、Magic UI）的设计标准**：**完全独立自洽、高度内聚、职责单一、零项目业务耦合**。

---

## 目录索引

1. [AI 规范开发工作流 (AI Agent SOP)](#1-ai-规范开发工作流-ai-agent-sop)
2. [PlaygroundDocsLayout 极简扩展规范](#2-playgrounddocslayout-极简扩展规范)
3. [架构定位与职责单一隔离原则](#3-架构定位与职责单一隔离原则)
4. [空间拟物折射光学系统 (Apple Liquid Glass)](#4-空间拟物折射光学系统-apple-liquid-glass)
5. [动效、弹簧物理与坐标安全准则 (避坑指南)](#5-动效弹簧物理与坐标安全准则-避坑指南)
6. [Magic UI 标准双模态视窗 ComponentPreview](#6-magic-ui-标准双模态视窗-componentpreview)
7. [标准 UI 原语起手式代码模板](#7-标准-ui-原语起手式代码模板)
8. [组件全量清单与 API 规范速查](#8-组件全量清单与-api-规范速查)
9. [跨项目移植与复用检查清单](#9-跨项目移植与复用检查清单)

---

## 1. AI 规范开发工作流 (AI Agent SOP)

后续任何 AI 助手或开发者在新增、优化或重构 UI 组件时，**必须严格遵守以下 5 步标准作业程序**：

```
[步骤 1] 在 src/components/ui/<kebab-name>.tsx 编写纯粹的 UI 原语组件
   │     (严禁包含任何调试滑块、测试按钮、外展说明或写死假数据)
   ▼
[步骤 2] 在 src/components/index.tsx 导出该组件（命名导出，保持字母排序）
   │
   ▼
[步骤 3] 在 src/data/playgroundNav.ts 中注册组件元数据 (分类、标题、描述、源码路径)
   │
   ▼
[步骤 4] 创建专属详情页 src/pages/playground/<kebab-name>.astro
   │     (直接套用 <PlaygroundDocsLayout currentId="<kebab-name>">，全自动继承侧边栏与导航)
   ▼
[步骤 5] 质量验证：运行 pnpm exec biome check <files> 与 pnpm build 确保零警告通过
```

---

## 2. PlaygroundDocsLayout 极简扩展规范

AI 开发规范见 `src/pages/playground/_agent.md`。该文件以下划线开头，仅供开发参考，Astro 不为其生成页面，也不应加入 Playground 导航。

组件 `.astro` 页面默认不启用文章排版；正文需要时传入 `prose={true}`。`ComponentPreview` 使用 `not-prose` 隔离演示区域，避免图片外边距、链接下划线和标题间距受到文章样式影响。行内代码样式仅作用于 `pre` 外的 `code`，不得污染代码块。

项目维护了全自动文档骨架 `src/layouts/PlaygroundDocsLayout.astro`。当需要为新组件接入 Playground 展示页时，**无需编写重复的侧边栏布局、翻页逻辑与面包屑**，仅需两步即可极速接入：

### 第一步：在 `src/data/playgroundNav.ts` 中注册一条记录
```ts
{
  id: 'my-component',
  name: 'MyComponent',
  label: '组件中文名',
  href: '/playground/my-component',
  componentPath: 'src/components/ui/my-component.tsx',
  description: '组件一句话能力与光学/物理特性定义。',
  badge: 'Micro Action', // 可选分类标签
  isNew: true,           // 是否显示荧光绿 New 药丸徽章
}
```

### 第二步：创建 `src/pages/playground/my-component.astro`
```astro
---
import PlaygroundDocsLayout from '@/layouts/PlaygroundDocsLayout.astro';
import { ComponentPreview } from '@/components/playground/ComponentPreview';
import { MyComponent } from '@/components/ui/my-component';

const codeSnippet = `import { MyComponent } from '@/components/ui/my-component';

export function Demo() {
  return <MyComponent />;
}`;
---

<PlaygroundDocsLayout currentId="my-component">
  {/* 1. Magic UI 双模态预览视窗 (Preview / Code / ↻ Replay / 📋 Copy) */}
  <ComponentPreview client:load code={codeSnippet} canvasBackground="dots">
    <MyComponent client:load />
  </ComponentPreview>

  {/* 2. Props & API Reference 参数表格 (暂不显示下载模块) */}
  <section class="space-y-4">
    <h2 class="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 border-b border-border/60 pb-3">
      <span>⚡</span> Props & API Reference
    </h2>
    <!-- 参数表格 -->
  </section>
</PlaygroundDocsLayout>
```
`PlaygroundDocsLayout` 将**自动根据 `currentId` 完成以下全套渲染**：
- 左侧导航栏激活态药丸背景高亮
- 顶部动态面包屑导航（`Home / Playground / [Category] / [Component]`）
- 右上角自动计算前一个组件 `[←]` 与后一个组件 `[→]`
- 移动端自适应水平滚动胶囊栏
- 源码路径标签与状态徽章

---

## 3. 架构定位与职责单一隔离原则

### 3.1 严格的职责单一与完全隔离 (Strict Single Responsibility & Isolation)
- **纯粹的 UI 实现**：`src/components/ui/` 下的每一个组件文件都是**成熟、完整、自洽的生产级 UI 原语**，其**唯一职责就是负责 UI 结构、样式与自身微交互的实现**。
- **零调试与说明污染**：
  - 组件文件内部**绝对不包含**任何临时的调试控制台、测试滑块、参数调节面板或多余的假数据。
  - 组件文件内部**绝对不耦合**具体的展示场景或外层业务卡片结构。
- **调试、说明与沙盒全量移交 Astro 页面**：
  - 组件的各种属性调参沙盒（如 Variant、Size、Shape 开关）、多重应用预设场景、代码复制生成器与 API 文档，**一律在对应的 Astro 页面（`src/pages/playground/*.astro`）中独立实现**。
  - 组件与页面之间通过标准的 TypeScript Props 接口进行单向通信，互不影响、互不依赖、互不破坏。

### 3.2 独立性与零耦合原则 (Zero-Coupling & Encapsulation)
- **开箱即用，无缝移植**：任何开发者均可直接拷贝 `src/components/ui/` 下的任意单个文件到全新的 Next.js / Vite / Remix / Astro 项目中直接使用，无需魔改内部代码。
- **配置外置**：组件所需的所有行为、文案、图标与事件回调均通过标准的 TypeScript Props 传入，并提供健全优雅的默认值（Default Props）。
- **样式原子化与可覆盖性**：
  - 核心基类采用 `class-variance-authority` (cva) 结构化声明。
  - 用户传入的 `className` 必须置于类名合并的末位：`cn(variants({ ... }), className)`，确保外部调用方可随时覆盖尺寸、定位或内外边距，而不破坏组件内部关键结构。
- **无状态泄漏**：临时动画状态（如 hover 坐标、粒子生命周期）在组件内部自闭环，并在卸载时严格清理定时器、`requestAnimationFrame` 与事件监听器。

---

## 4. 空间拟物折射光学系统 (Apple Liquid Glass)

全站拟物空间组件（如 `LiquidGlassButton`、`FloatingDock`、`PlaceholdersAndVanishInput`、`LinkPreview`）均源自 `src/components/header/NavigationMenu.tsx` 沉淀的拟物折射光学规范：

```css
/* ─────────────────────────────────────────────────────────────
   苹果空间液态玻璃（Liquid Glass）核心配方
   ───────────────────────────────────────────────────────────── */

/* 1. 双层高斯背景模糊与饱和度色彩增益 */
backdrop-blur-2xl saturate-180

/* 2. 渐变半透明液态底衬（明暗模式自然适配） */
bg-gradient-to-b from-white/80 via-white/55 to-white/70
dark:bg-gradient-to-b dark:from-neutral-800/80 dark:via-neutral-900/60 dark:to-neutral-900/75

/* 3. 半透明微折射双层边框 */
border border-white/70 dark:border-white/15

/* 4. 双层菲涅尔边缘折射光与下沉柔和阴影 (Fresnel Specular Highlight) */
shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08),inset_0_1.5px_1px_0_rgba(255,255,255,0.95),inset_0_-1px_1px_0_rgba(0,0,0,0.03)]
dark:shadow-[0_12px_32px_-4px_rgba(0,0,0,0.5),inset_0_1.5px_1px_0_rgba(255,255,255,0.22),inset_0_-1px_1px_0_rgba(0,0,0,0.4)]

/* 5. 顶层 1px 弧形凸面镜倒角高光光泽（模拟凸透镜聚光边缘） */
pointer-events-none absolute inset-x-3 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/95 to-transparent dark:via-white/35
```

---

## 5. 动效、弹簧物理与坐标安全准则 (避坑指南)

### ⚠️ 避坑红线 1：严禁将 Tailwind CSS `translate` 与 Motion `transform` 作用在同一个元素上！
- **原理剖析**：
  Tailwind v4 采用现代 CSS 原生独立的 `translate: var(--tw-translate-x) var(--tw-translate-y)` 属性；而 Motion 的 `animate={{ x: '-50%' }}` 会向 DOM 的 `style` 属性中写入 `transform: translateX(-50%)`。
  现代浏览器中 `translate` 与 `transform` 是两个独立生效的属性，因此两者并存会导致**二次平移（Total Offset = -100%）**，产生文字气泡向左严重跑偏等缺陷。
- **标准解法（职责分层）**：
  ```tsx
  // ✅ 推荐做法：外层 div 负责绝对定位与 CSS 居中锚定，内层 motion.div 仅负责透明度、Y轴微漂移与缩放
  <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 z-50">
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.92 }}
      className="w-max rounded-full ..."
    >
      {title}
    </motion.div>
  </div>
  ```

### 避坑红线 2：光标坐标映射必须统一使用视口坐标 `clientX`
- 当计算鼠标光标相对组件中心的距离（如 Dock 磁吸放大、聚光灯跟随）时，由于 `getBoundingClientRect()` 返回的是**视口相对坐标（Viewport Coordinates）**，`onMouseMove` 中必须统一使用 `e.clientX`，严禁混用包含页面滚动 offset 的 `e.pageX`。

### 避坑红线 3：浮层弹窗必须通过 Portal 挂载到 body
- 凡是悬浮卡片、Tooltip、气泡菜单等可能超出父容器边界的元素，必须通过 Radix UI 的 `<*.Portal>` 挂载至 `document.body`，彻底杜绝父容器或祖先节点的 `overflow: hidden` 对浮层造成的截断裁切问题。

### 避坑红线 4：HTML5 Canvas 粒子消散必须考虑 DPR 与 Alpha 通道
- Canvas 必须根据 `window.devicePixelRatio` 缩放分辨率并与 input 尺寸 1:1 精确对齐，禁止粗暴使用 CSS `scale-50`。
- 提取有效文字像素时，必须判定透明度通道 `alpha > 40`，严禁判定 `R/G/B !== 0`。
- 动画进行时，波前左侧未消散文字必须在 Canvas 上绘制保持原样，波前经过处逐像素漂散，杜绝“全字凭空瞬间消失”。

---

## 6. Magic UI 标准双模态视窗 ComponentPreview

详情页统一采用 `src/components/playground/ComponentPreview.tsx` 容器：
- `[Preview]` 标签页：极简文字选项卡，居中渲染带有点阵背景的真实动态实例。
- `[Code]` 标签页：展示纯净可拷贝的调用代码。
- 右上角内置 `↻` 重放按钮（通过 `key` 重置实现无刷新动效重放）与 `📋` 一键复制代码。

---

## 7. 标准 UI 原语起手式代码模板

新增任何基础 UI 组件时，可直接以此模板为基石进行开发：

```tsx
'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion, type HTMLMotionProps } from 'motion/react';
import { cn } from '@/lib/utils';

export const sampleComponentVariants = cva(
  [
    'inline-flex items-center justify-center font-medium select-none cursor-pointer',
    'transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring',
    'disabled:pointer-events-none disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        glass: 'backdrop-blur-2xl saturate-180 bg-white/75 dark:bg-neutral-800/70 border border-white/60 dark:border-white/12 shadow-sm',
      },
      size: {
        default: 'h-10 px-4 py-2 text-sm',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface SampleComponentProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof sampleComponentVariants> {
  asChild?: boolean;
}

export const SampleComponent = React.forwardRef<HTMLButtonElement, SampleComponentProps>(
  ({ className, variant, size, children, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(sampleComponentVariants({ variant, size, className }))}
        {...(props as HTMLMotionProps<'button'>)}
      >
        {children}
      </motion.button>
    );
  },
);

SampleComponent.displayName = 'SampleComponent';
```

---

## 8. 组件全量清单与 API 速查表

| 组件文件 | 组件名 | 核心特性 | 外部依赖 | 独立性级别 |
| :--- | :--- | :--- | :--- | :--- |
| `liquid-glass-button.tsx` | `LiquidGlassButton`<br/>`LiquidButton` | 苹果 VisionOS 拟物空间液态玻璃按钮。支持光标跟随聚光折射、10 款材质变体、微物理弹性按压与无障碍链接多态。 | `motion`, `cva`, `clsx`, `tailwind-merge` | 纯 UI 原语 |
| `button.tsx` | `Button`<br/>`buttonVariants` | 全站通用基础系统按钮，6 种语义化风格（default, secondary, outline, destructive, ghost, link）与 6 种尺寸。 | `@radix-ui/react-slot`, `cva` | 纯 UI 原语 |
| `floating-dock.tsx` | `FloatingDock`<br/>`FloatingDockDesktop` | 仿 macOS 空间悬浮导航栏。全视口可见，基于 Motion Spring 弹簧与高斯距离映射实现无缝平滑放大。 | `motion` | 纯 UI 原语 |
| `placeholders-and-vanish-input.tsx` | `PlaceholdersAndVanishInput` | 苹果液态玻璃胶囊输入框。内置占位文本轮播与 HTML5 Canvas 物理粒子消散粉碎动画引擎。 | `motion` | 纯 UI 原语 |
| `link-preview.tsx` | `LinkPreview` | 外部链接悬停微型网页预览。基于 Radix HoverCard Portal 挂载与液态玻璃弹窗卡片打造，绝不被父容器裁切。 | `@radix-ui/react-hover-card`, `motion`, `qss` | 纯 UI 原语 |
| `expanding-carousel.tsx` | `ExpandingCarousel` | 弹性可伸缩轮播图，支持多卡片平滑展开与收起。 | `react` | 纯 UI 原语 |
| `aurora-background.tsx` | `AuroraBackground` | 极光流动背景氛围层，基于多色渐变与混合模式。 | `react` | 纯 UI 容器 |
| `background-lines.tsx` | `BackgroundLines` | 矢量波浪线条流动背景，营造空间几何折射。 | `motion` | 纯 UI 容器 |
| `timeline.tsx` | `Timeline` | 垂直时间轴组件，支持滚动发光光线追踪。 | `motion` | 纯 UI 容器 |
| `dropdown-menu.tsx` | `DropdownMenu*` | 基于 Radix 的全功能下拉菜单套件。 | `@radix-ui/react-dropdown-menu` | 纯 UI 原语 |
| `navigation-menu.tsx` | `NavigationMenu*` | 基于 Radix 的头部导航下拉浮层套件。 | `@radix-ui/react-navigation-menu` | 纯 UI 原语 |
| `navbar-menu.tsx` | `NavbarMenu*` | 悬浮导航胶囊菜单基类。 | `motion` | 纯 UI 原语 |

---

## 9. 跨项目移植与复用检查清单

如需将本目录组件引入其他新项目（Next.js / Vite / Remix / Astro 等），仅需满足以下最小环境依赖：

1. **基础合并函数 `src/lib/utils.ts`**：
   ```ts
   import { type ClassValue, clsx } from 'clsx';
   import { twMerge } from 'tailwind-merge';

   export function cn(...inputs: ClassValue[]) {
     return twMerge(clsx(inputs));
   }
   ```

2. **核心包依赖**：
   ```bash
   pnpm add motion class-variance-authority clsx tailwind-merge lucide-react
   # 如使用下拉或预览浮层，添加对应的 Radix 原语：
   pnpm add @radix-ui/react-slot @radix-ui/react-hover-card
   ```

3. **Tailwind 配置**：
   确保启用了 Tailwind CSS 的 backdrop 滤镜工具类（Tailwind v3 默认已启用，v4 原生支持）。


## ExpandingCarousel 使用约定

完整示例与参数表见 `src/pages/playground/expanding-carousel.astro`（网站路径 `/playground/expanding-carousel`）。示例数据使用 `ExpandingCarouselItem[]` 类型，避免 `image.fit` 被推断为任意字符串。

- 图片默认 `image.fit: 'cover'`，按比例铺满并裁切；`'contain'` 完整显示，比例不同会留白，无固定像素尺寸要求。`previewSrc` 可单独提供侧边缩略图，缩略图始终使用 cover。
- 默认文字区为纵向弹性布局，标题与详情间距受卡片高度和内容量影响。仅替换媒体使用 `renderMedia`；`renderContent` 会接管整个展开内容。
- 正文内嵌时用 `not-prose` 隔离；`ComponentPreview` 已内置。不要用更换图片尺寸来修复正文样式引入的图片外边距。
- Astro 使用 React 包装组件并以 `client:visible` 水合；自定义渲染函数定义在 React 内部。
- 跨项目需要同时携带 TSX 与 CSS，适配 `cn` 和主题变量，提供 React、lucide-react 依赖。连接件的几何更新由组件内部处理。
