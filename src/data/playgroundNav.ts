export interface PlaygroundNavItem {
  id: string;
  name: string;
  label: string;
  href: string;
  componentPath: string;
  description: string;
  badge?: string;
  isNew?: boolean;
}

export interface PlaygroundNavCategory {
  category: string;
  label: string;
  items: PlaygroundNavItem[];
}

export const PLAYGROUND_NAVIGATION: PlaygroundNavCategory[] = [
  {
    category: 'Getting Started',
    label: '开始使用',
    items: [
      {
        id: 'overview',
        name: 'Overview',
        label: '组件库概览',
        href: '/playground',
        componentPath: 'src/pages/playground/index.astro',
        description:
          '全站核心通用基础 UI 交互组件库。严格遵循单一职责、零业务耦合、跨项目无缝移植与空间拟物折射光学设计规范。',
        badge: 'Architecture & Overview',
      },
      {
        id: 'agent',
        name: 'Agent SOP',
        label: 'AI 开发规范',
        href: '/playground/agent',
        componentPath: 'src/pages/playground/agent.md',
        description:
          '面向 AI Agent 与人类开发者的组件库与操场全套工程架构红线、开发标准与 5 步 SOP 指南。',
        badge: 'AI Development SOP',
        isNew: true,
      },
    ],
  },
  {
    category: 'Buttons',
    label: '按钮交互',
    items: [
      {
        id: 'liquid-glass-button',
        name: 'LiquidGlassButton',
        label: '苹果液态玻璃按钮',
        href: '/playground/liquid-glass-button',
        componentPath: 'src/components/ui/liquid-glass-button.tsx',
        description:
          '苹果 VisionOS 风格拟物空间液态玻璃按钮。集成 24px 双层高斯模糊、光标聚光动态折射 (Fresnel Spotlight)、顶部透镜倒角镜面反光与微物理弹性回弹。',
        badge: 'VisionOS & Apple Intelligence',
        isNew: true,
      },
      {
        id: 'button',
        name: 'Button',
        label: '通用系统按钮',
        href: '/playground/button',
        componentPath: 'src/components/ui/button.tsx',
        description:
          '全站通用基础系统按钮基类。基于 class-variance-authority 构建，支持 default, secondary, outline, destructive, ghost, link 6 种语义化风格与多维尺寸。',
        badge: 'CVA & Radix Slot',
      },
    ],
  },
  {
    category: 'Navigation',
    label: '空间导航',
    items: [
      {
        id: 'floating-dock',
        name: 'FloatingDock',
        label: '仿 macOS 空间 Dock',
        href: '/playground/floating-dock',
        componentPath: 'src/components/ui/floating-dock.tsx',
        description:
          '仿 macOS 空间悬浮弹性放大导航栏。采用 NavigationMenu 同源的液态玻璃胶囊底座，基于 Motion 阻尼弹簧与高斯距离映射算法实现光标平滑磁吸放大。',
        badge: 'macOS Physics & Spring',
        isNew: true,
      },
    ],
  },
  {
    category: 'Inputs',
    label: '输入控件',
    items: [
      {
        id: 'placeholders-and-vanish-input',
        name: 'PlaceholdersAndVanishInput',
        label: '粒子消散输入框',
        href: '/playground/placeholders-and-vanish-input',
        componentPath: 'src/components/ui/placeholders-and-vanish-input.tsx',
        description:
          '融合 Apple 液态玻璃胶囊底座与 HTML5 Canvas 物理微粒子解构引擎。输入文字并提交时，文字如细沙般自然化解碎裂飘散。',
        badge: 'Canvas 2D Physics Engine',
        isNew: true,
      },
    ],
  },
  {
    category: 'Overlays',
    label: '浮层与预览',
    items: [
      {
        id: 'link-preview',
        name: 'LinkPreview',
        label: '网页悬停预览卡片',
        href: '/playground/link-preview',
        componentPath: 'src/components/ui/link-preview.tsx',
        description:
          '基于 Radix HoverCard Portal 挂载与液态玻璃弹窗容器打造，鼠标悬停时平滑弹出带高光倒角的网页缩略图，绝不被任何父容器截断。',
        badge: 'Radix Portal & Liquid Popup',
      },
    ],
  },
  {
    category: 'Media & Display',
    label: '轮播与展示',
    items: [
      {
        id: 'expanding-carousel',
        name: 'ExpandingCarousel',
        label: '动态展开卡片轮播',
        href: '/playground/expanding-carousel',
        componentPath: 'src/components/ui/expanding-carousel.tsx',
        description:
          '参考 Calendly 首页的高交互度展开轮播。卡片居中动态连接展开、SVG 连接件边缘自适应、进度条动态拉伸及容器查询响应式适配。',
        badge: 'Calendly Style & SVG Connectors',
        isNew: true,
      },
    ],
  },
];

/** 获取所有组件扁平列表 */
export function getAllPlaygroundItems(): PlaygroundNavItem[] {
  return PLAYGROUND_NAVIGATION.flatMap((cat) => cat.items);
}

/** 根据 id 获取组件详情 */
export function getPlaygroundItemById(id: string): PlaygroundNavItem | undefined {
  return getAllPlaygroundItems().find((item) => item.id === id);
}

/** 根据 id 获取当前、上一组件和下一组件 */
export function getPrevAndNextPlaygroundItem(currentId: string) {
  const items = getAllPlaygroundItems();
  const currentIndex = items.findIndex((item) => item.id === currentId);

  let categoryName = 'Components';
  for (const cat of PLAYGROUND_NAVIGATION) {
    if (cat.items.some((i) => i.id === currentId)) {
      categoryName = cat.category;
      break;
    }
  }

  return {
    current: currentIndex !== -1 ? items[currentIndex] : undefined,
    prev: currentIndex > 0 ? items[currentIndex - 1] : undefined,
    next: currentIndex < items.length - 1 ? items[currentIndex + 1] : undefined,
    category: categoryName,
    index: currentIndex,
    total: items.length,
  };
}
