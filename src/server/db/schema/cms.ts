import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { auditTimestamps, primaryKeyColumn } from './common';

export const cmsDraftStatuses = ['active', 'published', 'discarded'] as const;
export const cmsPostStatuses = ['published', 'archived'] as const;
export const cmsPublicationStatuses = [
  'prepared',
  'in_flight',
  'unknown',
  'committed',
  'conflict',
  'failed',
] as const;
export const cmsDeletionStatuses = cmsPublicationStatuses;

/** D1 持久化已发布文章，前台直接从该表查询与渲染。 */
export const cmsPosts = sqliteTable(
  'cms_posts',
  {
    id: primaryKeyColumn('cmp').notNull(),
    collection: text('collection', { enum: ['blog', 'stories'] }).notNull(),
    format: text('format', { enum: ['md', 'mdx'] }).notNull(),
    lang: text('lang', { enum: ['en', 'zh'] }).notNull(),
    slug: text('slug').notNull(),
    targetPath: text('target_path').notNull(),
    publicPath: text('public_path').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    pubDate: integer('pub_date').notNull(),
    updatedDate: integer('updated_date'),
    tags: text('tags').notNull(),
    heroImage: text('hero_image'),
    shareText: text('share_text'),
    llms: integer('llms', { mode: 'boolean' }).notNull().default(false),
    contentRaw: text('content_raw').notNull(),
    contentHtml: text('content_html').notNull(),
    source: text('source').notNull(),
    sourceHash: text('source_hash').notNull(),
    sourceBytes: integer('source_bytes').notNull(),
    draftId: text('draft_id'),
    status: text('status', { enum: cmsPostStatuses }).notNull().default('published'),
    createdBy: text('created_by').notNull(),
    updatedBy: text('updated_by').notNull(),
    ...auditTimestamps(),
  },
  (t) => [
    uniqueIndex('cms_posts_active_target').on(t.targetPath).where(sql`${t.status} = 'published'`),
    uniqueIndex('cms_posts_active_public').on(t.publicPath).where(sql`${t.status} = 'published'`),
    index('cms_posts_public_list').on(t.collection, t.lang, t.status, t.pubDate),
    check('cms_posts_collection', sql`${t.collection} IN ('blog', 'stories')`),
    check('cms_posts_format', sql`${t.format} IN ('md', 'mdx')`),
    check('cms_posts_lang', sql`${t.lang} IN ('en', 'zh')`),
    check('cms_posts_status', sql`${t.status} IN ('published', 'archived')`),
    check('cms_posts_bytes', sql`${t.sourceBytes} BETWEEN 1 AND 1048576`),
  ],
);

/** 草稿图片先存私有对象存储，文章提交确认后才开放公开路径。 */
export const cmsDraftAssets = sqliteTable(
  'cms_draft_assets',
  {
    id: primaryKeyColumn('cma').notNull(),
    draftId: text('draft_id')
      .notNull()
      .references(() => cmsDrafts.id, { onDelete: 'restrict' }),
    objectKey: text('object_key').notNull(),
    contentHash: text('content_hash').notNull(),
    mime: text('mime', { enum: ['image/png', 'image/jpeg', 'image/webp'] }).notNull(),
    bytes: integer('bytes').notNull(),
    publicPath: text('public_path').notNull(),
    status: text('status', { enum: ['staged', 'committed'] })
      .notNull()
      .default('staged'),
    createdBy: text('created_by').notNull(),
    ...auditTimestamps(),
  },
  (t) => [
    uniqueIndex('cms_draft_assets_object_key').on(t.objectKey),
    uniqueIndex('cms_draft_assets_public_path').on(t.publicPath),
    index('cms_draft_assets_draft_status').on(t.draftId, t.status),
    check('cms_draft_assets_bytes', sql`${t.bytes} BETWEEN 1 AND 2097152`),
    check('cms_draft_assets_status', sql`${t.status} IN ('staged', 'committed')`),
  ],
);

