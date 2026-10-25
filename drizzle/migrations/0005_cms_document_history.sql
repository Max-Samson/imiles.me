-- 仅新增修订快照与发布通道元数据；不回填旧版本，不重建或删除已有业务表。
CREATE TABLE `cms_document_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`revision` integer NOT NULL,
	`target_path` text NOT NULL,
	`source` text NOT NULL,
	`source_hash` text NOT NULL,
	`source_bytes` integer NOT NULL,
	`title_cache` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `cms_drafts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "cms_document_revisions_revision" CHECK("cms_document_revisions"."revision" > 0),
	CONSTRAINT "cms_document_revisions_bytes" CHECK("cms_document_revisions"."source_bytes" BETWEEN 1 AND 1048576)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_cms_document_revisions_draft_revision` ON `cms_document_revisions` (`draft_id`,`revision`);--> statement-breakpoint
CREATE INDEX `idx_cms_document_revisions_path_history` ON `cms_document_revisions` (`target_path`,`created_at`,`id`);--> statement-breakpoint
ALTER TABLE `cms_publication_attempts` ADD `backend` text;--> statement-breakpoint
CREATE INDEX `idx_cms_publication_attempts_path_history` ON `cms_publication_attempts` (`target_path`,`created_at`,`operation_id`);
