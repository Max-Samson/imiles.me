'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { type HTMLMotionProps, motion } from 'motion/react';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const liquidGlassVariants = cva(
  [
    // 基础布局与交互
    'group relative inline-flex items-center justify-center font-medium select-none cursor-pointer',
    'overflow-hidden isolate',
    'transition-all duration-300 ease-out',
    // 聚焦轮廓与可访问性
    'outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    // 禁用态
    'disabled:pointer-events-none disabled:opacity-45 disabled:cursor-not-allowed',
    // 苹果液态玻璃核心光学滤镜：高斯模糊与色彩微增益
    'backdrop-blur-2xl backdrop-saturate-[1.8]',
    // 图标排版规范
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        // 1. 经典透明水晶液态玻璃 (Apple VisionOS 默认极简质感)
        default: [
          'text-neutral-800 dark:text-neutral-100',
          'bg-gradient-to-b from-white/75 via-white/45 to-white/60 dark:from-white/12 dark:via-white/5 dark:to-white/8',
          'border border-white/70 dark:border-white/15',
          'shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08),inset_0_1.5px_1px_0_rgba(255,255,255,0.95),inset_0_-1px_1px_0_rgba(0,0,0,0.04)]',
          'dark:shadow-[0_12px_32px_-4px_rgba(0,0,0,0.5),inset_0_1.5px_1px_0_rgba(255,255,255,0.25),inset_0_-1px_1px_0_rgba(0,0,0,0.4)]',
          'hover:border-white/90 dark:hover:border-white/25',
          'hover:bg-gradient-to-b hover:from-white/85 hover:via-white/55 hover:to-white/70 dark:hover:from-white/16 dark:hover:via-white/8 dark:hover:to-white/12',
        ],
        // 2. 浓郁磨砂乳白玻璃 (极高漫反射与柔光遮罩)
        frosted: [
          'text-neutral-900 dark:text-neutral-100',
          'bg-white/85 dark:bg-neutral-900/75',
          'backdrop-blur-3xl backdrop-saturate-200',
          'border border-white/80 dark:border-white/20',
          'shadow-[0_10px_30px_-6px_rgba(0,0,0,0.1),inset_0_1.5px_1.5px_0_rgba(255,255,255,1),inset_0_-1px_2px_0_rgba(0,0,0,0.06)]',
          'dark:shadow-[0_14px_36px_-6px_rgba(0,0,0,0.6),inset_0_1.5px_1.5px_0_rgba(255,255,255,0.3),inset_0_-1px_2px_0_rgba(0,0,0,0.6)]',
          'hover:bg-white/95 dark:hover:bg-neutral-900/85',
        ],
        // 3. 网站品牌金 / 琥珀蜜蜡液态玻璃 (Tajik Gold 品牌色)
        brand: [
          'text-amber-950 dark:text-amber-100',
          'bg-gradient-to-b from-amber-200/55 via-amber-400/20 to-amber-300/35 dark:from-amber-400/20 dark:via-amber-500/10 dark:to-amber-400/15',
          'border border-amber-300/60 dark:border-amber-400/30',
          'shadow-[0_8px_24px_-4px_rgba(245,158,11,0.2),inset_0_1.5px_1px_0_rgba(255,255,255,0.9),inset_0_-1px_1px_0_rgba(180,83,9,0.15)]',
          'dark:shadow-[0_12px_32px_-4px_rgba(245,158,11,0.35),inset_0_1.5px_1px_0_rgba(255,255,255,0.35),inset_0_-1px_1px_0_rgba(0,0,0,0.4)]',
          'hover:border-amber-300/80 dark:hover:border-amber-400/50',
          'hover:bg-gradient-to-b hover:from-amber-200/65 hover:via-amber-400/28 hover:to-amber-300/45 dark:hover:from-amber-400/26 dark:hover:via-amber-500/14 dark:hover:to-amber-400/20',
        ],
        // 4. 灵动祖母绿 / Apple Intelligence 翡翠液态玻璃 (Tajik Green 品牌次色)
        accent: [
          'text-emerald-950 dark:text-emerald-100',
          'bg-gradient-to-b from-emerald-200/55 via-emerald-400/20 to-emerald-300/35 dark:from-emerald-400/20 dark:via-emerald-500/10 dark:to-emerald-400/15',
          'border border-emerald-300/60 dark:border-emerald-400/30',
          'shadow-[0_8px_24px_-4px_rgba(16,185,129,0.2),inset_0_1.5px_1px_0_rgba(255,255,255,0.9),inset_0_-1px_1px_0_rgba(4,120,87,0.15)]',
          'dark:shadow-[0_12px_32px_-4px_rgba(16,185,129,0.35),inset_0_1.5px_1px_0_rgba(255,255,255,0.35),inset_0_-1px_1px_0_rgba(0,0,0,0.4)]',
          'hover:border-emerald-300/80 dark:hover:border-emerald-400/50',
          'hover:bg-gradient-to-b hover:from-emerald-200/65 hover:via-emerald-400/28 hover:to-emerald-300/45 dark:hover:from-emerald-400/26 dark:hover:via-emerald-500/14 dark:hover:to-emerald-400/20',
        ],
        // 5. 电光蔚蓝 / VisionOS 空间宝石蓝玻璃
        blue: [
          'text-sky-950 dark:text-sky-100',
          'bg-gradient-to-b from-sky-200/55 via-sky-400/20 to-sky-300/35 dark:from-sky-400/20 dark:via-sky-500/10 dark:to-sky-400/15',
          'border border-sky-300/60 dark:border-sky-400/30',
          'shadow-[0_8px_24px_-4px_rgba(14,165,233,0.2),inset_0_1.5px_1px_0_rgba(255,255,255,0.9),inset_0_-1px_1px_0_rgba(2,132,199,0.15)]',
          'dark:shadow-[0_12px_32px_-4px_rgba(14,165,233,0.35),inset_0_1.5px_1px_0_rgba(255,255,255,0.35),inset_0_-1px_1px_0_rgba(0,0,0,0.4)]',
          'hover:border-sky-300/80 dark:hover:border-sky-400/50',
          'hover:bg-gradient-to-b hover:from-sky-200/65 hover:via-sky-400/28 hover:to-sky-300/45 dark:hover:from-sky-400/26 dark:hover:via-sky-500/14 dark:hover:to-sky-400/20',
        ],
        // 6. 幻彩紫晶 / VisionOS 赛博紫光玻璃
        purple: [
          'text-purple-950 dark:text-purple-100',
          'bg-gradient-to-b from-purple-200/55 via-purple-400/20 to-purple-300/35 dark:from-purple-400/20 dark:via-purple-500/10 dark:to-purple-400/15',
          'border border-purple-300/60 dark:border-purple-400/30',
          'shadow-[0_8px_24px_-4px_rgba(168,85,247,0.2),inset_0_1.5px_1px_0_rgba(255,255,255,0.9),inset_0_-1px_1px_0_rgba(126,34,206,0.15)]',
          'dark:shadow-[0_12px_32px_-4px_rgba(168,85,247,0.35),inset_0_1.5px_1px_0_rgba(255,255,255,0.35),inset_0_-1px_1px_0_rgba(0,0,0,0.4)]',
          'hover:border-purple-300/80 dark:hover:border-purple-400/50',
          'hover:bg-gradient-to-b hover:from-purple-200/65 hover:via-purple-400/28 hover:to-purple-300/45 dark:hover:from-purple-400/26 dark:hover:via-purple-500/14 dark:hover:to-purple-400/20',
        ],
        // 7. 熏黑黑曜石 / 暗夜深邃液态玻璃
        obsidian: [
          'text-neutral-100',
          'bg-neutral-950/65 dark:bg-black/75',
          'border border-white/12 dark:border-white/15',
          'shadow-[0_12px_32px_-4px_rgba(0,0,0,0.6),inset_0_1.5px_1px_0_rgba(255,255,255,0.2),inset_0_-1px_1px_0_rgba(0,0,0,0.7)]',
          'hover:border-white/25 hover:bg-neutral-950/75 dark:hover:bg-black/85',
        ],
        // 8. 虹彩流光 / 色散棱镜边缘玻璃 (Apple Intelligence 虹光溢彩)
        rainbow: [
          'text-neutral-900 dark:text-neutral-100',
          'bg-gradient-to-b from-white/70 via-white/40 to-white/60 dark:from-white/10 dark:via-white/5 dark:to-white/8',
          'border border-white/40 dark:border-white/10',
          'shadow-[0_8px_30px_-4px_rgba(124,58,237,0.25),inset_0_1.5px_1px_0_rgba(255,255,255,0.9)]',
          'dark:shadow-[0_12px_36px_-4px_rgba(124,58,237,0.4),inset_0_1.5px_1px_0_rgba(255,255,255,0.25)]',
          'hover:border-transparent',
        ],
        // 9. 警示红宝石 / 绯红液态玻璃
        destructive: [
          'text-rose-950 dark:text-rose-100',
          'bg-gradient-to-b from-rose-200/55 via-rose-400/20 to-rose-300/35 dark:from-rose-500/20 dark:via-rose-600/10 dark:to-rose-500/15',
          'border border-rose-300/60 dark:border-rose-400/30',
          'shadow-[0_8px_24px_-4px_rgba(244,63,94,0.2),inset_0_1.5px_1px_0_rgba(255,255,255,0.9),inset_0_-1px_1px_0_rgba(190,18,60,0.15)]',
          'dark:shadow-[0_12px_32px_-4px_rgba(244,63,94,0.35),inset_0_1.5px_1px_0_rgba(255,255,255,0.35),inset_0_-1px_1px_0_rgba(0,0,0,0.4)]',
          'hover:border-rose-300/80 dark:hover:border-rose-400/50',
          'hover:bg-gradient-to-b hover:from-rose-200/65 hover:via-rose-400/28 hover:to-rose-300/45 dark:hover:from-rose-500/26 dark:hover:via-rose-600/14 dark:hover:to-rose-500/20',
        ],
        // 10. 极简幽灵玻璃 (平时近乎隐形，悬停时凝结显形)
        ghost: [
          'text-neutral-700 dark:text-neutral-200',
          'bg-transparent border border-transparent',
          'hover:bg-gradient-to-b hover:from-white/70 hover:via-white/40 hover:to-white/55 dark:hover:from-white/10 dark:hover:via-white/5 dark:hover:to-white/8',
          'hover:border-white/60 dark:hover:border-white/15',
          'hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.06),inset_0_1.5px_1px_0_rgba(255,255,255,0.85)]',
          'dark:hover:shadow-[0_12px_32px_-4px_rgba(0,0,0,0.4),inset_0_1.5px_1px_0_rgba(255,255,255,0.2)]',
        ],
      },
      size: {
        xs: 'h-7 px-3 text-xs gap-1.5 [&_svg:not([class*="size-"])]:size-3.5',
        sm: 'h-8 px-3.5 text-xs gap-2 [&_svg:not([class*="size-"])]:size-3.5',
        default: 'h-10 px-5 text-sm gap-2.5 [&_svg:not([class*="size-"])]:size-4',
        lg: 'h-12 px-7 text-base gap-3 [&_svg:not([class*="size-"])]:size-5',
        xl: 'h-14 px-9 text-lg gap-3.5 [&_svg:not([class*="size-"])]:size-6',
        'icon-sm': 'size-8 p-0 [&_svg:not([class*="size-"])]:size-4',
        icon: 'size-10 p-0 [&_svg:not([class*="size-"])]:size-5',
        'icon-lg': 'size-12 p-0 [&_svg:not([class*="size-"])]:size-6',
      },
      shape: {
        pill: 'rounded-full',
        squircle: 'rounded-2xl',
        rounded: 'rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      shape: 'pill',
    },
  },
);

