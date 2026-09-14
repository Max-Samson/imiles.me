'use client';

import {
  ArrowRight,
  Check,
  Compass,
  Copy,
  Layers,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Sliders,
  Sparkles,
  Volume2,
  Zap,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { LiquidGlassButton, type LiquidGlassVariants } from '@/components/ui/liquid-glass-button';
import { cn } from '@/lib/utils';

type VariantType = NonNullable<LiquidGlassVariants['variant']>;
type SizeType = NonNullable<LiquidGlassVariants['size']>;
type ShapeType = NonNullable<LiquidGlassVariants['shape']>;
type BgTheme = 'aurora' | 'mesh' | 'dark' | 'light' | 'grid';
type IconOption = 'sparkles' | 'compass' | 'arrow' | 'none';

const VARIANTS: { id: VariantType; label: string; desc: string; color: string }[] = [
  {
    id: 'default',
    label: 'Default / 水晶透明',
    desc: 'VisionOS 极简通透水晶',
    color: 'bg-white/70',
  },
  { id: 'frosted', label: 'Frosted / 浓郁磨砂', desc: '强漫反射与乳白质感', color: 'bg-white' },
  { id: 'brand', label: 'Brand / 琥珀流金', desc: '网站 Tajik Gold 品牌色', color: 'bg-amber-400' },
  {
    id: 'accent',
    label: 'Accent / 翡翠灵动',
    desc: 'Tajik Green 翠绿透镜',
    color: 'bg-emerald-400',
  },
  { id: 'blue', label: 'Blue / 空间蔚蓝', desc: 'VisionOS 标志性电光宝石蓝', color: 'bg-sky-400' },
  { id: 'purple', label: 'Purple / 赛博紫晶', desc: '暗夜霓虹紫色幻光', color: 'bg-purple-400' },
  {
    id: 'obsidian',
    label: 'Obsidian / 熏黑曜石',
    desc: '深邃高贵黑曜石镜面',
    color: 'bg-neutral-800',
  },
  {
    id: 'rainbow',
    label: 'Rainbow / 虹彩流光',
    desc: 'Apple Intelligence 色散折射',
    color: 'bg-gradient-to-r from-pink-400 via-indigo-400 to-emerald-400',
  },
  {
    id: 'destructive',
    label: 'Destructive / 警示绯红',
    desc: '宝石红危险操作质感',
    color: 'bg-rose-500',
  },
  { id: 'ghost', label: 'Ghost / 幽灵隐现', desc: '静止透明，悬停凝结显形', color: 'bg-white/20' },
];

const SIZES: { id: SizeType; label: string }[] = [
  { id: 'xs', label: 'XS' },
  { id: 'sm', label: 'SM' },
  { id: 'default', label: 'MD (默认)' },
  { id: 'lg', label: 'LG' },
  { id: 'xl', label: 'XL' },
];

const SHAPES: { id: ShapeType; label: string }[] = [
  { id: 'pill', label: 'Capsule (胶囊)' },
  { id: 'squircle', label: 'Squircle (平滑方圆)' },
  { id: 'rounded', label: 'Rounded (适度圆角)' },
];

const BG_THEMES: { id: BgTheme; label: string }[] = [
  { id: 'aurora', label: '极光流体 (强烈折射)' },
  { id: 'mesh', label: '霓虹渐变 (鲜艳透光)' },
  { id: 'dark', label: '暗夜星空 (深色模式)' },
  { id: 'light', label: '浅色工作室 (白日透光)' },
  { id: 'grid', label: '极客网格 (几何折射)' },
];

export default function LiquidGlassButtonDemo() {
  // Playground 状态
  const [variant, setVariant] = useState<VariantType>('brand');
  const [size, setSize] = useState<SizeType>('default');
  const [shape, setShape] = useState<ShapeType>('pill');
  const [interactive, setInteractive] = useState(true);
  const [shimmer, setShimmer] = useState(false);
  const [glow, setGlow] = useState(true);
  const [curvedBevel, setCurvedBevel] = useState(true);
  const [hapticScale, setHapticScale] = useState(true);
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [iconOption, setIconOption] = useState<IconOption>('sparkles');
  const [buttonText, setButtonText] = useState('Liquid Glass');
  const [bgTheme, setBgTheme] = useState<BgTheme>('aurora');

  // 代码复制状态
  const [copied, setCopied] = useState(false);

  // 场景媒体控制播放状态
  const [isPlaying, setIsPlaying] = useState(false);

  // 根据 iconOption 决定图标渲染
  const renderedIcon = useMemo(() => {
    switch (iconOption) {
      case 'sparkles':
        return <Sparkles className="size-4" />;
      case 'compass':
        return <Compass className="size-4" />;
      default:
        return undefined;
    }
  }, [iconOption]);

  const renderedIconRight = useMemo(() => {
    if (iconOption === 'arrow') {
      return <ArrowRight className="size-4" />;
    }
    return undefined;
  }, [iconOption]);

  // 生成对应的 JSX 代码
  const generatedCode = useMemo(() => {
    const propsList: string[] = [];

    if (variant !== 'default') propsList.push(`variant="${variant}"`);
    if (size !== 'default') propsList.push(`size="${size}"`);
    if (shape !== 'pill') propsList.push(`shape="${shape}"`);
    if (!interactive) propsList.push(`interactive={false}`);
    if (shimmer) propsList.push(`shimmer`);
    if (glow) propsList.push(`glow`);
    if (!curvedBevel) propsList.push(`curvedBevel={false}`);
    if (!hapticScale) propsList.push(`hapticScale={false}`);
    if (loading) propsList.push(`loading`);
    if (disabled) propsList.push(`disabled`);

    if (iconOption === 'sparkles') {
      propsList.push(`icon={<Sparkles className="size-4" />}`);
    } else if (iconOption === 'compass') {
      propsList.push(`icon={<Compass className="size-4" />}`);
    } else if (iconOption === 'arrow') {
      propsList.push(`iconRight={<ArrowRight className="size-4" />}`);
    }

    const propsStr = propsList.length > 0 ? `\n  ${propsList.join('\n  ')}\n` : ' ';
    return `import { LiquidGlassButton } from '@/components/ui/liquid-glass-button';

<LiquidGlassButton${propsStr}>
  ${buttonText}
</LiquidGlassButton>`;
  }, [
    variant,
    size,
    shape,
    interactive,
    shimmer,
    glow,
    curvedBevel,
    hapticScale,
    loading,
    disabled,
    iconOption,
    buttonText,
  ]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleReset = () => {
    setVariant('brand');
    setSize('default');
    setShape('pill');
    setInteractive(true);
    setShimmer(false);
    setGlow(true);
    setCurvedBevel(true);
    setHapticScale(true);
    setLoading(false);
    setDisabled(false);
    setIconOption('sparkles');
    setButtonText('Liquid Glass');
  };

  return (
    <div className="w-full space-y-16">
      {/* ─── 核心交互沙盒 (Interactive Playground) ─── */}
      <div className="rounded-3xl border border-border/70 bg-card/60 backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* 顶部控制栏与背景切换器 */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
              <Sliders className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Interactive Stage</h2>
              <p className="text-[11px] text-muted-foreground">
                实时调节玻璃物理属性与背景折射反馈
              </p>
            </div>
          </div>

          {/* 背景环境切换 */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/60 bg-background/50 p-1">
            {BG_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => setBgTheme(theme.id)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-medium transition-all',
                  bgTheme === theme.id
                    ? 'bg-foreground text-background shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )}
              >
                {theme.label}
              </button>
            ))}
          </div>
        </div>

        {/* 玻璃展示主舞台 */}
        <div
          className={cn(
            'relative min-h-[360px] sm:min-h-[420px] flex items-center justify-center p-8 overflow-hidden transition-all duration-700',
            bgTheme === 'aurora' &&
              'bg-neutral-950 [background-image:radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]',
            bgTheme === 'mesh' && 'bg-gradient-to-br from-violet-900 via-indigo-950 to-pink-900',
            bgTheme === 'dark' && 'bg-neutral-950',
            bgTheme === 'light' &&
              'bg-gradient-to-br from-neutral-100 via-stone-200 to-neutral-100',
            bgTheme === 'grid' &&
              'bg-neutral-950 [background-image:linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]',
          )}
        >
          {/* 动态氛围光球（展现玻璃背后真实模糊折射效果） */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <motion.div
              animate={{
                x: [-20, 20, -20],
                y: [-20, 20, -20],
                scale: [1, 1.1, 1],
              }}
              transition={{ repeat: Number.POSITIVE_INFINITY, duration: 8, ease: 'easeInOut' }}
              className="absolute -top-12 -left-12 size-72 rounded-full bg-emerald-500/25 blur-3xl"
            />
            <motion.div
              animate={{
                x: [20, -20, 20],
                y: [20, -20, 20],
                scale: [1.1, 1, 1.1],
              }}
              transition={{ repeat: Number.POSITIVE_INFINITY, duration: 10, ease: 'easeInOut' }}
              className="absolute -bottom-16 -right-16 size-80 rounded-full bg-amber-500/25 blur-3xl"
            />
            <motion.div
              animate={{
                x: [0, 30, 0],
                y: [0, -30, 0],
              }}
              transition={{ repeat: Number.POSITIVE_INFINITY, duration: 9, ease: 'easeInOut' }}
              className="absolute top-1/2 left-1/3 size-64 rounded-full bg-sky-500/20 blur-3xl"
            />

            {/* 浅色背景下柔和彩色光晕 */}
            {bgTheme === 'light' && (
              <div className="absolute inset-0 bg-gradient-to-tr from-sky-200/40 via-pink-200/30 to-amber-200/40" />
            )}
          </div>

          {/* 舞台背景文字水印（展示真实高斯模糊与饱和度增益） */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-10 select-none">
            <span className="font-mono text-6xl sm:text-8xl font-black uppercase tracking-widest text-foreground">
              LIQUID
            </span>
          </div>

          {/* 居中渲染目标液态玻璃按钮 */}
          <div className="relative z-10 flex flex-col items-center gap-4">
            <LiquidGlassButton
              variant={variant}
              size={size}
              shape={shape}
              interactive={interactive}
              shimmer={shimmer}
              glow={glow}
              curvedBevel={curvedBevel}
              hapticScale={hapticScale}
              loading={loading}
              disabled={disabled}
              icon={renderedIcon}
              iconRight={renderedIconRight}
              onClick={() => console.log('LiquidGlassButton clicked')}
            >
              {buttonText}
            </LiquidGlassButton>

            <span className="text-[11px] font-mono text-white/60 dark:text-white/40 bg-black/30 backdrop-blur-md px-2.5 py-0.5 rounded-full mt-2">
              鼠标滑动可体验光标聚光折射 / 点击感受物理阻尼
            </span>
          </div>
        </div>

        {/* 交互参数控制面板 */}
        <div className="border-t border-border/60 bg-card/70 p-6 sm:p-8 space-y-8">
          {/* 1. 材质与色彩变体 (Variant) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="size-3.5 text-sky-400" />
                玻璃材质与色彩变体 (Variant)
              </div>
              <span className="text-xs font-mono text-sky-400">{variant}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {VARIANTS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariant(v.id)}
                  className={cn(
                    'flex flex-col items-start p-2.5 rounded-xl border text-left transition-all',
                    variant === v.id
                      ? 'border-sky-400/80 bg-sky-500/10 shadow-xs'
                      : 'border-border/60 bg-muted/20 hover:border-border hover:bg-muted/40',
                  )}
                >
                  <div className="flex items-center gap-2 w-full mb-1">
                    <span
                      className={cn('size-3 rounded-full shrink-0 border border-white/30', v.color)}
                    />
                    <span className="text-xs font-medium text-foreground truncate">
                      {v.label.split(' / ')[0]}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground line-clamp-1">{v.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. 尺寸与形态 (Size & Shape) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 尺寸 */}
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                按钮尺寸 (Size)
              </div>
              <div className="grid grid-cols-5 gap-2">
                {SIZES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSize(s.id)}
                    className={cn(
                      'py-2 px-1 rounded-lg border text-xs font-medium text-center transition-all',
                      size === s.id
                        ? 'border-sky-400/80 bg-sky-500/15 text-sky-400 font-semibold'
                        : 'border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/40',
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 形状 */}
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                外形轮廓 (Shape)
              </div>
              <div className="grid grid-cols-3 gap-2">
                {SHAPES.map((sh) => (
                  <button
                    key={sh.id}
                    type="button"
                    onClick={() => setShape(sh.id)}
                    className={cn(
                      'py-2 px-2 rounded-lg border text-xs font-medium text-center transition-all',
                      shape === sh.id
                        ? 'border-sky-400/80 bg-sky-500/15 text-sky-400 font-semibold'
                        : 'border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/40',
                    )}
                  >
                    {sh.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. 物理与光学特性开关 (Toggles) */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Zap className="size-3.5 text-amber-400" />
              物理与拟物光学特性开关 (Features & Physics)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border/60 bg-muted/15 cursor-pointer hover:bg-muted/30 transition-colors">
                <input
                  type="checkbox"
                  checked={interactive}
                  onChange={(e) => setInteractive(e.target.checked)}
                  className="rounded border-border text-sky-500 focus:ring-sky-500"
                />
                <span className="text-xs font-medium text-foreground">光标动态折射</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border/60 bg-muted/15 cursor-pointer hover:bg-muted/30 transition-colors">
                <input
                  type="checkbox"
                  checked={shimmer}
                  onChange={(e) => setShimmer(e.target.checked)}
                  className="rounded border-border text-sky-500 focus:ring-sky-500"
                />
                <span className="text-xs font-medium text-foreground">微光液态流动</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border/60 bg-muted/15 cursor-pointer hover:bg-muted/30 transition-colors">
                <input
                  type="checkbox"
                  checked={glow}
                  onChange={(e) => setGlow(e.target.checked)}
                  className="rounded border-border text-sky-500 focus:ring-sky-500"
                />
                <span className="text-xs font-medium text-foreground">环境彩色光晕</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border/60 bg-muted/15 cursor-pointer hover:bg-muted/30 transition-colors">
                <input
                  type="checkbox"
                  checked={curvedBevel}
                  onChange={(e) => setCurvedBevel(e.target.checked)}
                  className="rounded border-border text-sky-500 focus:ring-sky-500"
                />
                <span className="text-xs font-medium text-foreground">凸面透镜倒角</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border/60 bg-muted/15 cursor-pointer hover:bg-muted/30 transition-colors">
                <input
                  type="checkbox"
                  checked={hapticScale}
                  onChange={(e) => setHapticScale(e.target.checked)}
                  className="rounded border-border text-sky-500 focus:ring-sky-500"
                />
                <span className="text-xs font-medium text-foreground">物理按压弹性</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border/60 bg-muted/15 cursor-pointer hover:bg-muted/30 transition-colors">
                <input
                  type="checkbox"
                  checked={loading}
                  onChange={(e) => setLoading(e.target.checked)}
                  className="rounded border-border text-sky-500 focus:ring-sky-500"
                />
                <span className="text-xs font-medium text-foreground">加载动画状态</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border/60 bg-muted/15 cursor-pointer hover:bg-muted/30 transition-colors">
                <input
                  type="checkbox"
                  checked={disabled}
                  onChange={(e) => setDisabled(e.target.checked)}
                  className="rounded border-border text-sky-500 focus:ring-sky-500"
                />
                <span className="text-xs font-medium text-foreground">禁用态 (Disabled)</span>
              </label>

              <button
                type="button"
                onClick={handleReset}
                className="flex items-center justify-center gap-1.5 p-3 rounded-xl border border-border/60 bg-muted/20 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                <RotateCcw className="size-3.5" />
                重置默认参数
              </button>
            </div>
          </div>

          {/* 4. 文本与图标自定义 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label
                htmlFor="playground-button-text"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2"
              >
                按钮文案 (Text)
              </label>
              <input
                id="playground-button-text"
                type="text"
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              />
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                图标搭配 (Icon)
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    { id: 'sparkles', label: '前置星光' },
                    { id: 'compass', label: '前置罗盘' },
                    { id: 'arrow', label: '后置箭头' },
                    { id: 'none', label: '无图标' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setIconOption(opt.id)}
                    className={cn(
                      'py-2 px-1 rounded-lg border text-xs font-medium text-center transition-all',
                      iconOption === opt.id
                        ? 'border-sky-400/80 bg-sky-500/15 text-sky-400 font-semibold'
                        : 'border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/40',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 实时代码生成器面板 */}
        <div className="border-t border-border/60 bg-black/85 p-6 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-mono text-neutral-400">Component Usage Code</span>
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/15 hover:text-white transition-all"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  <span>Copy JSX</span>
                </>
              )}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-xl bg-black/60 p-4 font-mono text-xs text-sky-300/90 leading-relaxed border border-white/5">
            <code>{generatedCode}</code>
          </pre>
        </div>
      </div>

      {/* ─── 场景应用展示 1：VisionOS 悬浮控制胶囊 (Spatial Media Dock) ─── */}
      <section className="space-y-4">
        <div className="text-center max-w-xl mx-auto mb-6">
          <span className="text-xs uppercase tracking-widest text-sky-400 font-mono">
            Preset Scenario 1
          </span>
          <h3 className="text-2xl font-bold tracking-tight text-foreground mt-1">
            VisionOS 空间悬浮控制胶囊
          </h3>
          <p className="text-xs text-muted-foreground mt-1 text-balance">
            拟物空间计算胶囊交互，包含连续播放控制、音量与 AirPlay 悬浮玻璃组件。
          </p>
        </div>

        <div className="relative rounded-3xl border border-border/60 bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 p-10 flex flex-col items-center justify-center overflow-hidden shadow-xl min-h-[220px]">
          {/* 背景光斑 */}
          <div className="absolute -top-10 left-1/4 size-48 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 right-1/4 size-48 rounded-full bg-sky-500/20 blur-3xl pointer-events-none" />

          {/* 悬浮多媒体控制条 */}
          <div className="relative z-10 flex flex-wrap items-center gap-3 p-2 rounded-full border border-white/15 bg-white/10 backdrop-blur-2xl shadow-[0_16px_36px_-6px_rgba(0,0,0,0.6)]">
            <LiquidGlassButton
              variant="default"
              size="icon"
              shape="pill"
              aria-label="Previous track"
              onClick={() => {}}
            >
              <SkipBack className="size-4" />
            </LiquidGlassButton>

            <LiquidGlassButton
              variant="brand"
              size="default"
              shape="pill"
              glow
              onClick={() => setIsPlaying(!isPlaying)}
              icon={isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
            >
              {isPlaying ? 'Pause Track' : 'Play Spatial Audio'}
            </LiquidGlassButton>

            <LiquidGlassButton
              variant="default"
              size="icon"
              shape="pill"
              aria-label="Next track"
              onClick={() => {}}
            >
              <SkipForward className="size-4" />
            </LiquidGlassButton>

            <div className="h-6 w-[1px] bg-white/20 mx-1" />

            <LiquidGlassButton variant="ghost" size="icon" shape="pill" aria-label="Volume">
              <Volume2 className="size-4" />
            </LiquidGlassButton>
          </div>
        </div>
      </section>

      {/* ─── 场景应用展示 2：Apple Intelligence 灵动对话胶囊 ─── */}
      <section className="space-y-4">
        <div className="text-center max-w-xl mx-auto mb-6">
          <span className="text-xs uppercase tracking-widest text-purple-400 font-mono">
            Preset Scenario 2
          </span>
          <h3 className="text-2xl font-bold tracking-tight text-foreground mt-1">
            Apple Intelligence 虹光灵动胶囊
          </h3>
          <p className="text-xs text-muted-foreground mt-1 text-balance">
            采用虹彩色散边缘折射与持续流动微光，营造如同新一代 Siri 的灵动液态生命力。
          </p>
        </div>

        <div className="relative rounded-3xl border border-border/60 bg-gradient-to-br from-neutral-950 via-slate-950 to-neutral-950 p-10 flex flex-col items-center justify-center overflow-hidden shadow-xl min-h-[200px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.15),transparent_70%)] pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4">
            <LiquidGlassButton
              variant="rainbow"
              size="lg"
              shape="pill"
              shimmer
              glow
              icon={<Sparkles className="size-5 text-indigo-300" />}
              iconRight={<ArrowRight className="size-4 text-indigo-300" />}
            >
              Ask Apple Intelligence...
            </LiquidGlassButton>

            <LiquidGlassButton
              variant="accent"
              size="lg"
              shape="pill"
              glow
              icon={<Zap className="size-4 text-emerald-400" />}
            >
              Analyze Intent
            </LiquidGlassButton>
          </div>
        </div>
      </section>

      {/* ─── 场景应用展示 3：全变体色彩矩阵 (Variant Swatches Grid) ─── */}
      <section className="space-y-6">
        <div className="text-center max-w-xl mx-auto">
          <span className="text-xs uppercase tracking-widest text-emerald-400 font-mono">
            Preset Scenario 3
          </span>
          <h3 className="text-2xl font-bold tracking-tight text-foreground mt-1">
            全变体质感色卡矩阵
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            包含 10 种精工调校的拟物玻璃材质，自适应暗黑模式与明亮模式。
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {VARIANTS.map((item) => (
            <div
              key={item.id}
              className="group relative flex flex-col justify-between p-6 rounded-2xl border border-border/60 bg-card/40 backdrop-blur-md overflow-hidden hover:border-border transition-all"
            >
              {/* 背景装饰微光斑 */}
              <div
                className={cn(
                  'pointer-events-none absolute -right-6 -bottom-6 size-32 rounded-full blur-2xl opacity-15 transition-opacity group-hover:opacity-30',
                  item.color,
                )}
              />

              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-foreground">{item.label}</span>
                  <span className="text-[11px] font-mono text-muted-foreground uppercase">
                    {item.id}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>

              <div className="flex items-center justify-start pt-2">
                <LiquidGlassButton
                  variant={item.id}
                  size="default"
                  shape="pill"
                  glow={item.id === 'rainbow' || item.id === 'brand' || item.id === 'accent'}
                  icon={<Sparkles className="size-4" />}
                >
                  {item.label.split(' / ')[0]}
                </LiquidGlassButton>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── 场景应用展示 4：组件 API 规范与属性速查表 ─── */}
      <section className="rounded-3xl border border-border/70 bg-card/50 backdrop-blur-xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <span className="text-sky-400">⚡</span> Component API & Props
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              开箱即用的 TypeScript 接口规范与参数说明
            </p>
          </div>
          <span className="font-mono text-xs text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-md">
            liquid-glass-button.tsx
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground uppercase tracking-wider">
                <th className="py-2.5 px-3">Prop</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Default</th>
                <th className="py-2.5 px-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-foreground/90">
              <tr>
                <td className="py-2.5 px-3 font-semibold text-sky-400">variant</td>
                <td className="py-2.5 px-3 text-muted-foreground">
                  'default' | 'frosted' | 'brand' | 'accent' | 'blue' | 'purple' | 'obsidian' |
                  'rainbow' | 'destructive' | 'ghost'
                </td>
                <td className="py-2.5 px-3 text-amber-400">'default'</td>
                <td className="py-2.5 px-3 font-sans text-muted-foreground">玻璃材质与配色风格</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-sky-400">size</td>
                <td className="py-2.5 px-3 text-muted-foreground">
                  'xs' | 'sm' | 'default' | 'lg' | 'xl' | 'icon-sm' | 'icon' | 'icon-lg'
                </td>
                <td className="py-2.5 px-3 text-amber-400">'default'</td>
                <td className="py-2.5 px-3 font-sans text-muted-foreground">
                  尺寸规范（包含正方形/圆形图标按钮尺寸）
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-sky-400">shape</td>
                <td className="py-2.5 px-3 text-muted-foreground">
                  'pill' | 'squircle' | 'rounded'
                </td>
                <td className="py-2.5 px-3 text-amber-400">'pill'</td>
                <td className="py-2.5 px-3 font-sans text-muted-foreground">
                  胶囊圆角、iOS平滑方圆或适度圆角
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-sky-400">interactive</td>
                <td className="py-2.5 px-3 text-muted-foreground">boolean</td>
                <td className="py-2.5 px-3 text-amber-400">true</td>
                <td className="py-2.5 px-3 font-sans text-muted-foreground">
                  光标滑过时 3D 镜面聚光动态折射
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-sky-400">shimmer</td>
                <td className="py-2.5 px-3 text-muted-foreground">boolean</td>
                <td className="py-2.5 px-3 text-amber-400">false</td>
                <td className="py-2.5 px-3 font-sans text-muted-foreground">
                  持续微光液态流动折射波纹
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-sky-400">curvedBevel</td>
                <td className="py-2.5 px-3 text-muted-foreground">boolean</td>
                <td className="py-2.5 px-3 text-amber-400">true</td>
                <td className="py-2.5 px-3 font-sans text-muted-foreground">
                  顶部 1px 凸面透镜高光倒角反光线
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-sky-400">glow</td>
                <td className="py-2.5 px-3 text-muted-foreground">boolean</td>
                <td className="py-2.5 px-3 text-amber-400">false</td>
                <td className="py-2.5 px-3 font-sans text-muted-foreground">
                  背后彩色环境柔和光晕
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-sky-400">hapticScale</td>
                <td className="py-2.5 px-3 text-muted-foreground">boolean</td>
                <td className="py-2.5 px-3 text-amber-400">true</td>
                <td className="py-2.5 px-3 font-sans text-muted-foreground">
                  微物理弹性悬停浮起与按压阻尼动画
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-sky-400">href</td>
                <td className="py-2.5 px-3 text-muted-foreground">string</td>
                <td className="py-2.5 px-3 text-muted-foreground">undefined</td>
                <td className="py-2.5 px-3 font-sans text-muted-foreground">
                  传入时自动渲染为高可访问性链接标签 &lt;a&gt;
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-sky-400">loading</td>
                <td className="py-2.5 px-3 text-muted-foreground">boolean</td>
                <td className="py-2.5 px-3 text-amber-400">false</td>
                <td className="py-2.5 px-3 font-sans text-muted-foreground">
                  呈现平滑旋转的液态加载状态
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-sky-400">icon / iconRight</td>
                <td className="py-2.5 px-3 text-muted-foreground">React.ReactNode</td>
                <td className="py-2.5 px-3 text-muted-foreground">undefined</td>
                <td className="py-2.5 px-3 font-sans text-muted-foreground">
                  便捷的前置或后置图标插槽
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
