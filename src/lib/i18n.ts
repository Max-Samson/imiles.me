import { en } from '@/locales/en';
import { zh } from '@/locales/zh';

export const defaultLocale = 'en' as const;
export const locales = ['en', 'zh'] as const;
export type Locale = (typeof locales)[number];

export const ui = { zh, en } as const;
export type TranslationKey = keyof typeof en;
export type TranslationParams = Record<string, string | number>;

// 判断一个值是否为项目支持的语言代码。
export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && locales.includes(value as Locale);
}

// 兜底解析语言，任何非法值都会回退到默认语言。
export function resolveLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : defaultLocale;
}

// 统一规范路径，确保总是返回以 / 开头的站内路径。
function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return normalized.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

// 一次性解析路径中的语言段，避免多个函数重复拆分 pathname。
function parsePathname(pathname: string): { locale: Locale; pathname: string } {
  const normalizedPathname = normalizePathname(pathname);
  const segments = normalizedPathname.split('/').filter(Boolean);
  const hasLocalePrefix = isLocale(segments[0]);
  const locale: Locale = hasLocalePrefix ? (segments[0] as Locale) : defaultLocale;
  const pathnameWithoutLocale = hasLocalePrefix
    ? `/${segments.slice(1).join('/')}` || '/'
    : normalizedPathname;

  return {
    locale,
    pathname: pathnameWithoutLocale === '' ? '/' : pathnameWithoutLocale,
  };
}

// 从路由路径中提取当前语言，例如 /zh/about -> zh。
export function getLocaleFromPathname(pathname: string): Locale {
  return parsePathname(pathname).locale;
}

// 移除路径中的语言前缀，方便做路由匹配与高亮判断。
export function stripLocaleFromPathname(pathname: string): string {
  return parsePathname(pathname).pathname;
}

// 根据目标语言生成本地化链接，默认语言不带前缀。
export function localizePathname(pathname: string, locale: Locale): string {
  const normalizedPath = stripLocaleFromPathname(pathname);
  if (locale === defaultLocale) return normalizedPath;
  return normalizedPath === '/' ? `/${locale}` : `/${locale}${normalizedPath}`;
}

export function getLocalizedAlternates(pathname: string): Record<Locale, string> {
  return Object.fromEntries(
    locales.map((locale) => [locale, localizePathname(pathname, locale)]),
  ) as Record<Locale, string>;
}

// 优先从 Astro、浏览器地址、HTML lang 中获取当前语言，保证全局可用。
export function getCurrentLocale(): Locale {
  const astroLocale = (globalThis as { Astro?: { currentLocale?: string } })?.Astro?.currentLocale;
  if (isLocale(astroLocale)) return astroLocale;
  if (typeof window !== 'undefined') return getLocaleFromPathname(window.location.pathname);
  if (typeof document !== 'undefined') return resolveLocale(document.documentElement.lang);
  return defaultLocale;
}

// 将 {name} 这类占位符替换成传入参数。
function formatMessage(template: string, params?: TranslationParams) {
  if (!params) return template;

  let result = template;
  Object.entries(params).forEach(([key, value]) => {
    result = result.replaceAll(`{${key}}`, String(value));
  });
  return result;
}

// 核心翻译函数，适用于 Astro/React/普通 TS 模块。
export function t(
  key: TranslationKey,
  params?: TranslationParams,
  lang: Locale = getCurrentLocale(),
) {
  const dictionary = ui[lang] ?? ui[defaultLocale];
  const message = (dictionary[key] ?? ui[defaultLocale][key]) as string;
  return formatMessage(message, params);
}

// 创建指定语言下的翻译器。
export function createTranslations(lang: Locale = getCurrentLocale()) {
  return {
    lang,
    t: (key: TranslationKey, params?: TranslationParams) => t(key, params, lang),
  };
}

// 为兼容现有 React 组件保留这个名字。
// 注意：它不是 React Hook，只是一个轻量翻译器工厂。
export function useTranslations(lang: Locale = getCurrentLocale()) {
  return createTranslations(lang);
}

export function getDateLocale(lang: Locale): string {
  return lang === 'zh' ? 'zh-CN' : 'en-US';
}

export function formatDate(
  date: Date,
  lang: Locale,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  },
) {
  return date.toLocaleDateString(getDateLocale(lang), options);
}
