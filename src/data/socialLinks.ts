import { author } from './author';

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
  // {
  //   title: 'LinkedIn',
  //   href: 'https://linkedin.com/in/urmzd',
  //   icon: 'linkedin',
  // },
  {
    title: 'X',
    href: author.social.x.url,
    target: '_blank',
    icon: 'x',
  },
  // {
  //   title: 'Email',
  //   href: `mailto:${author.email}`,
  //   target: '_blank',
  //   icon: 'email',
  // },
  // { title: 'Behance', href: 'https://www.behance.net/urmzd', icon: 'behance' },
  // {
  //   title: 'arXiv',
  //   href: 'https://arxiv.org/search/cs?searchtype=author&query=Mukhammadnaim,+U',
  //   icon: 'arxiv',
  // },
  { title: 'RSS', href: '/rss.xml', target: '_blank', icon: 'rss' },
];
