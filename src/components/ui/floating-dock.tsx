'use client';

import type { MotionValue } from 'motion/react';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface FloatingDockItem {
  title: string;
  icon: React.ReactNode;
  href: string;
  target?: '_blank' | '_self' | '_parent' | '_top';
}

export const FloatingDock = ({
  items,
  desktopClassName,
  mobileClassName,
}: {
  items: FloatingDockItem[];
  desktopClassName?: string;
  mobileClassName?: string;
}) => {
  return (
    <>
      <FloatingDockDesktop items={items} className={desktopClassName} />
      <FloatingDockMobile items={items} className={mobileClassName} />
    </>
  );
};

const FloatingDockMobile = ({
  items,
  className,
}: {
  items: FloatingDockItem[];
  className?: string;
}) => {
  return (
    <div
      role="toolbar"
      aria-label="Floating dock mobile"
      className={cn(
        'mx-auto flex flex-nowrap items-center justify-center gap-2 rounded-2xl px-3 py-2 sm:hidden isolate',
        // 结合 NavigationMenu.tsx 苹果液态玻璃核心滤镜
        'backdrop-blur-2xl saturate-180',
        'bg-gradient-to-b from-white/80 via-white/55 to-white/70',
        'dark:bg-gradient-to-b dark:from-neutral-800/80 dark:via-neutral-900/60 dark:to-neutral-900/75',
        'border border-white/70 dark:border-white/15',
        'shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08),inset_0_1.5px_1px_0_rgba(255,255,255,0.95)]',
        'dark:shadow-[0_12px_32px_-4px_rgba(0,0,0,0.5),inset_0_1.5px_1px_0_rgba(255,255,255,0.22)]',
        className,
      )}
    >
      {items.map((item) => (
        <a
          key={item.title}
          href={item.href}
          target={item.target}
          rel={item.target === '_blank' ? 'noreferrer noopener' : undefined}
          aria-label={item.title}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/85 dark:bg-white/14 border border-white/80 dark:border-white/15 shadow-xs transition-all hover:scale-105 active:scale-95"
        >
          <div className="size-4 text-foreground">{item.icon}</div>
        </a>
      ))}
    </div>
  );
};

const FloatingDockDesktop = ({
  items,
  className,
}: {
  items: FloatingDockItem[];
  className?: string;
}) => {
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY);

  return (
    <motion.div
      role="toolbar"
      aria-label="Floating dock"
      onMouseMove={(e) => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(Number.POSITIVE_INFINITY)}
      className={cn(
        // 核心形态与悬浮定位 (在全屏及大于 sm 的窗口均呈现完整磁吸放大波纹)
        'relative mx-auto hidden sm:flex h-16 items-end gap-3 rounded-2xl px-4 pb-3 isolate',
        // 结合 NavigationMenu.tsx 苹果液态玻璃核心滤镜
        'backdrop-blur-2xl saturate-180',
        // 渐变半透明高质感液态底色
        'bg-gradient-to-b from-white/80 via-white/55 to-white/70',
        'dark:bg-gradient-to-b dark:from-neutral-800/80 dark:via-neutral-900/60 dark:to-neutral-900/75',
        // 半透明微折射双层边框
        'border border-white/70 dark:border-white/15',
        // 仿苹果双层边缘折射光与下沉柔和投影 (Fresnel Reflection & Specular Highlight)
        'shadow-[0_12px_32px_-4px_rgba(0,0,0,0.08),inset_0_1.5px_1px_0_rgba(255,255,255,0.95),inset_0_-1px_1px_0_rgba(0,0,0,0.03)]',
        'dark:shadow-[0_16px_36px_-4px_rgba(0,0,0,0.5),inset_0_1.5px_1px_0_rgba(255,255,255,0.22),inset_0_-1px_1px_0_rgba(0,0,0,0.4)]',
        'transition-colors duration-300',
        className,
      )}
    >
      {/* 顶层 1px 弧形镜面高光光泽（模拟苹果弧面玻璃倒角） */}
      <div
        className="pointer-events-none absolute inset-x-3 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/95 to-transparent dark:via-white/35"
        aria-hidden="true"
      />

      {items.map((item) => (
        <IconContainer mouseX={mouseX} key={item.title} {...item} />
      ))}
    </motion.div>
  );
};

function IconContainer({
  mouseX,
  title,
  icon,
  href,
  target,
}: {
  mouseX: MotionValue;
  title: string;
  icon: React.ReactNode;
  href: string;
  target?: '_blank' | '_self' | '_parent' | '_top';
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  // 关键计算：通过 clientX 与精确 boundingClientRect 距离映射，并使用 Spring 平滑放大
  const distance = useTransform(mouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const widthTransform = useTransform(distance, [-140, 0, 140], [40, 72, 40]);
  const heightTransform = useTransform(distance, [-140, 0, 140], [40, 72, 40]);
  const iconSizeTransform = useTransform(distance, [-140, 0, 140], [20, 36, 20]);

  const width = useSpring(widthTransform, {
    mass: 0.1,
    stiffness: 220,
    damping: 14,
  });
  const height = useSpring(heightTransform, {
    mass: 0.1,
    stiffness: 220,
    damping: 14,
  });
  const iconSize = useSpring(iconSizeTransform, {
    mass: 0.1,
    stiffness: 220,
    damping: 14,
  });

  const [hovered, setHovered] = useState(false);

  return (
    <motion.a
      ref={ref}
      href={href}
      target={target}
      rel={target === '_blank' ? 'noreferrer noopener' : undefined}
      aria-label={title}
      style={{ width, height }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className={cn(
        // 核心形态：作为 flex 子元素自适应弹性放大
        'relative flex shrink-0 aspect-square items-center justify-center rounded-full outline-none cursor-pointer',
        // 仿苹果微高光水银质感图标容器
        'bg-white/85 dark:bg-white/14',
        'border border-white/80 dark:border-white/15',
        'shadow-[0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)]',
        'dark:shadow-[0_2px_10px_rgba(0,0,0,0.4),inset_0_1px_0.5px_rgba(255,255,255,0.25)]',
        'transition-colors duration-150',
      )}
    >
      {/* 关键诊断修复：外层容器绝对居中锚定，内层 motion.div 仅处理透明度与微缩放，彻底消除 Tailwind 与 Motion 双重 -50% translateX 叠加导致的向左偏移 */}
      <AnimatePresence>
        {hovered && (
          <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 z-50">
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.92 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                'w-max rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-pre select-none shadow-lg',
                // 仿苹果微高光悬浮文字气泡
                'backdrop-blur-xl saturate-180',
                'bg-neutral-900/90 text-white dark:bg-white/95 dark:text-neutral-950',
                'border border-white/20 dark:border-black/10',
              )}
            >
              {title}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.div
        style={{ width: iconSize, height: iconSize }}
        className="flex items-center justify-center text-foreground"
      >
        {icon}
      </motion.div>
    </motion.a>
  );
}
