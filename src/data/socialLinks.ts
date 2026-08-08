import { author } from './author';

/**
 * 社交链接条目(驱动页脚 / 关于页的社交图标)。
 * - title: 显示名
 * - href: 链接地址
 * - icon: 图标名,取值见下方枚举(github / linkedin / x / email / behance / arxiv / rss)
 * - target: 打开方式(如 '_blank' 新窗口,可选)
 */
export interface SocialLink {
  title: string;
  href: string;
  icon: 'github' | 'linkedin' | 'x' | 'email' | 'behance' | 'arxiv' | 'rss';
  target?: '_blank' | '_self' | '_parent' | '_top';
}

export const socialLinks: SocialLink[] = [
  {
    title: 'GitHub',
    href: author.social.github.url,
    target: '_blank',
    icon: 'github',
  },
  {
    title: 'X',
    href: author.social.x.url,
    target: '_blank',
    icon: 'x',
  },
  { title: 'RSS', href: '/rss.xml', target: '_blank', icon: 'rss' },
];
