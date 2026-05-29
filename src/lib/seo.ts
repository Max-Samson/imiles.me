import { socialLinks } from '@/data/socialLinks';
import { type Locale, localizePathname } from '@/lib/i18n';

export const siteName = 'imiles.me';
export const authorName = 'Miles';
export const siteUrl = 'https://imiles.me';

const sameAs = socialLinks.map((link) => link.href).filter((href) => href.startsWith('http'));

export const siteSchemas = {
  person: {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: authorName,
    url: siteUrl,
    sameAs,
  },
  website: {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    url: siteUrl,
    inLanguage: ['en', 'zh-CN'],
    publisher: {
      '@type': 'Person',
      name: authorName,
    },
  },
};

export function getHomeDescription(locale: Locale): string {
  return locale === 'zh'
    ? 'Miles 的双语技术博客与数字花园，记录前端工程、AI、全栈实践、项目复盘、研究随笔与长期思考。'
    : "Miles's bilingual tech blog and digital garden on frontend engineering, AI, full-stack building, project breakdowns, research notes, and long-form thinking.";
}

export function getSectionDescription(section: string, locale: Locale): string {
  const descriptions = {
    about:
      locale === 'zh'
        ? '了解 Miles 的技术背景、正在构建的方向，以及这本双语技术博客背后的写作与创作脉络。'
        : "Learn about Miles's technical background, current focus, and the writing practice behind this bilingual engineering blog.",
    blog:
      locale === 'zh'
        ? '阅读 Miles 的中英双语博客文章，主题涵盖前端工程、AI、全栈开发、批判性思维与项目实践。'
        : "Read Miles's bilingual blog posts on frontend engineering, AI, full-stack development, critical thinking, and real project work.",
    stories:
      locale === 'zh'
        ? '浏览 Miles 的短篇故事与叙事实验，记录技术之外的观察、情绪与想象。'
        : "Browse Miles's short stories and narrative experiments alongside the technical side of the site.",
    notes:
      locale === 'zh'
        ? '查看 Miles 的日常记录、碎片想法与轻量更新，作为博客之外的个人数字花园。'
        : "Explore Miles's lighter notes, daily logs, and in-progress thoughts as part of his personal digital garden.",
    projects:
      locale === 'zh'
        ? '查看 Miles 正在构建和已经发布的软件项目，包含产品思路、功能亮点与技术栈。'
        : 'Explore software projects Miles has built, including product context, feature highlights, and implementation details.',
    research:
      locale === 'zh'
        ? '整理 Miles 的研究项目、论文与方法论笔记，连接工程实践与系统性思考。'
        : "Find Miles's research work, papers, and method notes connecting engineering practice with deeper inquiry.",
  } as const;

  return descriptions[section as keyof typeof descriptions] ?? getHomeDescription(locale);
}

export function getPageTitle(section: string, locale: Locale): string {
  const titles = {
    home: locale === 'zh' ? 'Miles 的技术博客与数字花园' : "Miles's Tech Blog and Digital Garden",
    about: locale === 'zh' ? '关于 Miles' : 'About Miles',
    blog: locale === 'zh' ? '博客' : 'Blog',
    stories: locale === 'zh' ? '故事' : 'Stories',
    notes: locale === 'zh' ? '日常' : 'Notes',
    projects: locale === 'zh' ? '项目' : 'Projects',
    research: locale === 'zh' ? '研究' : 'Research',
  } as const;

  return titles[section as keyof typeof titles] ?? siteName;
}

export function getAbsoluteUrl(pathname: string): string {
  return new URL(pathname, siteUrl).toString();
}

export function getLocalizedArticleUrl(slug: string, locale: Locale): string {
  return getAbsoluteUrl(localizePathname(`/blog/${slug}`, locale));
}
