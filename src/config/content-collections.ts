/** 后台和公开路由共同使用的文章集合定义；这里不能放仓库凭据。 */
export const contentCollections = {
  blog: {
    directory: 'content/blog',
    extensions: ['.md', '.mdx'],
    defaultExtension: '.mdx',
    route: { en: '/blog', zh: '/zh/blog' },
  },
  stories: {
    directory: 'content/stories',
    extensions: ['.md'],
    defaultExtension: '.md',
    route: { en: '/stories', zh: '/zh/stories' },
  },
} as const;

export type ContentCollection = keyof typeof contentCollections;
export type ContentLanguage = 'en' | 'zh';
