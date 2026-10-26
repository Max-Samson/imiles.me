import type { APIContext } from 'astro';
import { getAllPlaygroundItems } from '@/data/playgroundNav';
import { getCuratedContentEntries } from '@/lib/curated-content';
import { getPublicContentEntries } from '@/server/content/public-index';

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

function toAbsoluteUrl(path: string, siteUrl: string) {
  return new URL(path, siteUrl).toString();
}

function formatUtcDateTime(date: Date) {
  return date.toISOString();
}

function renderUrl(entry: SitemapEntry, siteUrl: string) {
  const lastmod = entry.lastmod
    ? `\n    <lastmod>${formatUtcDateTime(entry.lastmod)}</lastmod>`
    : '';

  return `  <url>
    <loc>${escapeXml(toAbsoluteUrl(entry.path, siteUrl))}</loc>${lastmod}
  </url>`;
}

export async function GET(context: APIContext) {
  const siteUrl = context.site?.toString() ?? 'https://imiles.me';
  const [blogPosts, stories] = await Promise.all([
    getPublicContentEntries(context.locals, 'blog'),
    getPublicContentEntries(context.locals, 'stories'),
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
    { path: '/friends' },
    { path: '/zh/friends' },
    ...getAllPlaygroundItems().map((item) => ({ path: item.href })),
    ...blogPosts.map((post) => ({
      path: post.publicPath,
      lastmod: post.updatedDate ?? post.pubDate,
    })),
    ...stories.map((story) => ({
      path: story.publicPath,
      lastmod: story.updatedDate ?? story.pubDate,
    })),
    ...getCuratedContentEntries().map((entry) => ({ path: entry.path })),
  ];

  const uniqueEntries = Array.from(
    new Map(entries.map((entry) => [entry.path.replace(/\/$/, '') || '/', entry])).values(),
  );

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${uniqueEntries.map((entry) => renderUrl(entry, siteUrl)).join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=300',
    },
  });
}
