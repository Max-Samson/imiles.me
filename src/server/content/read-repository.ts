import { and, desc, eq } from 'drizzle-orm';
import type { CloudflareEnv } from '../../env.d';
import { createDrizzleClient, schema } from '../db';
import type { CmsPost } from '../db/schema/cms';

/** 公开内容的只读边界：不依赖后台发布、源文解析、图片存储或管理服务。 */
export function contentReadRepository(env: CloudflareEnv) {
  const db = createDrizzleClient(env);
  return {
    async listPublished(collection?: 'blog' | 'stories', lang?: 'en' | 'zh') {
      const conditions = [eq(schema.cmsPosts.status, 'published')];
      if (collection) conditions.push(eq(schema.cmsPosts.collection, collection));
      if (lang) conditions.push(eq(schema.cmsPosts.lang, lang));

      return db.query.cmsPosts.findMany({
        where: and(...conditions),
        orderBy: [desc(schema.cmsPosts.pubDate), desc(schema.cmsPosts.updatedAt)],
      });
    },

    async findByPath(
      publicPath: string,
      options?: { includeArchived?: boolean },
    ): Promise<CmsPost | null> {
      const normalizedPath =
        publicPath.endsWith('/') && publicPath.length > 1 ? publicPath.slice(0, -1) : publicPath;
      const conditions = [eq(schema.cmsPosts.publicPath, normalizedPath)];
      if (!options?.includeArchived) {
        conditions.push(eq(schema.cmsPosts.status, 'published'));
      }
      const post = await db.query.cmsPosts.findFirst({
        where: and(...conditions),
      });
      return post ?? null;
    },

    async findByTargetPath(
      targetPath: string,
      options?: { includeArchived?: boolean },
    ): Promise<CmsPost | null> {
      const conditions = [eq(schema.cmsPosts.targetPath, targetPath)];
      if (!options?.includeArchived) {
        conditions.push(eq(schema.cmsPosts.status, 'published'));
      }
      const post = await db.query.cmsPosts.findFirst({
        where: and(...conditions),
      });
      return post ?? null;
    },
  };
}
