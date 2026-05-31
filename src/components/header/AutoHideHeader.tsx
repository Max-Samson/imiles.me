'use client';

import { MotionConfig, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import {
  getLocaleFromPathname,
  type Locale,
  localizePathname,
  stripLocaleFromPathname,
} from '@/lib/i18n';
import { MobileMenu } from './MobileMenu';
import { ModeToggle } from './ModeToggle';
import NavigationMenuDemo from './NavigationMenu';

type Props = {
  lang?: Locale;
  pathname?: string;
  children?: ReactNode;
};

export default function AutoHideHeader({ lang, pathname, children }: Props) {
  const { isVisible } = useScrollDirection();
  const resolvedPathname = pathname ?? '/';
  const resolvedLang = lang ?? getLocaleFromPathname(resolvedPathname);
  const alternateLocale: Locale = resolvedLang === 'zh' ? 'en' : 'zh';
  const languageToggleHref = localizePathname(
    stripLocaleFromPathname(resolvedPathname),
    alternateLocale,
  );
  const languageToggleLabel = alternateLocale === 'zh' ? '中文' : 'EN';

  return (
    <MotionConfig reducedMotion="user">
      <motion.header
        className="fixed top-0 left-0 right-0 z-header border-b border-border/40 bg-background/80 backdrop-blur-md"
        initial={{ y: 0 }}
        animate={{ y: isVisible ? 0 : '-100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <a
            href="/"
            className="text-xl font-semibold tracking-tight text-foreground"
            style={{
              fontFamily: 'Permanent Marker',
            }}
          >
            Miles
          </a>

          {/* Desktop nav */}
          <div className="hidden md:flex md:items-center md:gap-2">
            <NavigationMenuDemo lang={lang} pathname={pathname} />
          </div>

          {/* Desktop language switcher + theme toggle */}
          <div className="hidden md:flex md:items-center md:gap-2">
            {children}
            <ModeToggle />
          </div>

          {/* Mobile hamburger + theme toggle */}
          <div className="flex items-center gap-2 md:hidden">
            <a
              href={languageToggleHref}
              className="inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-border bg-background px-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              aria-label={`Switch language to ${alternateLocale === 'zh' ? 'Chinese' : 'English'}`}
            >
              {languageToggleLabel}
            </a>
            <ModeToggle />
            <MobileMenu lang={lang} pathname={pathname} />
          </div>
        </div>
      </motion.header>
    </MotionConfig>
  );
}
