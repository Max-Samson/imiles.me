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
  localizePathname,
  stripLocaleFromPathname,
  useTranslations,
  type Locale,
} from '@/lib/i18n';

export type NavItem = {
  href: string;
  matchPath: string;
  label: string;
};

export function getNavItems(lang: Locale): NavItem[] {
  const { t } = useTranslations(lang);

  return [
    {
      href: localizePathname('/', lang),
      matchPath: '/',
      label: t('Headerhome'),
    },
    {
      href: localizePathname('/blog', lang),
      matchPath: '/blog',
      label: t('Headerblog'),
    },
    {
      href: localizePathname('/stories', lang),
      matchPath: '/stories',
      label: t('Headerstories'),
    },
    {
      href: localizePathname('/research', lang),
      matchPath: '/research',
      label: t('Headerresearch'),
    },
    {
      href: localizePathname('/projects', lang),
      matchPath: '/projects',
      label: t('Headerprojects'),
    },
    {
      href: localizePathname('/about', lang),
      matchPath: '/about',
      label: t('Headerabout'),
    },
  ];
}

export function isNavItemActive(pathname: string, matchPath: string) {
  const normalizedPath = stripLocaleFromPathname(pathname);
  return matchPath === '/'
    ? normalizedPath === '/'
    : normalizedPath === matchPath ||
        normalizedPath.startsWith(`${matchPath}/`);
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
        {navItems.map((item) => (
          <NavigationMenuItem key={item.href}>
            <NavigationMenuLink
              href={item.href}
              className={navigationMenuTriggerStyle()}
              aria-current={
                isNavItemActive(resolvedPathname, item.matchPath)
                  ? 'page'
                  : undefined
              }
            >
              {item.label}
            </NavigationMenuLink>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  );
}
