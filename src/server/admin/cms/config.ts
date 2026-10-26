import { contentCollections } from '../../../config/content-collections';

/** Pageel collection config is code-reviewed and read-only from the CMS. */
export const cmsConfig = {
  version: 2,
  activeCollectionId: 'blog',
  collections: (['blog', 'stories'] as const).map((id) => ({
    id,
    name: id === 'blog' ? '博客 / Blog' : '故事 / Stories',
    postsPath: contentCollections[id].directory,
    imagesPath: id === 'blog' ? 'public/images/blog' : '',
    template: {
      fields: [
        { name: 'title', type: 'string', required: true },
        { name: 'description', type: 'string', required: true },
        { name: 'pubDate', type: 'date', required: true },
        { name: 'updatedDate', type: 'date' },
        { name: 'tags', type: 'array', defaultValue: [] },
        { name: 'lang', type: 'string', defaultValue: 'en' },
        { name: 'llms', type: 'boolean', defaultValue: false },
        ...(id === 'blog'
          ? [
              { name: 'heroImage', type: 'string' },
              { name: 'shareText', type: 'string' },
            ]
          : []),
      ],
    },
    tableColumns: ['lang', 'pubDate'],
  })),
  settings: {
    projectType: 'astro',
    domainUrl: '',
    postFileTypes: '.md,.mdx',
    imageFileTypes: '.png,.jpg,.jpeg,.webp',
    publishDateSource: 'file',
    imageCompressionEnabled: false,
  },
  plugins: { editor: '@pageel/plugin-mdx' },
};
