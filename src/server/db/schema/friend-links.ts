import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { auditTimestamps, primaryKeyColumn } from './common';

export const friendLinkStatuses = ['pending', 'active', 'rejected', 'hidden'] as const;
export const friendLinks = sqliteTable(
  'friend_links',
  {
    id: primaryKeyColumn('fl').notNull(),
    name: text('name'),
    submittedUrl: text('submitted_url').notNull(),
    canonicalUrl: text('canonical_url').notNull(),
    description: text('description').notNull(),
    contactEmail: text('contact_email'),
    status: text('status', { enum: friendLinkStatuses }).notNull().default('pending'),
    screenshotKey: text('screenshot_key'),
    screenshotMime: text('screenshot_mime'),
    screenshotBytes: integer('screenshot_bytes'),
    screenshotSha256: text('screenshot_sha256'),
    submissionKeyHash: text('submission_key_hash').notNull(),
    submissionPayloadHash: text('submission_payload_hash').notNull(),
    version: integer('version').notNull().default(1),
    reviewedBy: text('reviewed_by'),
    reviewedAt: integer('reviewed_at'),
    publishedAt: integer('published_at'),
    updatedBy: text('updated_by'),
    ...auditTimestamps(),
  },
  (t) => [
    uniqueIndex('friend_links_submission_key').on(t.submissionKeyHash),
    uniqueIndex('friend_links_published_url')
      .on(t.canonicalUrl)
      .where(sql`${t.status} IN ('active', 'hidden')`),
    uniqueIndex('friend_links_screenshot_key').on(t.screenshotKey),
    index('friend_links_admin_list').on(t.status, t.createdAt, t.id),
    index('friend_links_public_list').on(t.status, t.publishedAt, t.id),
    index('friend_links_url_history').on(t.canonicalUrl, t.status),
    check('friend_links_status', sql`${t.status} IN ('pending', 'active', 'rejected', 'hidden')`),
    check('friend_links_version', sql`${t.version} > 0`),
    check('friend_links_name', sql`${t.name} IS NULL OR length(${t.name}) BETWEEN 1 AND 50`),
    check('friend_links_description', sql`length(${t.description}) BETWEEN 1 AND 200`),
    check(
      'friend_links_email',
      sql`${t.contactEmail} IS NULL OR length(${t.contactEmail}) BETWEEN 3 AND 254`,
    ),
    check(
      'friend_links_review',
      sql`(${t.status} = 'pending' AND ${t.reviewedBy} IS NULL AND ${t.reviewedAt} IS NULL AND ${t.updatedBy} IS NULL) OR (${t.status} != 'pending' AND ${t.reviewedBy} IS NOT NULL AND ${t.reviewedAt} IS NOT NULL AND ${t.updatedBy} IS NOT NULL)`,
    ),
    check(
      'friend_links_publication',
      sql`(${t.status} IN ('pending', 'rejected') AND ${t.publishedAt} IS NULL) OR (${t.status} IN ('active', 'hidden') AND ${t.publishedAt} IS NOT NULL)`,
    ),
    check(
      'friend_links_image',
      sql`(${t.screenshotKey} IS NULL AND ${t.screenshotMime} IS NULL AND ${t.screenshotBytes} IS NULL AND ${t.screenshotSha256} IS NULL) OR (${t.screenshotKey} IS NOT NULL AND ${t.screenshotMime} IS NOT NULL AND ${t.screenshotMime} IN ('image/png', 'image/jpeg', 'image/webp') AND ${t.screenshotBytes} IS NOT NULL AND ${t.screenshotBytes} BETWEEN 1 AND 2097152 AND ${t.screenshotSha256} IS NOT NULL AND length(${t.screenshotSha256}) = 64)`,
    ),
  ],
);
export type FriendLink = typeof friendLinks.$inferSelect;
export type FriendLinkInsert = typeof friendLinks.$inferInsert;
export type FriendLinkStatus = FriendLink['status'];
