export interface SocialLink {
  title: string;
  href: string;
  icon: 'github' | 'linkedin' | 'x' | 'email' | 'behance' | 'arxiv' | 'rss';
  target?: '_blank' | '_self' | '_parent' | '_top';
}

export const socialLinks: SocialLink[] = [
  {
    title: 'GitHub',
    href: 'https://github.com/Max-Samson',
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
    href: 'https://x.com/y7732772614744',
    target: '_blank',
    icon: 'x',
  },
  // {
  //   title: 'Email',
  //   href: 'maxshuai355@gmail.com',
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
