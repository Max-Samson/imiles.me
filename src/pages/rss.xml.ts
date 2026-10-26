import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { resolveContentPublicPath } from '../lib/content-routing';

export async function GET(context: APIContext) {
  const posts = await getCollection('blog');
  const sortedPosts = posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  return rss({
    title: 'imiles.me',
    description: 'Personal website and blog of Miles',
    site: context.site ?? 'https://imiles.me',
    items: sortedPosts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: resolveContentPublicPath('blog', post.data.lang === 'zh' ? 'zh' : 'en', post.id),
      categories: post.data.tags,
    })),
    customData: `<language>en-us</language>`,
  });
}
