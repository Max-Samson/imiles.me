# Playground 与 UI 组件 AI 开发规范

本文件仅供项目开发使用，不作为网站页面发布。

## 1. 核心使命与架构红线

本项目组件库（`src/components/ui/`）与交互操场（`src/pages/playground/`）严格遵循**成熟开源组件库（如 shadcn/ui、Radix UI）的工程设计规范**。任何接手本项目的 AI Agent 必须坚守以下三大最高红线：

### 红线 1：职责绝对单一，严禁调试代码侵入 UI 原语
- **`src/components/ui/` 仅负责纯粹的 UI 原语实现**：每一个组件必须是成熟、完整、自洽的生产级组件，**严禁在其中编写任何调试滑块、测试开关、演示场景或写死的测试假数据**。
- **展示、调试与参数试验全量移交 Astro 页面**：所有的交互测试台、参数滑块控制、多场景用例以及使用说明，一律在 `src/pages/playground/*.astro` 及对应的 playground 构件中实现。
- **可移植性保障**：任何开发者均可直接拷贝 `src/components/ui/` 下的任意单个文件到其他全新的 React / Next.js / Astro 项目中直接使用，零修改成本。

### 红线 2：兼顾 Astro 框架特质，杜绝死板照搬 Magic UI 的沉重胶水层
- Magic UI 采用 Node 预编译脚本将所有组件生成一个 4000 多行的注册表字典 `__index__.tsx`，本质是受限于 Next.js 的 RSC 边界。
- 本项目基于 **Astro 5 群岛架构**，拥有毫秒级原生 HMR 与极度轻量的组件级水合能力。采用**声明式 Astro 原语（如 `<PropsTable />`）+ 纯粹 React 原语**，以极简代码达成最佳 DX。

### 红线 3：遵从极简展示原则，暂不显示下载/安装模块
- 详情页开门见山展示组件的动态视窗（`ComponentPreview`）与 API 参数表，不输出冗余的 CLI 安装命令或 npm 下载引导。

---

## 2. AI Agent 新增组件 5 步标准作业程序 (SOP)

当用户提出新增、优化或重构 UI 组件需求时，AI Agent 必须按部就班执行以下 5 步：

```
[步骤 1] 编写纯 UI 原语
         └─ 文件位置：src/components/ui/<kebab-name>.tsx
         └─ 规范要求：纯组件实现、cva 变体声明、React.forwardRef、cn() 类名合并

[步骤 2] 导出组件
         └─ 文件位置：src/components/index.tsx
         └─ 规范要求：命名导出，按字母排序

[步骤 3] 注册组件全局元数据
         └─ 文件位置：src/data/playgroundNav.ts
         └─ 规范要求：登记 id、name、label、href、componentPath、description、badge

[步骤 4] 创建专属 5 步文档详情页
         └─ 文件位置：src/pages/playground/<kebab-name>.astro
         └─ 规范要求：套用 <PlaygroundDocsLayout currentId="<kebab-name>">
         └─ 内容编排：Header → ComponentPreview → PropsTable → ArchitectureFeatures

[步骤 5] 质量验证与生产构建
         └─ 执行命令：pnpm exec biome check <files>（确保 0 警告 0 错误）
         └─ 执行命令：pnpm build（确保全站静态与 SSR 路由 100% 打包通过）
```

---

## 3. 动效、光学与排版 6 大避坑硬性红线

在实际工程落地中总结出的高频深坑，AI Agent 必须严格遵守对应解法：

