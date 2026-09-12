'use client';

import { Compass } from 'lucide-react';
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import {
  getLocaleFromPathname,
  type Locale,
  localizePathname,
  stripLocaleFromPathname,
  useTranslations,
} from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type NavItem = {
  href: string;
  matchPath: string;
  label: string;
  only?: Locale;
};

const NAV_CONFIG = [
  { key: 'Headerhome', path: '/' },
  { key: 'Headerblog', path: '/blog' },
  { key: 'Headerstories', path: '/stories' },
  { key: 'Headerprojects', path: '/projects' },
  { key: 'Headernotes', path: '/notes' },
  { key: 'Headerabout', path: '/about' },
] as const;

export function getNavItems(lang: Locale): NavItem[] {
  const { t } = useTranslations(lang);

  return NAV_CONFIG.map((item) => ({
    href: localizePathname(item.path, lang),
    matchPath: item.path,
    label: t(item.key),
    only: 'only' in item ? (item.only as unknown as Locale) : undefined,
  })).filter((item) => {
    if (item.only && !item.only.includes(lang as Locale)) return false;
    return true;
  });
}

export function isNavItemActive(pathname: string, matchPath: string) {
  const normalizedPath = stripLocaleFromPathname(pathname);
  return matchPath === '/'
    ? normalizedPath === '/'
    : normalizedPath === matchPath || normalizedPath.startsWith(`${matchPath}/`);
}

type Props = {
  lang?: Locale;
  pathname?: string;
};

