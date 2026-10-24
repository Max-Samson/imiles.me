import { and, desc, eq } from 'drizzle-orm';
import type { CloudflareEnv } from '../../../env.d';
import { createDrizzleClient, schema } from '../../db';
import type { CmsPost, NewCmsPost } from '../../db/schema/cms';
import { NotFoundError } from '../../errors';

export function postRepository(env: CloudflareEnv) {
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

    async findByPath(publicPath: string): Promise<CmsPost | null> {
      const normalizedPath =
        publicPath.endsWith('/') && publicPath.length > 1 ? publicPath.slice(0, -1) : publicPath;
      const post = await db.query.cmsPosts.findFirst({
        where: and(
          eq(schema.cmsPosts.publicPath, normalizedPath),
          eq(schema.cmsPosts.status, 'published'),
        ),
      });
      return post ?? null;
    },

    async findByTargetPath(targetPath: string): Promise<CmsPost | null> {
      const post = await db.query.cmsPosts.findFirst({
        where: and(
          eq(schema.cmsPosts.targetPath, targetPath),
          eq(schema.cmsPosts.status, 'published'),
        ),
      });
      return post ?? null;
    },

    async findById(id: string): Promise<CmsPost> {
      const post = await db.query.cmsPosts.findFirst({
        where: eq(schema.cmsPosts.id, id),
      });
      if (!post) throw new NotFoundError('文章不存在');
      return post;
    },

    async upsert(post: NewCmsPost): Promise<CmsPost> {
      const existing = await db.query.cmsPosts.findFirst({
        where: eq(schema.cmsPosts.publicPath, post.publicPath),
      });

      if (existing) {
        const [updated] = await db
          .update(schema.cmsPosts)
          .set({
            ...post,
            id: existing.id,
            updatedAt: Date.now(),
          })
          .where(eq(schema.cmsPosts.id, existing.id))
          .returning();
        return updated;
      }

      const [created] = await db.insert(schema.cmsPosts).values(post).returning();
      return created;
    },

    async archive(id: string, actorId: string): Promise<CmsPost> {
      const [updated] = await db
        .update(schema.cmsPosts)
        .set({
          status: 'archived',
          updatedBy: actorId,
          updatedAt: Date.now(),
        })
        .where(eq(schema.cmsPosts.id, id))
        .returning();
      if (!updated) throw new NotFoundError('文章不存在');
      return updated;
    },

    async delete(id: string): Promise<void> {
      await db.delete(schema.cmsPosts).where(eq(schema.cmsPosts.id, id));
    },
  };
}
