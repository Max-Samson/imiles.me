'use client';

import {
  ArrowRight,
  Code,
  ExternalLink,
  Eye,
  FolderGit2,
  Home,
  Laptop,
  Mail,
  MousePointerClick,
  Play,
  Search,
  Sliders,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import ExpandingCarousel, { type ExpandingCarouselItem } from '@/components/ui/expanding-carousel';
import { FloatingDock } from '@/components/ui/floating-dock';
import { LinkPreview } from '@/components/ui/link-preview';
import { LiquidGlassButton } from '@/components/ui/liquid-glass-button';
import { PlaceholdersAndVanishInput } from '@/components/ui/placeholders-and-vanish-input';
import { cn } from '@/lib/utils';

/**
 * 1. 核心系统按钮组件交互展台 (src/components/ui/button.tsx)
 */
export function SystemButtonShowcase() {
  const [selectedVariant, setSelectedVariant] = useState<
    'default' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'link'
  >('default');
  const [selectedSize, setSelectedSize] = useState<'sm' | 'default' | 'lg' | 'icon'>('default');
  const [clickCount, setClickCount] = useState(0);

  const variants = [
    { id: 'default', label: 'Default', desc: '主要实心强调' },
    { id: 'secondary', label: 'Secondary', desc: '次级低对比底色' },
    { id: 'outline', label: 'Outline', desc: '微磨砂外线框' },
    { id: 'destructive', label: 'Destructive', desc: '危险破坏操作' },
    { id: 'ghost', label: 'Ghost', desc: '悬停显现幽灵按钮' },
    { id: 'link', label: 'Link', desc: '下划线文字链接' },
  ] as const;

  const sizes = [
    { id: 'sm', label: 'Small (SM)' },
    { id: 'default', label: 'Medium (MD)' },
    { id: 'lg', label: 'Large (LG)' },
    { id: 'icon', label: 'Square (Icon)' },
  ] as const;

  return (
    <div className="rounded-3xl border border-border/70 bg-card/40 backdrop-blur-xl shadow-xl overflow-hidden">
      {/* 顶部控制栏 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 bg-muted/20 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
            <Sliders className="size-4" />
          </span>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Button Interactive Stage</h4>
            <p className="text-[11px] text-muted-foreground">实时调节系统通用按钮的变体与尺寸</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <MousePointerClick className="size-3.5 text-amber-400" />
          <span>点击响应: {clickCount} 次</span>
        </div>
      </div>

      {/* 按钮主展示舞台 */}
      <div className="relative min-h-[220px] flex items-center justify-center p-8 bg-neutral-950/40 overflow-hidden">
        <div className="pointer-events-none absolute -top-8 left-1/3 size-64 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 right-1/3 size-64 rounded-full bg-sky-500/15 blur-3xl" />

        <div className="relative z-10 flex flex-wrap items-center justify-center gap-6">
          <Button
            variant={selectedVariant}
            size={selectedSize}
            onClick={() => setClickCount((c) => c + 1)}
            className="shadow-md transition-all active:scale-95"
          >
            {selectedSize === 'icon' ? (
              <Sparkles className="size-4" />
            ) : (
              <>
                <Sparkles className="size-4 mr-1.5" />
                Button: {selectedVariant} ({selectedSize})
              </>
            )}
          </Button>

          {/* 对照项：LiquidGlassButton */}
          <LiquidGlassButton
            variant="brand"
            size={selectedSize === 'icon' ? 'icon' : selectedSize}
            shape="pill"
            glow
            onClick={() => setClickCount((c) => c + 1)}
            icon={<Sparkles className="size-4" />}
          >
            {selectedSize === 'icon' ? undefined : 'Liquid Glass 对照'}
          </LiquidGlassButton>
        </div>
      </div>

      {/* 控制选项面板 */}
      <div className="border-t border-border/60 bg-card/60 p-6 space-y-5">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2.5">
            样式变体 (Variant)
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedVariant(v.id)}
                className={cn(
                  'p-2 rounded-xl border text-xs font-medium text-center transition-all',
                  selectedVariant === v.id
                    ? 'border-amber-400/80 bg-amber-500/15 text-amber-400 font-semibold shadow-xs'
                    : 'border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/40',
                )}
              >
                <div className="font-semibold">{v.label}</div>
                <div className="text-[10px] text-muted-foreground truncate">{v.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2.5">
            尺寸规范 (Size)
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {sizes.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedSize(s.id)}
                className={cn(
                  'py-2 px-3 rounded-xl border text-xs font-medium text-center transition-all',
                  selectedSize === s.id
                    ? 'border-amber-400/80 bg-amber-500/15 text-amber-400 font-semibold shadow-xs'
                    : 'border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/40',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 2. 物理粒子消散打字机输入框交互展台 (src/components/ui/placeholders-and-vanish-input.tsx)
 */
export function PlaceholdersInputShowcase() {
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
  const [triggerKey, setTriggerKey] = useState(0);

  const samplePlaceholders = [
    '简单占位文案 1：输入内容并按回车...',
    '简单占位文案 2：体验粒子消散粉碎效果...',
    '简单占位文案 3：Type something here...',
  ];

  const handleInputSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.querySelector('input') as HTMLInputElement;
    if (input?.value.trim()) {
      setSubmittedQuery(input.value.trim());
    }
  };

  // 一键快捷体验粒子粉碎功能
  const handleQuickDemo = () => {
    setTriggerKey((k) => k + 1);
    setTimeout(() => {
      const input = document.querySelector('input[type="text"]') as HTMLInputElement;
      if (input) {
        input.value = 'Quantum Particle Shatter ✨';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        setTimeout(() => {
          const form = input.closest('form');
          if (form) {
            form.requestSubmit();
            setSubmittedQuery('Quantum Particle Shatter ✨');
          }
        }, 400);
      }
    }, 50);
  };

  return (
    <div className="relative rounded-3xl border border-border/70 bg-card/40 backdrop-blur-xl shadow-xl overflow-hidden">
      {/* 渐变氛围光斑展现双层高斯模糊与液态折射 */}
      <div className="pointer-events-none absolute -top-16 left-1/4 size-72 rounded-full bg-purple-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 right-1/4 size-72 rounded-full bg-sky-500/20 blur-3xl" />

      {/* 顶部工具栏 */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-border/60 bg-muted/20 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
            <Search className="size-4" />
          </span>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Placeholders & Vanish Engine</h4>
            <p className="text-[11px] text-muted-foreground">HTML5 Canvas 真实物理微粒子解构引擎</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleQuickDemo}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-sky-400/40 bg-sky-500/15 text-xs font-mono text-sky-400 hover:bg-sky-500/25 transition-all shadow-xs cursor-pointer active:scale-95"
        >
          <Play className="size-3" />
          一键测试粒子粉碎
        </button>
      </div>

      {/* 输入框主展示区 */}
      <div className="relative z-10 min-h-[220px] flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-xl">
          <PlaceholdersAndVanishInput
            key={triggerKey}
            placeholders={samplePlaceholders}
            onChange={() => {}}
            onSubmit={handleInputSubmit}
            ariaLabel="Playground Search Input"
          />
        </div>

        {submittedQuery ? (
          <div className="mt-4 px-3 py-1 rounded-full border border-sky-400/30 bg-sky-500/10 text-xs font-mono text-sky-400">
            上次成功解构粒子: <strong className="text-foreground">"{submittedQuery}"</strong>
          </div>
        ) : (
          <p className="mt-4 text-xs font-mono text-muted-foreground text-center">
            💡 在输入框中输入任意内容后按{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono border border-border">
              Enter
            </kbd>
            ，或点击右上角按钮直接观察粉碎过程
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * 3. 悬浮弹性放大 Dock 栏交互展台 (src/components/ui/floating-dock.tsx)
 */
export function FloatingDockShowcase() {
  const dockItems = [
    { title: '首页 Home', icon: <Home className="size-full" />, href: '/' },
    { title: '项目 Projects', icon: <Laptop className="size-full" />, href: '/projects' },
    { title: '终端 Terminal', icon: <Terminal className="size-full" />, href: '/notes' },
    {
      title: '代码 Code',
      icon: <Code className="size-full" />,
      href: 'https://github.com/Max-Samson',
      target: '_blank' as const,
    },
    {
      title: '仓库 Git',
      icon: <FolderGit2 className="size-full" />,
      href: 'https://github.com/Max-Samson/imiles.me',
      target: '_blank' as const,
    },
    {
      title: '联系 Contact',
      icon: <Mail className="size-full" />,
      href: 'mailto:maxshuai355@gmail.com',
    },
  ];

  return (
    <div className="relative rounded-3xl border border-border/70 bg-card/40 backdrop-blur-xl shadow-xl overflow-hidden">
      {/* 渐变氛围光斑展现液态玻璃胶囊底座折射 */}
      <div className="pointer-events-none absolute -bottom-10 left-1/3 size-72 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -top-10 right-1/3 size-72 rounded-full bg-amber-500/15 blur-3xl" />

      {/* 顶部工具栏 */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-border/60 bg-muted/20 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
            <Laptop className="size-4" />
          </span>
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              FloatingDock Dynamic Magnification
            </h4>
            <p className="text-[11px] text-muted-foreground">
              采用 NavigationMenu 同源的液态玻璃胶囊底座
            </p>
          </div>
        </div>

        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
          Motion Spring Physics
        </span>
      </div>

      {/* Dock 演示主舞台 */}
      <div className="relative z-10 min-h-[220px] flex flex-col items-center justify-center p-8">
        <FloatingDock items={dockItems} />

        <p className="mt-6 text-xs font-mono text-muted-foreground text-center">
          💡 鼠标在图标之间横向平滑滑动，可体验 macOS 经典磁吸弹性放大与高光浮现气泡
        </p>
      </div>
    </div>
  );
}

/**
 * 4. 外部链接悬停实时预览卡片交互展台 (src/components/ui/link-preview.tsx)
 */
export function LinkPreviewShowcase() {
  const [pinned, setPinned] = useState(false);

  return (
    <div className="relative rounded-3xl border border-border/70 bg-card/40 backdrop-blur-xl shadow-xl overflow-visible">
      {/* 顶部工具栏 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 bg-muted/20 px-6 py-4 rounded-t-3xl">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-purple-500/15 text-purple-400">
            <ExternalLink className="size-4" />
          </span>
          <div>
            <h4 className="text-sm font-semibold text-foreground">LinkPreview Hover Cards</h4>
            <p className="text-[11px] text-muted-foreground">
              Radix UI Portal 挂载与液态玻璃弹窗容器
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPinned(!pinned)}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono transition-all border shadow-xs cursor-pointer',
            pinned
              ? 'border-purple-400/80 bg-purple-500/20 text-purple-300'
              : 'border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground',
          )}
        >
          <Eye className="size-3" />
          {pinned ? '已常开卡片' : '常开卡片观察'}
        </button>
      </div>

      {/* 预览卡片演示区 */}
      <div className="min-h-[220px] flex flex-col items-center justify-center p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-sky-500/30 bg-sky-500/10 backdrop-blur-md">
            <span>演示链接 1：</span>
            <LinkPreview
              url="https://imiles.me/projects/mtimer"
              isStatic={true}
              imageSrc="/assets/demo/ExpandingCarousel-demo1.jpeg"
              width={240}
              height={140}
              className="font-bold text-sky-400 underline underline-offset-4 decoration-sky-400/50 hover:decoration-sky-400 cursor-pointer"
            >
              Demo Preview 1
            </LinkPreview>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/30 bg-purple-500/10 backdrop-blur-md">
            <span>演示链接 2：</span>
            <LinkPreview
              url="https://imiles.me/projects/dsh-usage-chart"
              isStatic={true}
              imageSrc="/assets/demo/ExpandingCarousel-demo2.jpeg"
              width={240}
              height={140}
              className="font-bold text-purple-400 underline underline-offset-4 decoration-purple-400/50 hover:decoration-purple-400 cursor-pointer"
            >
              Demo Preview 2
            </LinkPreview>
          </div>
        </div>

        {/* 若点击常开，则在下方直接常驻渲染一个液态玻璃预览卡片供直接观察 */}
        {pinned && (
          <div className="mt-4 p-2 rounded-2xl border border-white/70 dark:border-white/15 backdrop-blur-2xl saturate-180 bg-gradient-to-b from-white/85 via-white/60 to-white/75 dark:from-neutral-800/80 dark:via-neutral-900/65 dark:to-neutral-900/80 shadow-[0_16px_36px_-6px_rgba(0,0,0,0.25),inset_0_1.5px_1px_0_rgba(255,255,255,0.95)] dark:shadow-[0_20px_40px_-6px_rgba(0,0,0,0.7),inset_0_1.5px_1px_0_rgba(255,255,255,0.22)] relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div
              className="pointer-events-none absolute inset-x-3 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/35"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-1.5 p-2 text-xs font-mono text-muted-foreground">
              <span className="text-foreground font-semibold">
                Demo Cover Preview · Placeholder
              </span>
              <img
                src="/assets/demo/ExpandingCarousel-demo1.jpeg"
                width={240}
                height={140}
                alt="Demo Preview"
                className="rounded-xl object-cover shadow-xs border border-white/20"
              />
            </div>
          </div>
        )}

        <p className="text-xs font-mono text-muted-foreground text-center">
          💡 将光标移动并悬停在上方彩色胶囊中的链接文字上，液态玻璃预览卡片将立即平滑浮现
        </p>
      </div>
    </div>
  );
}

/**
 * 5. LiquidGlassButton 专属主预览展台 (Hero Preview)
 */
export function LiquidGlassHeroPreview() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 py-6">
      <LiquidGlassButton
        variant="brand"
        size="default"
        shape="pill"
        glow
        icon={<Sparkles className="size-4" />}
      >
        Liquid Glass
      </LiquidGlassButton>

      <LiquidGlassButton
        variant="blue"
        size="default"
        shape="pill"
        glow
        iconRight={<ArrowRight className="size-4" />}
      >
        VisionOS Azure
      </LiquidGlassButton>

      <LiquidGlassButton variant="rainbow" size="default" shape="pill" shimmer glow>
        Apple Intelligence
      </LiquidGlassButton>
    </div>
  );
}

/**
 * 6. ExpandingCarousel 专属交互展台 (src/components/ui/expanding-carousel.tsx)
 * 采用 public/assets/demo/ 中的 5 张 demo 实景封面
 */
export function ExpandingCarouselShowcase() {
  const items: ExpandingCarouselItem[] = [
    {
      id: 'demo-card-1',
      eyebrow: 'Demo 01',
      category: 'Desktop App',
      status: 'Active',
      title: 'Demo Item 1',
      description: '这里是卡片简单描述占位文本。',
      badges: ['React', 'TypeScript'],
      image: {
        src: '/assets/demo/ExpandingCarousel-demo1.jpeg',
        alt: 'Demo Cover 1',
        objectFit: 'cover',
      },
      links: [{ label: '查看详情', href: '/playground' }],
    },
    {
      id: 'demo-card-2',
      eyebrow: 'Demo 02',
      category: 'Dashboard',
      status: 'Ready',
      title: 'Demo Item 2',
      description: '这里是卡片简单描述占位文本。',
      badges: ['Motion', 'Tailwind'],
      image: {
        src: '/assets/demo/ExpandingCarousel-demo2.jpeg',
        alt: 'Demo Cover 2',
        objectFit: 'cover',
      },
      links: [{ label: '查看详情', href: '/playground' }],
    },
    {
      id: 'demo-card-3',
      eyebrow: 'Demo 03',
      category: 'UI System',
      status: 'Preview',
      title: 'Demo Item 3',
      description: '这里是卡片简单描述占位文本。',
      badges: ['Design', 'Optics'],
      image: {
        src: '/assets/demo/ExpandingCarousel-demo3.jpeg',
        alt: 'Demo Cover 3',
        objectFit: 'cover',
      },
      links: [{ label: '查看详情', href: '/playground' }],
    },
    {
      id: 'demo-card-4',
      eyebrow: 'Demo 04',
      category: 'Interaction',
      status: 'Active',
      title: 'Demo Item 4',
      description: '这里是卡片简单描述占位文本。',
      badges: ['SVG', 'Connectors'],
      image: {
        src: '/assets/demo/ExpandingCarousel-demo4.jpeg',
        alt: 'Demo Cover 4',
        objectFit: 'cover',
      },
      links: [{ label: '查看详情', href: '/playground' }],
    },
    {
      id: 'demo-card-5',
      eyebrow: 'Demo 05',
      category: 'Showcase',
      status: 'Active',
      title: 'Demo Item 5',
      description: '这里是卡片简单描述占位文本。',
      badges: ['Containers', 'Fluid'],
      image: {
        src: '/assets/demo/ExpandingCarousel-demo5.jpeg',
        alt: 'Demo Cover 5',
        objectFit: 'cover',
      },
      links: [{ label: '查看详情', href: '/playground' }],
    },
  ];

  return (
    <div className="w-full py-2">
      <ExpandingCarousel
        items={items}
        label="Playground UI Showcase Carousel"
        labels={{
          previous: '上一项',
          next: '下一项',
          pause: '暂停自动播放',
          play: '开启自动播放',
          slide: '卡片',
        }}
        interval={3500}
      />
    </div>
  );
}
