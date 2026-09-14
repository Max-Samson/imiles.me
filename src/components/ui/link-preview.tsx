'use client';

import * as HoverCardPrimitive from '@radix-ui/react-hover-card';
import { AnimatePresence, motion } from 'motion/react';
import { encode } from 'qss';
import React from 'react';
import { cn } from '@/lib/utils';

type LinkPreviewProps = {
  children: React.ReactNode;
  url: string;
  className?: string;
  width?: number;
  height?: number;
  quality?: number;
  layout?: string;
  triggerAsChild?: boolean;
} & ({ isStatic: true; imageSrc: string } | { isStatic?: false; imageSrc?: never });

export const LinkPreview = ({
  children,
  url,
  className,
  width = 220,
  height = 135,
  quality: _quality = 50,
  layout: _layout = 'fixed',
  triggerAsChild = false,
  isStatic = false,
  imageSrc = '',
}: LinkPreviewProps) => {
  let src: string;
  if (!isStatic) {
    const params = encode({
      url,
      screenshot: true,
      meta: false,
      embed: 'screenshot.url',
      colorScheme: 'dark',
      'viewport.isMobile': true,
      'viewport.deviceScaleFactor': 1,
      'viewport.width': width * 3,
      'viewport.height': height * 3,
    });
    src = `https://api.microlink.io/?${params}`;
  } else {
    src = imageSrc;
  }

  const [isOpen, setOpen] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <>
      {isMounted ? (
        <span className="hidden">
          <img src={src} width={width} height={height} loading="lazy" alt="" />
        </span>
      ) : null}

      <HoverCardPrimitive.Root
        openDelay={50}
        closeDelay={120}
        onOpenChange={(open) => {
          setOpen(open);
        }}
      >
        <HoverCardPrimitive.Trigger className={cn(className)} asChild={triggerAsChild} href={url}>
          {children}
        </HoverCardPrimitive.Trigger>

        {/* 关键诊断修复：通过 Portal 挂载到 body，彻底规避父容器 overflow-hidden 截断裁切问题 */}
        <HoverCardPrimitive.Portal>
          <HoverCardPrimitive.Content
            className="z-50 [transform-origin:var(--radix-hover-card-content-transform-origin)]"
            side="top"
            align="center"
            sideOffset={12}
          >
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.92 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: {
                      type: 'spring',
                      stiffness: 360,
                      damping: 24,
                    },
                  }}
                  exit={{ opacity: 0, y: 8, scale: 0.92, transition: { duration: 0.15 } }}
                  className={cn(
                    // 容器与圆角
                    'relative overflow-hidden rounded-2xl p-2 isolate',
                    // 结合 NavigationMenu.tsx 苹果液态玻璃核心滤镜
                    'backdrop-blur-2xl saturate-180',
                    // 渐变半透明玻璃底色
                    'bg-gradient-to-b from-white/85 via-white/60 to-white/75',
                    'dark:bg-gradient-to-b dark:from-neutral-800/80 dark:via-neutral-900/65 dark:to-neutral-900/80',
                    // 半透明微折射双层边框
                    'border border-white/70 dark:border-white/15',
                    // 仿苹果双层边缘折射光与下沉柔和投影
                    'shadow-[0_16px_36px_-6px_rgba(0,0,0,0.2),inset_0_1.5px_1px_0_rgba(255,255,255,0.95)]',
                    'dark:shadow-[0_20px_40px_-6px_rgba(0,0,0,0.7),inset_0_1.5px_1px_0_rgba(255,255,255,0.22)]',
                  )}
                >
                  {/* 顶层 1px 弧形镜面高光光泽（模拟苹果弧面玻璃倒角） */}
                  <div
                    className="pointer-events-none absolute inset-x-3 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/35"
                    aria-hidden="true"
                  />

                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl overflow-hidden shadow-xs"
                    style={{ fontSize: 0 }}
                  >
                    <img
                      src={isStatic ? imageSrc : src}
                      width={width}
                      height={height}
                      loading="lazy"
                      className="rounded-xl object-cover"
                      alt={`Preview of ${url}`}
                    />
                  </a>
                </motion.div>
              )}
            </AnimatePresence>
          </HoverCardPrimitive.Content>
        </HoverCardPrimitive.Portal>
      </HoverCardPrimitive.Root>
    </>
  );
};