export type LiquidGlassVariants = VariantProps<typeof liquidGlassVariants>;

export interface LiquidGlassBaseProps extends LiquidGlassVariants {
  /** 自定义类名 */
  className?: string;
  /** 子元素内容 */
  children?: React.ReactNode;
  /** 前置图标 */
  icon?: React.ReactNode;
  /** 后置图标 */
  iconRight?: React.ReactNode;
  /** 是否开启光标动态折射镜面高光 (跟随鼠标滑动呈现弧面反光，默认开启) */
  interactive?: boolean;
  /** 是否开启持续微光流线动画 (流动液态质感) */
  shimmer?: boolean;
  /** 是否显示弧面边缘倒角高光反光线 (模拟真实凸透镜高光，默认开启) */
  curvedBevel?: boolean;
  /** 是否开启背后彩色漫射光晕 (Ambient Aura) */
  glow?: boolean;
  /** 自定义漫射光晕背景颜色 (CSS color / gradient) */
  glowColor?: string;
  /** 是否开启弹性微物理回弹与按压反馈 (默认开启) */
  hapticScale?: boolean;
  /** 加载状态 */
  loading?: boolean;
  /** 禁用状态 */
  disabled?: boolean;
}

export type LiquidGlassButtonProps = LiquidGlassBaseProps &
  (
    | ({ href: string } & Omit<
        React.AnchorHTMLAttributes<HTMLAnchorElement>,
        keyof LiquidGlassBaseProps | 'href'
      >)
    | ({ href?: undefined } & Omit<
        React.ButtonHTMLAttributes<HTMLButtonElement>,
        keyof LiquidGlassBaseProps | 'href'
      >)
  );