/** D1 仅保存受保护的工作草稿；公开站点仍从 Git 文件构建。 */
export const cmsDrafts = sqliteTable(
  'cms_drafts',
  {
    id: primaryKeyColumn('cmd').notNull(),
    collection: text('collection', { enum: ['blog', 'stories'] }).notNull(),
    format: text('format', { enum: ['md', 'mdx'] }).notNull(),
    lang: text('lang', { enum: ['en', 'zh'] }).notNull(),
    slug: text('slug').notNull(),
    targetPath: text('target_path').notNull(),
    publicPath: text('public_path').notNull(),
    source: text('source').notNull(),
    sourceHash: text('source_hash').notNull(),
    sourceBytes: integer('source_bytes').notNull(),
    baseBlobSha: text('base_blob_sha'),
    revision: integer('revision').notNull().default(1),
    status: text('status', { enum: cmsDraftStatuses }).notNull().default('active'),
    titleCache: text('title_cache'),
    createdBy: text('created_by').notNull(),
    updatedBy: text('updated_by').notNull(),
    closedAt: integer('closed_at'),
    publishedCommitSha: text('published_commit_sha'),
    ...auditTimestamps(),
  },
  (t) => [
    uniqueIndex('cms_drafts_active_target').on(t.targetPath).where(sql`${t.status} = 'active'`),
    uniqueIndex('cms_drafts_active_public').on(t.publicPath).where(sql`${t.status} = 'active'`),
    index('cms_drafts_admin_list').on(t.status, t.updatedAt, t.id),
    index('cms_drafts_path_history').on(t.targetPath, t.createdAt),
    check('cms_drafts_collection', sql`${t.collection} IN ('blog', 'stories')`),
    check('cms_drafts_format', sql`${t.format} IN ('md', 'mdx')`),
    check('cms_drafts_story_format', sql`${t.collection} != 'stories' OR ${t.format} = 'md'`),
    check('cms_drafts_lang', sql`${t.lang} IN ('en', 'zh')`),
    check('cms_drafts_status', sql`${t.status} IN ('active', 'published', 'discarded')`),
    check('cms_drafts_revision', sql`${t.revision} > 0`),
    check('cms_drafts_source_bytes', sql`${t.sourceBytes} BETWEEN 1 AND 1048576`),
    check(
      'cms_drafts_closed',
      sql`(${t.status} = 'active' AND ${t.closedAt} IS NULL AND ${t.publishedCommitSha} IS NULL) OR (${t.status} = 'published' AND ${t.closedAt} IS NOT NULL AND ${t.publishedCommitSha} IS NOT NULL) OR (${t.status} = 'discarded' AND ${t.closedAt} IS NOT NULL AND ${t.publishedCommitSha} IS NULL)`,
    ),
  ],
);

