import { getCollection } from 'astro:content';
import { research as notes } from '@/data/notes';
import { projects } from '@/data/projects';

export const prerender = true;

const siteUrl = 'https://imiles.me';

type SitemapEntry = {
  path: string;
  lastmod?: Date;
};

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function toAbsoluteUrl(path: string) {
  return new URL(path, siteUrl).toString();
}

function formatUtcDateTime(date: Date) {
  return date.toISOString();
}

function renderUrl(entry: SitemapEntry) {
  const lastmod = entry.lastmod
    ? `\n    <lastmod>${formatUtcDateTime(entry.lastmod)}</lastmod>`
    : '';

  return `  <url>
    <loc>${escapeXml(toAbsoluteUrl(entry.path))}</loc>${lastmod}
  </url>`;
}

export async function GET() {
  const [blogPosts, stories] = await Promise.all([
    getCollection('blog', ({ data }) => data.draft !== true),
    getCollection('stories', ({ data }) => data.draft !== true),
  ]);

  const entries: SitemapEntry[] = [
    { path: '/' },
    { path: '/zh' },
    { path: '/blog' },
    { path: '/zh/blog' },
    { path: '/stories' },
    { path: '/zh/stories' },
    { path: '/projects' },
    { path: '/zh/projects' },
    { path: '/about' },
    { path: '/zh/about' },
    { path: '/notes' },
    { path: '/zh/notes' },
    ...blogPosts.map((post) => ({
      path: post.data.lang === 'zh' ? `/zh/blog/${post.id}` : `/blog/${post.id}`,
      lastmod: post.data.updatedDate ?? post.data.pubDate,
    })),
    ...stories.flatMap((story) => [
      {
        path: `/stories/${story.id}`,
        lastmod: story.data.updatedDate ?? story.data.pubDate,
      },
      {
        path: `/zh/stories/${story.id}`,
        lastmod: story.data.updatedDate ?? story.data.pubDate,
      },
    ]),
    ...projects
      .filter((project) => project.hasDetailPage)
      .flatMap((project) => [
        { path: `/projects/${project.slug}` },
        { path: `/zh/projects/${project.slug}` },
      ]),
    ...notes
      .filter((item) => item.hasDetailPage)
      .flatMap((item) => [{ path: `/notes/${item.slug}` }, { path: `/zh/notes/${item.slug}` }]),
  ];

  const uniqueEntries = Array.from(
    new Map(entries.map((entry) => [entry.path.replace(/\/$/, '') || '/', entry])).values(),
  );

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${uniqueEntries.map(renderUrl).join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