### 避坑 1：严禁 Tailwind `translate` 与 Motion `transform` 作用在同一个元素上！
- **缺陷现象**：气泡或卡片向左严重跑偏 50% 甚至 100%。
- **底层原因**：Tailwind v4 编译为现代 CSS 独立属性 `translate: -50% 0`；而 Motion 写入 `transform: translateX(-50%)`。两者在现代浏览器中相加生效，导致二次平移（Total -100%）。
- **标准解法（职责分层）**：
  ```tsx
  // ✅ 外层 div 负责绝对定位与 CSS 居中锚定，内层 motion.div 仅负责透明度、Y轴微位移与缩放
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

### 避坑 2：光标距离计算必须统一使用 `clientX`
- `getBoundingClientRect()` 返回的是视口坐标，`onMouseMove` 中必须统一使用 `e.clientX`，严禁使用包含页面滚动 offset 的 `e.pageX`。

### 避坑 3：浮层弹窗必须通过 Radix Portal 挂载到 body
- 悬浮卡片、Tooltip 等元素必须通过 `<*.Portal>` 挂载至 `document.body`，彻底杜绝被祖先容器的 `overflow: hidden` 裁切。

### 避坑 4：Canvas 粒子消散必须考虑 DPR 与 Alpha 通道
- Canvas 分辨率必须乘以 `window.devicePixelRatio` 与实际 DOM 1:1 精确匹配，禁止使用 CSS `scale-50`。
- 采样有效文字像素时，必须判定透明度通道 `alpha > 40`，严禁判定 `R/G/B !== 0`。
- 波前左侧未消散文字必须在画布上静态保持原貌，波前经过处逐像素漂散，杜绝“全字瞬间凭空消失”。

### 避坑 5：Astro 模板严禁向组件属性直接传递 React JSX 字面量
- 在 `.astro` 文件中，写 `icon={<Sparkles className="size-4" />}` 会引发 Astro JSX 编译器的 `Expected ">" but found "className"` 语法解析错误。复杂 React 节点请封装在独立的 `.tsx` 文件中导出。

### 避坑 6：组件演示与文章排版样式隔离

- `PlaygroundDocsLayout` 对 Markdown 页面自动启用 `prose`；Astro 组件页面默认使用组件自身的布局。如需正文排版，可显式传入 `prose={true}`。
- `ComponentPreview` 自带 `not-prose`，避免文章样式给演示图片添加外边距、给整张目录卡片添加下划线，或改变组件标题间距。手工嵌入正文的其他 UI 区域也应使用 `not-prose`。
- 行内 `code` 可以使用背景和边框；`pre > code` 应保留代码块的统一背景与语法高亮，不要给所有 `code` 应用行内标签样式。
- 轮播照片默认使用 `image.fit: 'cover'` 铺满并按比例裁切；需要保留完整截图时使用 `'contain'`，比例不一致时会留白。图片没有固定尺寸要求，素材比例影响裁切范围。

---

## 4. 空间拟物折射光学系统 (Apple Liquid Glass) 统一配方

凡涉及拟物折射质感的组件，统一贯彻以下 5 层参数：

```css
/* 1. 双层高斯模糊与饱和度色彩增益 */
backdrop-blur-2xl saturate-180

/* 2. 渐变半透明液态底衬（明暗模式自然适配） */
bg-gradient-to-b from-white/80 via-white/55 to-white/70
dark:bg-gradient-to-b dark:from-neutral-800/80 dark:via-neutral-900/60 dark:to-neutral-900/75

/* 3. 半透明微折射双层边框 */
border border-white/70 dark:border-white/15

/* 4. 双层菲涅尔边缘折射光与下沉柔和阴影 (Fresnel Specular Highlight) */
shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08),inset_0_1.5px_1px_0_rgba(255,255,255,0.95),inset_0_-1px_1px_0_rgba(0,0,0,0.03)]
dark:shadow-[0_12px_32px_-4px_rgba(0,0,0,0.5),inset_0_1.5px_1px_0_rgba(255,255,255,0.22),inset_0_-1px_1px_0_rgba(0,0,0,0.4)]

/* 5. 顶层 1px 弧形凸面镜倒角高光反射线（模拟凸透镜聚光边缘） */
pointer-events-none absolute inset-x-3 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/95 to-transparent dark:via-white/35
```

---

## 5. 标准 UI 原语起手式代码模板

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
        glass:
          'backdrop-blur-2xl saturate-180 bg-white/75 dark:bg-neutral-800/70 border border-white/60 dark:border-white/12 shadow-sm',
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