/**
 * LiquidGlassButton — 苹果风格液态玻璃按钮组件
 *
 * 融合 VisionOS 空间悬浮美学与 Apple Intelligence 拟物折射质感：
 * - 24px 双层高斯背景模糊 + 180% 色彩增益
 * - 光标驱动的 3D 镜面微弧动态聚光折射 (Fresnel Spotlight)
 * - 顶部 1px 倒角凸面镜面高光反射线
 * - 物理弹性微震按压阻尼动画
 * - 支持多种拟物玻璃材质与颜色变体 (水晶/磨砂/品牌金/翠绿/电光蓝/黑曜石/虹彩流光等)
 */
export const LiquidGlassButton = React.forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  LiquidGlassButtonProps
>(function LiquidGlassButton(
  {
    className,
    variant = 'default',
    size = 'default',
    shape = 'pill',
    children,
    icon,
    iconRight,
    interactive = true,
    shimmer = false,
    curvedBevel = true,
    glow = false,
    glowColor,
    hapticScale = true,
    loading = false,
    disabled = false,
    href,
    ...props
  },
  ref,
) {
  const [mousePos, setMousePos] = React.useState<{ x: number; y: number } | null>(null);
  const [isHovered, setIsHovered] = React.useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!interactive || disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    if (disabled) return;
    setIsHovered(true);
    handleMouseMove(e);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setMousePos(null);
  };

  // 动画弹性配置
  const springAnimation =
    hapticScale && !disabled
      ? {
          whileHover: { scale: 1.025, y: -1 },
          whileTap: { scale: 0.965, y: 0.5 },
          transition: {
            type: 'spring' as const,
            stiffness: 420,
            damping: 24,
            mass: 0.8,
          },
        }
      : {};

  // 彩虹变体专用柔和虹光漫射配置
  const isRainbow = variant === 'rainbow';

  const content = (
    <>
      {/* 1. 背后环境漫射光晕 (Ambient Back Glow) */}
      {(glow || isRainbow) && (
        <span
          className={cn(
            'pointer-events-none absolute -inset-1.5 -z-20 rounded-[inherit] opacity-35 blur-lg transition-opacity duration-300',
            isHovered && 'opacity-70',
            isRainbow &&
              'bg-gradient-to-r from-pink-500/40 via-indigo-500/40 to-emerald-500/40 opacity-40 blur-md',
          )}
          style={glowColor ? { background: glowColor } : undefined}
          aria-hidden="true"
        />
      )}

      {/* 2. 虹彩流光专用彩虹渐变边框层 */}
      {isRainbow && (
        <span
          className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] p-[1.5px] bg-gradient-to-r from-pink-500/80 via-sky-400/80 to-emerald-400/80 [mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] [mask-composite:exclude]"
          aria-hidden="true"
        />
      )}

      {/* 3. 顶部 1px 弧面镜面倒角高光 (模拟凸面透镜反光) */}
      {curvedBevel && (
        <span
          className="pointer-events-none absolute inset-x-3 top-0 z-20 h-[1px] bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/35"
          aria-hidden="true"
        />
      )}

      {/* 4. 底部微弱折射光线 */}
      {curvedBevel && (
        <span
          className="pointer-events-none absolute inset-x-5 bottom-0 z-20 h-[1px] bg-gradient-to-r from-transparent via-white/25 to-transparent dark:via-white/10"
          aria-hidden="true"
        />
      )}

      {/* 5. 动态光标聚光折射 (Fresnel Spotlight) */}
      {interactive && mousePos && (
        <motion.span
          className="pointer-events-none absolute -inset-px z-10 transition-opacity duration-200"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          style={{
            background: `radial-gradient(110px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255, 255, 255, 0.38), transparent 75%)`,
          }}
          aria-hidden="true"
        />
      )}

      {/* 6. 持续微光液态流动动画 (Shimmer wave) */}
      {shimmer && (
        <motion.span
          className="pointer-events-none absolute inset-y-0 w-1/2 -z-5 bg-gradient-to-r from-transparent via-white/30 to-transparent dark:via-white/15 -skew-x-12"
          initial={{ x: '-150%' }}
          animate={{ x: '350%' }}
          transition={{
            repeat: Number.POSITIVE_INFINITY,
            duration: 2.8,
            ease: 'easeInOut',
            repeatDelay: 1,
          }}
          aria-hidden="true"
        />
      )}

      {/* 7. 主体内容与图标 */}
      <span className="relative z-20 inline-flex items-center justify-center gap-[inherit]">
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="size-4 animate-spin text-current opacity-80"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {children && <span className="opacity-80">{children}</span>}
          </span>
        ) : (
          <>
            {icon && <span className="inline-flex shrink-0">{icon}</span>}
            {children && <span>{children}</span>}
            {iconRight && (
              <span className="inline-flex shrink-0 transition-transform duration-200 group-hover:translate-x-0.5">
                {iconRight}
              </span>
            )}
          </>
        )}
      </span>
    </>
  );

  const combinedClassName = cn(
    liquidGlassVariants({ variant, size, shape }),
    disabled && 'opacity-45 pointer-events-none cursor-not-allowed',
    className,
  );

  if (href) {
    const anchorProps = props as React.AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <motion.a
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        className={combinedClassName}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-disabled={disabled}
        {...springAnimation}
        {...(anchorProps as unknown as HTMLMotionProps<'a'>)}
      >
        {content}
      </motion.a>
    );
  }

  const buttonProps = props as React.ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <motion.button
      ref={ref as React.Ref<HTMLButtonElement>}
      type={buttonProps.type || 'button'}
      disabled={disabled || loading}
      className={combinedClassName}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...springAnimation}
      {...(buttonProps as unknown as HTMLMotionProps<'button'>)}
    >
      {content}
    </motion.button>
  );
});

LiquidGlassButton.displayName = 'LiquidGlassButton';

// 导出别名方便引用
export const LiquidButton = LiquidGlassButton;