export default function NavigationMenuDemo({ lang, pathname }: Props) {
  const resolvedPathname =
    pathname ?? (typeof window === 'undefined' ? '/' : window.location.pathname);
  const resolvedLang = lang ?? getLocaleFromPathname(resolvedPathname);
  const navItems = getNavItems(resolvedLang);
  const { t } = useTranslations(resolvedLang);

  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);
  const collapseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevPathRef = useRef(resolvedPathname);

  // 获取当前激活的导航项
  const activeItem =
    navItems.find((item) => isNavItemActive(resolvedPathname, item.matchPath)) ?? navItems[0];

  const handleMouseEnter = () => {
    clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = null;
    setIsExpanded(true);
  };

  const handleMouseLeave = () => {
    clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = setTimeout(() => {
      setIsExpanded(false);
      setHoveredHref(null);
    }, 280);
  };

  useEffect(() => {
    return () => {
      clearTimeout(collapseTimerRef.current);
    };
  }, []);

  // 路由跳转后立即折叠
  useEffect(() => {
    if (prevPathRef.current !== resolvedPathname) {
      prevPathRef.current = resolvedPathname;
      setIsExpanded(false);
      setHoveredHref(null);
    }
  }, [resolvedPathname]);

  return (
    <MotionConfig reducedMotion="user">
      <nav
        className="relative z-20 flex items-center justify-end select-none"
        aria-label={t('HomeNavigation') || 'Main navigation'}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocusCapture={handleMouseEnter}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setIsExpanded(false);
            setHoveredHref(null);
          }
        }}
      >
        <motion.div
          layout
          transition={{
            type: 'spring',
            stiffness: 350,
            damping: 28,
            mass: 0.8,
          }}
          className={cn(
            // 基础尺寸与形状
            'relative flex h-9 items-center overflow-hidden rounded-full',
            // 苹果液态玻璃核心滤镜
            'backdrop-blur-2xl saturate-180',
            // 渐变液态半透明背景
            'bg-gradient-to-b from-white/75 via-white/50 to-white/65',
            'dark:bg-gradient-to-b dark:from-neutral-800/70 dark:via-neutral-900/50 dark:to-neutral-900/65',
            // 细微半透明折射边框
            'border border-white/60 dark:border-white/12',
            // 仿苹果双层边缘折射光与下沉柔和投影 (Fresnel Reflection & Specular Highlight)
            'shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08),inset_0_1.5px_1px_0_rgba(255,255,255,0.95),inset_0_-1px_1px_0_rgba(0,0,0,0.03)]',
            'dark:shadow-[0_12px_32px_-4px_rgba(0,0,0,0.5),inset_0_1.5px_1px_0_rgba(255,255,255,0.22),inset_0_-1px_1px_0_rgba(0,0,0,0.4)]',
            'transition-colors duration-300',
          )}
        >
          {/* 顶层 1px 弧形镜面高光光泽（模拟苹果弧面玻璃倒角） */}
          <div
            className="pointer-events-none absolute inset-x-3 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/35"
            aria-hidden="true"
          />

          <LayoutGroup id="header-nav-liquid">
            <AnimatePresence mode="popLayout" initial={false}>
              {!isExpanded ? (
                // 默认收起态：精致的液态玻璃胶囊状态按钮
                <motion.div
                  key="collapsed-capsule"
                  initial={{ opacity: 0, filter: 'blur(4px)', scale: 0.92 }}
                  animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
                  exit={{ opacity: 0, filter: 'blur(4px)', scale: 0.92 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="group flex h-full cursor-pointer items-center gap-2 px-3.5"
                >
                  {/* 液态活体呼吸灯 */}
                  <span className="relative flex h-2 w-2 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 dark:bg-emerald-300" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                  </span>

                  <span className="text-xs font-medium tracking-tight text-neutral-800 dark:text-neutral-200">
                    {activeItem?.label || t('Headerhome')}
                  </span>

                  <Compass
                    size={13}
                    className="text-neutral-500/80 transition-transform duration-300 group-hover:rotate-45 group-hover:text-neutral-900 dark:text-neutral-400 dark:group-hover:text-white"
                  />
                </motion.div>
              ) : (
                // Hover 展开态：连续展开的液态玻璃导航条
                <motion.div
                  key="expanded-capsule"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="flex h-full items-center gap-0.5 px-1.5 py-1"
                >
                  {/* 左侧引导罗盘微标 */}
                  <span
                    className="flex h-6 w-6 items-center justify-center pl-1 text-neutral-400/80 dark:text-neutral-500"
                    aria-hidden="true"
                  >
                    <Compass size={13} className="animate-spin-slow" />
                  </span>

                  {/* 导航项列表 */}
                  {navItems.map((item, index) => {
                    const isActive = isNavItemActive(resolvedPathname, item.matchPath);
                    const isHovered = hoveredHref === item.href;

                    return (
                      <motion.a
                        key={item.href}
                        href={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        onMouseEnter={() => setHoveredHref(item.href)}
                        initial={{ opacity: 0, x: -6, filter: 'blur(3px)' }}
                        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                        transition={{
                          delay: index * 0.02,
                          duration: 0.24,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        className={cn(
                          'relative z-10 flex h-7 items-center rounded-full px-2.5 text-xs font-medium tracking-tight',
                          'transition-colors duration-150 whitespace-nowrap select-none',
                          isActive
                            ? 'text-neutral-950 dark:text-white font-medium'
                            : 'text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white',
                        )}
                      >
                        {/* 液态水滴背景高光滑块：在项之间平滑流动 */}
                        {isActive && (
                          <motion.span
                            layoutId="liquid-active-pill"
                            transition={{
                              type: 'spring',
                              stiffness: 450,
                              damping: 32,
                            }}
                            className={cn(
                              'absolute inset-0 -z-10 rounded-full',
                              // 苹果微高光水银质感
                              'bg-white/85 dark:bg-white/16',
                              'border border-white/80 dark:border-white/15',
                              'shadow-[0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)]',
                              'dark:shadow-[0_2px_10px_rgba(0,0,0,0.4),inset_0_1px_0.5px_rgba(255,255,255,0.25)]',
                            )}
                          />
                        )}

                        {/* 非激活项的悬停液态微光浮岛 */}
                        {!isActive && isHovered && (
                          <motion.span
                            layoutId="liquid-hover-pill"
                            transition={{
                              type: 'spring',
                              stiffness: 450,
                              damping: 32,
                            }}
                            className="absolute inset-0 -z-10 rounded-full bg-white/45 dark:bg-white/8"
                          />
                        )}

                        <span>{item.label}</span>
                      </motion.a>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </LayoutGroup>
        </motion.div>
      </nav>
    </MotionConfig>
  );
}