/** 每次发布固定实际 Git 文本与操作 ID，供超时后的安全对账。 */
export const cmsPublicationAttempts = sqliteTable(
  'cms_publication_attempts',
  {
    operationId: text('operation_id').primaryKey(),
    draftId: text('draft_id')
      .notNull()
      .references(() => cmsDrafts.id, { onDelete: 'restrict' }),
    draftRevision: integer('draft_revision').notNull(),
    requestHash: text('request_hash').notNull(),
    sourceSnapshot: text('source_snapshot'),
    sourceHash: text('source_hash').notNull(),
    sourceBytes: integer('source_bytes').notNull(),
    targetPath: text('target_path').notNull(),
    publicPath: text('public_path').notNull(),
    expectedBlobSha: text('expected_blob_sha'),
    status: text('status', { enum: cmsPublicationStatuses }).notNull().default('prepared'),
    resultBlobSha: text('result_blob_sha'),
    resultCommitSha: text('result_commit_sha'),
    deploymentStatus: text('deployment_status', {
      enum: ['unverified', 'pending', 'running', 'verified', 'failed', 'cancelled'],
    })
      .notNull()
      .default('unverified'),
    deploymentRef: text('deployment_ref'),
    deployedAt: integer('deployed_at'),
    errorCode: text('error_code'),
    createdBy: text('created_by').notNull(),
    completedAt: integer('completed_at'),
    ...auditTimestamps(),
  },
  (t) => [
    uniqueIndex('cms_publication_attempts_active_draft')
      .on(t.draftId)
      .where(sql`${t.status} IN ('prepared', 'in_flight', 'unknown')`),
    index('cms_publication_attempts_draft_history').on(t.draftId, t.createdAt),
    index('cms_publication_attempts_reconcile').on(t.status, t.updatedAt),
    check('cms_publication_attempts_revision', sql`${t.draftRevision} > 0`),
    check('cms_publication_attempts_bytes', sql`${t.sourceBytes} BETWEEN 1 AND 1048576`),
    check(
      'cms_publication_attempts_status',
      sql`${t.status} IN ('prepared', 'in_flight', 'unknown', 'committed', 'conflict', 'failed')`,
    ),
    check(
      'cms_publication_attempts_deployment',
      sql`${t.deploymentStatus} IN ('unverified', 'pending', 'running', 'verified', 'failed', 'cancelled')`,
    ),
    check(
      'cms_publication_attempts_snapshot',
      sql`${t.sourceSnapshot} IS NOT NULL OR ${t.status} IN ('committed', 'conflict', 'failed')`,
    ),
    check(
      'cms_publication_attempts_result',
      sql`(${t.status} = 'committed' AND ${t.resultBlobSha} IS NOT NULL AND ${t.resultCommitSha} IS NOT NULL) OR (${t.status} != 'committed' AND ${t.resultBlobSha} IS NULL AND ${t.resultCommitSha} IS NULL)`,
    ),
  ],
);

/** 删除 Git 文件的固定意图；结果未知时必须按同一操作 ID 对账。 */
export const cmsDeletionAttempts = sqliteTable(
  'cms_deletion_attempts',
  {
    operationId: text('operation_id').primaryKey(),
    targetPath: text('target_path').notNull(),
    publicPath: text('public_path').notNull(),
    expectedBlobSha: text('expected_blob_sha').notNull(),
    status: text('status', { enum: cmsDeletionStatuses }).notNull().default('prepared'),
    resultCommitSha: text('result_commit_sha'),
    deploymentStatus: text('deployment_status', {
      enum: ['unverified', 'pending', 'running', 'verified', 'failed', 'cancelled'],
    })
      .notNull()
      .default('unverified'),
    createdBy: text('created_by').notNull(),
    completedAt: integer('completed_at'),
    ...auditTimestamps(),
  },
  (t) => [
    uniqueIndex('cms_deletion_attempts_active_path')
      .on(t.targetPath)
      .where(sql`${t.status} IN ('prepared', 'in_flight', 'unknown')`),
    index('cms_deletion_attempts_reconcile').on(t.status, t.updatedAt),
    check(
      'cms_deletion_attempts_status',
      sql`${t.status} IN ('prepared', 'in_flight', 'unknown', 'committed', 'conflict', 'failed')`,
    ),
    check(
      'cms_deletion_attempts_result',
      sql`(${t.status} = 'committed' AND ${t.resultCommitSha} IS NOT NULL) OR (${t.status} != 'committed' AND ${t.resultCommitSha} IS NULL)`,
    ),
  ],
);

export type CmsDraft = typeof cmsDrafts.$inferSelect;
export type CmsPost = typeof cmsPosts.$inferSelect;
export type NewCmsPost = typeof cmsPosts.$inferInsert;
export type CmsPublicationAttempt = typeof cmsPublicationAttempts.$inferSelect;
export type CmsDeletionAttempt = typeof cmsDeletionAttempts.$inferSelect;
export type CmsDraftAsset = typeof cmsDraftAssets.$inferSelect;
