'use client';

import { Code, FolderGit2, Home, Laptop, Mail, Play, Sparkles, Terminal } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import ExpandingCarousel, { type ExpandingCarouselItem } from '@/components/ui/expanding-carousel';
import { FloatingDock } from '@/components/ui/floating-dock';
import { LinkPreview } from '@/components/ui/link-preview';
import { LiquidGlassButton } from '@/components/ui/liquid-glass-button';
import { PlaceholdersAndVanishInput } from '@/components/ui/placeholders-and-vanish-input';

/**
 * 1. LiquidGlassButton 展卡微舞台
 */
export function LiquidGlassButtonCardDemo() {
  const [clickCount, setClickCount] = useState(0);

  return (
    <div className="relative min-h-[160px] w-full flex flex-wrap items-center justify-center gap-4 p-6 rounded-2xl bg-neutral-950/40 border border-border/40 overflow-hidden">
      <div className="pointer-events-none absolute -top-8 left-1/4 size-48 rounded-full bg-amber-500/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-8 right-1/4 size-48 rounded-full bg-sky-500/15 blur-2xl" />

      <LiquidGlassButton
        variant="brand"
        size="default"
        shape="pill"
        glow
        icon={<Sparkles className="size-4" />}
        onClick={() => setClickCount((c) => c + 1)}
      >
        Liquid Glass
      </LiquidGlassButton>

      <LiquidGlassButton
        variant="blue"
        size="default"
        shape="pill"
        glow
        onClick={() => setClickCount((c) => c + 1)}
      >
        VisionOS Azure
      </LiquidGlassButton>

      <LiquidGlassButton
        variant="rainbow"
        size="sm"
        shape="pill"
        shimmer
        glow
        icon={<Sparkles className="size-3.5" />}
        onClick={() => setClickCount((c) => c + 1)}
      >
        Rainbow
      </LiquidGlassButton>

      {clickCount > 0 && (
        <span className="absolute bottom-2 right-3 text-[10px] font-mono text-muted-foreground">
          点击测试: {clickCount} 次
        </span>
      )}
    </div>
  );
}

/**
 * 2. FloatingDock 展卡微舞台
 */
export function FloatingDockCardDemo() {
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
    <div className="relative min-h-[160px] w-full flex flex-col items-center justify-center p-6 rounded-2xl bg-neutral-950/40 border border-border/40 overflow-hidden">
      <div className="pointer-events-none absolute -bottom-6 left-1/3 size-56 rounded-full bg-emerald-500/15 blur-2xl" />
      <div className="pointer-events-none absolute -top-6 right-1/3 size-56 rounded-full bg-amber-500/15 blur-2xl" />

      <FloatingDock items={dockItems} />

      <span className="mt-3 text-[11px] font-mono text-muted-foreground text-center">
        💡 左右滑动鼠标感受磁吸平滑放大
      </span>
    </div>
  );
}

/**
 * 3. PlaceholdersAndVanishInput 展卡微舞台
 */
export function PlaceholdersInputCardDemo() {
  const [triggerKey, setTriggerKey] = useState(0);

  const samplePlaceholders = [
    '键入文字并回车观察粒子粉碎...',
    '简单占位提示文案...',
    'Type something to test...',
  ];

  const handleQuickDemo = () => {
    setTriggerKey((k) => k + 1);
    setTimeout(() => {
      const input = document.getElementById('playground-card-vanish-input') as HTMLInputElement;
      if (input) {
        input.value = 'Quantum Particle ✨';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        setTimeout(() => {
          const form = input.closest('form');
          if (form) form.requestSubmit();
        }, 350);
      }
    }, 50);
  };

  return (
    <div className="relative min-h-[160px] w-full flex flex-col items-center justify-center p-6 rounded-2xl bg-neutral-950/40 border border-border/40 overflow-hidden">
      <div className="pointer-events-none absolute -top-8 left-1/4 size-56 rounded-full bg-purple-500/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-8 right-1/4 size-56 rounded-full bg-sky-500/15 blur-2xl" />

      <div className="relative z-10 w-full max-w-md">
        <PlaceholdersAndVanishInput
          key={triggerKey}
          placeholders={samplePlaceholders}
          ariaLabel="Card demo input"
        />
      </div>

      <button
        type="button"
        onClick={handleQuickDemo}
        className="relative z-10 mt-3.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-sky-400/30 bg-sky-500/10 text-[11px] font-mono text-sky-400 hover:bg-sky-500/20 transition-all cursor-pointer active:scale-95"
      >
        <Play className="size-3" />
        一键体验文字粉碎
      </button>
    </div>
  );
}

