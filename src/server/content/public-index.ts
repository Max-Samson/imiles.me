import { getCollection } from 'astro:content';
import { resolveContentPublicPath } from '@/lib/content-routing';
import type { Locale } from '@/lib/i18n';
import { normalizeTags } from '@/lib/tags';
import { getServerEnv } from '../env';
import { contentReadRepository } from './read-repository';

export type PublicCollection = 'blog' | 'stories';

export interface PublicContentEntry {
  id: string;
  publicPath: string;
  lang: Locale;
  title: string;
  description: string;
  pubDate: Date;
  updatedDate?: Date;
  tags: string[];
  body: string;
  heroImage?: string;
}

function parseTags(value: string): string[] {
  try {
    return normalizeTags(JSON.parse(value));
  } catch {
    return [];
  }
}

/** Match the public pages: a published D1 row replaces the bundled article at the same URL. */
export async function getPublicContentEntries(
  locals: Partial<App.Locals>,
  collection: PublicCollection,
  lang?: Locale,
): Promise<PublicContentEntry[]> {
  const entries = new Map<string, PublicContentEntry>();

  try {
    const staticEntries =
      collection === 'blog' ? await getCollection('blog') : await getCollection('stories');
    for (const post of staticEntries) {
      if (lang && post.data.lang !== lang) continue;
      const publicPath = resolveContentPublicPath(collection, post.data.lang, post.id);
      entries.set(publicPath, {
        id: post.id,
        publicPath,
        lang: post.data.lang,
        title: post.data.title,
        description: post.data.description,
        pubDate: post.data.pubDate,
        updatedDate: post.data.updatedDate,
        tags: post.data.tags,
        body: post.body ?? '',
        heroImage:
          collection === 'blog'
            ? 'heroImage' in post.data
              ? post.data.heroImage
              : undefined
            : undefined,
      });
    }
  } catch {
    // Keep D1 content available if the bundled collection cannot be read.
  }

  try {
    const env = getServerEnv(locals);
    const dbPosts = await contentReadRepository(env).listPublished(collection, lang);
    for (const post of dbPosts) {
      entries.set(post.publicPath, {
        id: post.slug,
        publicPath: post.publicPath,
        lang: post.lang,
        title: post.title,
        description: post.description ?? '',
        pubDate: new Date(post.pubDate),
        updatedDate: new Date(post.updatedDate ?? post.updatedAt),
        tags: parseTags(post.tags),
        body: post.contentRaw,
        heroImage: post.heroImage ?? undefined,
      });
    }
  } catch {
    // Preserve bundled content when D1 is temporarily unavailable.
  }

  return Array.from(entries.values()).sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());
}
