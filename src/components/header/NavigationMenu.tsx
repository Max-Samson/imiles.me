'use client';

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
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

  // 从配置自动 map 生成
  const items = NAV_CONFIG.map((item) => ({
    href: localizePathname(item.path, lang),
    matchPath: item.path,
    label: t(item.key),
    only: 'only' in item ? (item.only as unknown as Locale) : undefined,
  })).filter((item) => {
    if (item.only && !item.only.includes(lang as Locale)) return false;
    return true;
  });

  return items;
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

  return (
    <NavigationMenu viewport={false}>
      <NavigationMenuList className="gap-2">
        {navItems.map((item) => {
          const isActive = isNavItemActive(resolvedPathname, item.matchPath);

          return (
            <NavigationMenuItem key={item.href}>
              <NavigationMenuLink
                href={item.href}
                className={cn(
                  navigationMenuTriggerStyle(),
                  isActive && 'bg-accent text-accent-foreground hover:bg-accent focus:bg-accent',
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.label}
              </NavigationMenuLink>
            </NavigationMenuItem>
          );
        })}
      </NavigationMenuList>
    </NavigationMenu>
  );
}