/**
 * 4. LinkPreview 展卡微舞台
 */
export function LinkPreviewCardDemo() {
  return (
    <div className="relative min-h-[160px] w-full flex flex-col items-center justify-center gap-4 p-6 rounded-2xl bg-neutral-950/40 border border-border/40 overflow-visible">
      <div className="pointer-events-none absolute -top-6 left-1/4 size-48 rounded-full bg-sky-500/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-6 right-1/4 size-48 rounded-full bg-purple-500/15 blur-2xl" />

      <div className="relative z-10 flex flex-wrap items-center justify-center gap-3 text-xs">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 backdrop-blur-md">
          <span>链接 1：</span>
          <LinkPreview
            url="https://imiles.me/projects/mtimer"
            isStatic={true}
            imageSrc="/assets/demo/ExpandingCarousel-demo1.jpeg"
            width={220}
            height={130}
            className="font-bold text-sky-400 underline underline-offset-4 decoration-sky-400/50 hover:decoration-sky-400 cursor-pointer"
          >
            Demo Link 1
          </LinkPreview>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 backdrop-blur-md">
          <span>链接 2：</span>
          <LinkPreview
            url="https://imiles.me/projects/dsh-usage-chart"
            isStatic={true}
            imageSrc="/assets/demo/ExpandingCarousel-demo2.jpeg"
            width={220}
            height={130}
            className="font-bold text-purple-400 underline underline-offset-4 decoration-purple-400/50 hover:decoration-purple-400 cursor-pointer"
          >
            Demo Link 2
          </LinkPreview>
        </div>
      </div>

      <span className="relative z-10 text-[11px] font-mono text-muted-foreground text-center">
        💡 悬停在上方链接文字上查看实时预览卡片
      </span>
    </div>
  );
}

/**
 * 5. Button 展卡微舞台
 */
export function ButtonCardDemo() {
  const [clicked, setClicked] = useState<string | null>(null);

  return (
    <div className="relative min-h-[160px] w-full flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-neutral-950/40 border border-border/40 overflow-hidden">
      <div className="pointer-events-none absolute -top-8 left-1/3 size-56 rounded-full bg-amber-500/15 blur-2xl" />

      <div className="relative z-10 flex flex-wrap items-center justify-center gap-2.5">
        <Button size="sm" onClick={() => setClicked('Default')}>
          Default
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setClicked('Secondary')}>
          Secondary
        </Button>
        <Button size="sm" variant="outline" onClick={() => setClicked('Outline')}>
          Outline
        </Button>
        <Button size="sm" variant="destructive" onClick={() => setClicked('Destructive')}>
          Destructive
        </Button>
      </div>

      <span className="text-[11px] font-mono text-muted-foreground">
        {clicked ? `最新点击: ${clicked}` : '标准 CVA 基础按钮变体族'}
      </span>
    </div>
  );
}

/**
 * 6. ExpandingCarousel 展卡微舞台
 */
export function ExpandingCarouselCardDemo() {
  const items: ExpandingCarouselItem[] = [
    {
      id: 'demo-1',
      eyebrow: 'Demo 01',
      category: 'Category 1',
      title: 'Demo Item 1',
      description: '这里是简单描述占位文本。',
      image: {
        src: '/assets/demo/ExpandingCarousel-demo1.jpeg',
        alt: 'Demo Cover 1',
        fit: 'cover',
      },
      links: [{ label: '查看详情', href: '/playground' }],
    },
    {
      id: 'demo-2',
      eyebrow: 'Demo 02',
      category: 'Category 2',
      title: 'Demo Item 2',
      description: '这里是简单描述占位文本。',
      image: {
        src: '/assets/demo/ExpandingCarousel-demo2.jpeg',
        alt: 'Demo Cover 2',
        fit: 'cover',
      },
      links: [{ label: '查看详情', href: '/playground' }],
    },
  ];

  return (
    <div className="relative min-h-[180px] w-full flex flex-col items-center justify-center p-2 rounded-2xl bg-neutral-950/40 border border-border/40 overflow-hidden">
      <ExpandingCarousel
        items={items}
        label="Mini Carousel Demo"
        labels={{
          previous: '上一张',
          next: '下一张',
          pause: '暂停',
          play: '播放',
          slide: '卡片',
        }}
        interval={4000}
      />
    </div>
  );
}
