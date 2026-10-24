import { eq, or } from 'drizzle-orm';
import type { CloudflareEnv } from '../../../env.d';
import { contentReadRepository } from '../../content/read-repository';
import { createDrizzleClient, schema } from '../../db';
import type { CmsPost, NewCmsPost } from '../../db/schema/cms';
import { NotFoundError } from '../../errors';

export function postRepository(env: CloudflareEnv) {
  const db = createDrizzleClient(env);
  return {
    ...contentReadRepository(env),

    async findById(id: string): Promise<CmsPost> {
      const post = await db.query.cmsPosts.findFirst({
        where: eq(schema.cmsPosts.id, id),
      });
      if (!post) throw new NotFoundError('文章不存在');
      return post;
    },

    async upsert(post: NewCmsPost): Promise<CmsPost> {
      const existing = await db.query.cmsPosts.findFirst({
        where: or(
          eq(schema.cmsPosts.publicPath, post.publicPath),
          eq(schema.cmsPosts.targetPath, post.targetPath),
        ),
      });

      if (existing) {
        const {
          id: _ignoreId,
          createdAt: _ignoreCreatedAt,
          createdBy: _ignoreCreatedBy,
          ...updateData
        } = post;
        const [updated] = await db
          .update(schema.cmsPosts)
          .set({
            ...updateData,
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
