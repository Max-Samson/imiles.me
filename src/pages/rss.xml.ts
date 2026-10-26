import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCuratedContentEntries } from '../lib/curated-content';
import { getPublicContentEntries } from '../server/content/public-index';

export async function GET(context: APIContext) {
  const [posts, stories] = await Promise.all([
    getPublicContentEntries(context.locals, 'blog'),
    getPublicContentEntries(context.locals, 'stories'),
  ]);
  const datedEntries = [...posts, ...stories].sort(
    (a, b) => b.pubDate.valueOf() - a.pubDate.valueOf(),
  );

  const response = await rss({
    title: 'imiles.me',
    description: 'Writing, stories, projects, and notes from Miles',
    site: context.site ?? 'https://imiles.me',
    trailingSlash: false,
    xmlns: { dcterms: 'http://purl.org/dc/terms/' },
    items: [
      ...datedEntries.map((entry) => ({
        title: entry.title,
        description: entry.description,
        pubDate: entry.pubDate,
        link: entry.publicPath,
        categories: entry.tags,
        customData: entry.updatedDate
          ? `<dcterms:modified>${entry.updatedDate.toISOString()}</dcterms:modified>`
          : undefined,
      })),
      ...getCuratedContentEntries().map((entry) => ({
        title: entry.title,
        description: entry.description,
        link: entry.path,
        categories: [entry.kind, ...entry.tags],
      })),
    ],
  });
  response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300');
  return response;
}
