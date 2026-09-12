# ExpandingCarousel

可复用的 React UI 组件：`src/components/ui/expanding-carousel.tsx`，独立样式位于同目录的 `expanding-carousel.css`。

## 交互参考

参考 [Calendly 首页](https://calendly.com/) 的 `[Home]-CustomerStories` 区块（2026-09-12 浏览器 DOM 与交互观察），对应 `.px-page.w-full.flex.flex-col.items-center.gap-4xl.pt-section-medium`。

- 桌面中央卡片 762 × 513px，近侧 105 × 344px，远侧 74 × 205px。
- 卡片居中连接，切换时横向移动、宽高展开/收拢，正文与缩略图交叉淡入。
- 底部选中指示器扩展为 80px 进度条，其他指示器为 8px。
- 移动端为文字在上、图片在下的卡片，两侧保留预览；容器查询允许组件在任意宽度的父容器内复用。
- 自动播放默认每 9 秒切换；离屏、隐藏标签页、悬停、焦点进入组件及手动暂停时停止进度。减弱动效时停用自动播放和过渡。
- 支持侧卡点击、指示器选择、左右箭头、Home / End 键、触摸横向滑动。纵向触摸保留页面滚动。

使用本项目的中英文内容、LightRays 背景和明暗主题，不使用 Calendly 的客户照片、文案或品牌字体。产品截图使用 `contain` 显示完整界面；通用组件默认 `cover`。增加了可访问的前后/暂停按钮；移动端高度 570px，为项目技术标签和链接留出空间。

## 用法

```tsx
import ExpandingCarousel from '@/components/ui/expanding-carousel';

<ExpandingCarousel
  label="Selected projects"
  items={[
    {
      id: 'project-overview',
      eyebrow: 'Project · Active',
      title: 'Project overview',
      description: 'A concise description of the product or feature.',
      image: { src: '/projects/example/screen.png', alt: 'Application screen', fit: 'contain' },
      badges: ['TypeScript', 'React'],
      links: [{ label: 'Details', href: '/projects/example' }],
    },
  ]}
  labels={{ previous: 'Previous', next: 'Next', pause: 'Pause', play: 'Play', slide: 'Slide' }}
  interval={9000}
/>
```

Astro 中用 `client:visible` 水合。空数组不输出 UI；单条数据不显示轮播控件；`interval={0}` 禁用自动播放。每个 `id` 应唯一。组件支持可选的终端数据，不依赖项目模型。

## 首页适配

`src/components/home/projectShowcase.ts` 将项目数据映射为轮播项，按截图文件名对应真实功能。`HomeProjectsSection.astro` 只负责组装标题、组件、翻译和“查看全部项目”链接。后续添加项目或截图时无需改动通用轮播组件。

切换节奏：卡片位移与尺寸过渡 1000ms；图片以 750ms 淡入并轻微缩放；标题与正文分别延后 220ms、300ms 出现。相邻图片提前解码，避免初次切换时等待图片显示。可通过 `--carousel-move-duration` 调整卡片移动时长。

---

## 独立 CSS 架构设计解析（为什么需要 expanding-carousel.css）

该组件并未完全依赖 Tailwind 实用类内联，而是维护了同目录的独立样式文件 `expanding-carousel.css`，主要出于以下核心考量：

### 1. 复杂的参数化物理尺寸与几何计算系统（CSS Custom Properties & Math）
- **基准度量体系**：定义了桌面激活卡片（762 × 513px）、近侧缩略卡（105 × 344px）、远侧缩略卡（74 × 205px）及各级间距变量。
- **坐标动态计算**：每个卡片槽位（`data-slot="-3"` ~ `data-slot="3"`）的位移偏移量基于 CSS 自定义变量与多层 `calc()` 联动推导（如槽位 2 需综合激活宽度、近侧宽度、远侧宽度和间距计算半宽与间隙）。
- **层叠重算**：在容器查询断点下，只需重设基础变量（如 `--carousel-active-width: min(320px, calc(100cqw - 24px))`），各槽位和子元素的几何关系自动随之刷新。若使用 Tailwind 的任意值实用类编写此类嵌套公式，JSX 将极其晦涩脆弱。

### 2. 基于 `data-slot` 机制的多层级选择器联动
组件在 TSX 中计算出每张卡片相对当前激活项的相对距离并赋为 `data-slot`。单一属性的变更会跨越多个 DOM 层级触发子元素视觉状态的联动：
- `[data-slot="0"]`（当前卡片）：缩略图淡出并禁用指针（`pointer-events: none`），文本与标题淡入归位，媒体展示区从 `scale(1.025)` 平滑过渡到 `scale(1)`。
- `[data-slot^="-"]`（左侧卡片）：SVG 连接弧线通过绝对定位翻转到左侧（`right: auto; left: calc(100% - 1px)`）。
- `[data-slot="2"] / [data-slot="-2"]`（远端卡片）：连接弧线同步缩放至 18px × 28px。
若在 Tailwind 中通过嵌套后代选择器与数据属性组合（如 `group-data-[slot="0"]:[&_.preview]:opacity-0`）跨级编写，极易导致样式冲突且失去可维护性。

### 3. 精细的时间差动效编排（Staggered Transitions）
卡片平滑切换依赖于精密的阶段性延迟与自定义缓动：
- 采用专用贝塞尔缓动：`--carousel-move-ease: cubic-bezier(0.4, 0, 0.2, 1)` 与 `--carousel-fade-ease: cubic-bezier(0.22, 1, 0.36, 1)`。
- 壳体展开为 1000ms；内部内容容器固定居中锚定，标题延迟 220ms 出现，详情描述延迟 300ms 出现，媒体延迟 100ms 淡入，避免在卡片展开裁切期间文字被横向拖拽撕扯。
- 底部 Tab 从 8px 展开到 80px，并结合 `@keyframes expanding-carousel-progress` 驱动进度条动画。

### 4. 原生组件级容器查询（CSS Container Queries）
外层配置 `container-type: inline-size`，并通过 `@container (max-width: 900px)` 及 `@container (max-width: 599px)` 进行响应式布局。组件自适应的是**所处容器的可用宽度**而非全局浏览器视口（`@media`），保证无论放置在全屏页面、受限栏宽还是弹窗网格中均可开箱自适应。

### 5. 前沿排版与底层渲染优化
- 使用 `@supports (corner-shape: squircle)` 实现连续曲率平滑圆角；
- 使用 `contain: layout paint` 与 `overflow: clip` 隔离重排重绘范围，确保复杂动效高帧率运行；
- 使用 `touch-action: pan-y` 允许水平轮播滑动手势，同时不阻断页面垂直原生滚动；
- 使用 `text-wrap: balance` 与 `text-wrap: pretty` 确保排版美观。

### 6. 关注点分离与 DX 保障
组件 TSX 代码已承载键盘导航（`ArrowLeft`/`ArrowRight`/`Home`/`End`）、触摸速率阈值判定、相邻图片预解码（`img.decode()`）、页面可见性监控、焦点捕获及 ARIA 读屏逻辑。将数百行几何规则与动画提取到同目录 CSS 中，保持了 TSX 交互逻辑的高内聚与可读性。

---

## 作为独立 UI 组件库组件封装的可行性与演进方案

如果将该设计提取为**独立的通用 UI 组件库**（无论是发布为独立 NPM 包，还是作为类似 shadcn / Magic UI 的代码片段库），其核心架构高度可行，但在通用性上建议进行以下解耦升级：

### 一、现有设计中契合组件库规范的优势
1. **纯容器自适应**：依赖 Container Queries 而非视口媒体查询，能嵌入任何消费端宿主布局。
2. **生产级无障碍支持**：内置完善的 WAI-ARIA `tablist` / `tabpanel` 语义、`inert` 状态隔离、焦点捕获管理与 `prefers-reduced-motion` 动效降级。
3. **CSS 变量即 API**：关键尺寸、主题色调和动画时长均通过 CSS 变量暴露，便于宿主按需定制。

### 二、作为通用组件库需解决的瓶颈

| 瓶颈领域 | 现状问题 | 改进方案 |
| :--- | :--- | :--- |
| **样式隔离** | 使用了全局类名（如 `.expanding-carousel`），易受宿主全局 Reset 或类名污染。 | 改用 **CSS Modules**（如 `expanding-carousel.module.css`），或采用严格的命名空间前缀与样式隔离属性。 |
| **外部变量假定** | 引用了宿主特有的 `--muted-foreground` 等变量，且直接硬编码了 `.dark` 根类选择器。 | 所有 CSS 自定义属性提供默认 Fallback（如 `var(--carousel-muted, #586572)`）；暗色模式支持 `theme="dark"` prop 或自定义属性选择器。 |
| **字体硬编码** | 样式中固定了 `font-family: "Noto Serif", "Noto Serif TC", serif`。 | 移除特定字体设定，默认继承宿主字体体系，通过 CSS 变量开放字体定制。 |
| **内容结构写死** | Props 使用固定的 `items` 数组（左文右图/终端），无法扩展视频、3D、表单等自定义内容。 | 升级为**复合组件（Compound Components）**或支持 `renderCard` / `renderPreview` 插槽。 |
| **图标库强绑定** | 直接导入了 `lucide-react` 图标。 | 将图标库设为可选 peerDependency，或开放 `icons={{ prev, next, play, pause }}` 自定义插槽。 |

### 三、未来演进形态设计（复合组件示例）

为了达到一流组件库（如 Radix / Mantine）的灵活性，可将卡片调度引擎与具体展示内容拆解为复合组件形态：

```tsx
<ExpandingCarousel.Root interval={7000} label="Projects showcase">
  <ExpandingCarousel.Stage>
    {projects.map((project) => (
      <ExpandingCarousel.Card key={project.id} id={project.id}>
        {/* 侧边缩略图插槽 */}
        <ExpandingCarousel.Preview>
          <img src={project.thumbnail} alt="" />
        </ExpandingCarousel.Preview>

        {/* 激活展开内容插槽：用户可自由排版 */}
        <ExpandingCarousel.Content>
          <div className="custom-copy">
            <h3>{project.title}</h3>
            <p>{project.description}</p>
          </div>
          <div className="custom-media">
            <CustomPlayer src={project.video} />
          </div>
        </ExpandingCarousel.Content>
      </ExpandingCarousel.Card>
    ))}
  </ExpandingCarousel.Stage>

  <ExpandingCarousel.Controls>
    <ExpandingCarousel.PrevTrigger />
    <ExpandingCarousel.Tabs />
    <ExpandingCarousel.NextTrigger />
  </ExpandingCarousel.Controls>
</ExpandingCarousel.Root>
```

### 四、两种分发模式的最佳实践
- **模式 A：独立 NPM 包（如 `@org/react-expanding-carousel`）**
  - 使用 CSS Modules 打包出独立产物 `dist/index.css`，或采用 CSS-in-JS / Zero-runtime 方案；
  - 核心逻辑输出为无样式/弱样式的 Headless 引擎与开箱即用的 Styled 包装器两个层次。
- **模式 B：源码分发模式（shadcn / CLI Copy-Paste）**
  - 保持目前 `.tsx` + `.css` 的同目录结构，配合 CLI 安装命令一次性复制到消费者的 `components/ui/` 目录下；
  - 将 CSS 包装为 `@layer components`，便于用户与本地 Tailwind / PostCSS 编译链路无缝集成。
