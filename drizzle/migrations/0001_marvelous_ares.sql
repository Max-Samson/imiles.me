CREATE TABLE `cms_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`collection` text NOT NULL,
	`format` text NOT NULL,
	`lang` text NOT NULL,
	`slug` text NOT NULL,
	`target_path` text NOT NULL,
	`public_path` text NOT NULL,
	`source` text NOT NULL,
	`source_hash` text NOT NULL,
	`source_bytes` integer NOT NULL,
	`base_blob_sha` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`title_cache` text,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`closed_at` integer,
	`published_commit_sha` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "cms_drafts_collection" CHECK("cms_drafts"."collection" IN ('blog', 'stories')),
	CONSTRAINT "cms_drafts_format" CHECK("cms_drafts"."format" IN ('md', 'mdx')),
	CONSTRAINT "cms_drafts_story_format" CHECK("cms_drafts"."collection" != 'stories' OR "cms_drafts"."format" = 'md'),
	CONSTRAINT "cms_drafts_lang" CHECK("cms_drafts"."lang" IN ('en', 'zh')),
	CONSTRAINT "cms_drafts_status" CHECK("cms_drafts"."status" IN ('active', 'published', 'discarded')),
	CONSTRAINT "cms_drafts_revision" CHECK("cms_drafts"."revision" > 0),
	CONSTRAINT "cms_drafts_source_bytes" CHECK("cms_drafts"."source_bytes" BETWEEN 1 AND 1048576),
	CONSTRAINT "cms_drafts_closed" CHECK(("cms_drafts"."status" = 'active' AND "cms_drafts"."closed_at" IS NULL AND "cms_drafts"."published_commit_sha" IS NULL) OR ("cms_drafts"."status" = 'published' AND "cms_drafts"."closed_at" IS NOT NULL AND "cms_drafts"."published_commit_sha" IS NOT NULL) OR ("cms_drafts"."status" = 'discarded' AND "cms_drafts"."closed_at" IS NOT NULL AND "cms_drafts"."published_commit_sha" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cms_drafts_active_target` ON `cms_drafts` (`target_path`) WHERE "cms_drafts"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX `cms_drafts_active_public` ON `cms_drafts` (`public_path`) WHERE "cms_drafts"."status" = 'active';--> statement-breakpoint
CREATE INDEX `cms_drafts_admin_list` ON `cms_drafts` (`status`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `cms_drafts_path_history` ON `cms_drafts` (`target_path`,`created_at`);--> statement-breakpoint
CREATE TABLE `cms_publication_attempts` (
	`operation_id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`draft_revision` integer NOT NULL,
	`request_hash` text NOT NULL,
	`source_snapshot` text,
	`source_hash` text NOT NULL,
	`source_bytes` integer NOT NULL,
	`target_path` text NOT NULL,
	`public_path` text NOT NULL,
	`expected_blob_sha` text,
	`status` text DEFAULT 'prepared' NOT NULL,
	`result_blob_sha` text,
	`result_commit_sha` text,
	`deployment_status` text DEFAULT 'unverified' NOT NULL,
	`deployment_ref` text,
	`deployed_at` integer,
	`error_code` text,
	`created_by` text NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `cms_drafts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "cms_publication_attempts_revision" CHECK("cms_publication_attempts"."draft_revision" > 0),
	CONSTRAINT "cms_publication_attempts_bytes" CHECK("cms_publication_attempts"."source_bytes" BETWEEN 1 AND 1048576),
	CONSTRAINT "cms_publication_attempts_status" CHECK("cms_publication_attempts"."status" IN ('prepared', 'in_flight', 'unknown', 'committed', 'conflict', 'failed')),
	CONSTRAINT "cms_publication_attempts_deployment" CHECK("cms_publication_attempts"."deployment_status" IN ('unverified', 'pending', 'running', 'verified', 'failed', 'cancelled')),
	CONSTRAINT "cms_publication_attempts_snapshot" CHECK("cms_publication_attempts"."source_snapshot" IS NOT NULL OR "cms_publication_attempts"."status" IN ('committed', 'conflict', 'failed')),
	CONSTRAINT "cms_publication_attempts_result" CHECK(("cms_publication_attempts"."status" = 'committed' AND "cms_publication_attempts"."result_blob_sha" IS NOT NULL AND "cms_publication_attempts"."result_commit_sha" IS NOT NULL) OR ("cms_publication_attempts"."status" != 'committed' AND "cms_publication_attempts"."result_blob_sha" IS NULL AND "cms_publication_attempts"."result_commit_sha" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cms_publication_attempts_active_draft` ON `cms_publication_attempts` (`draft_id`) WHERE "cms_publication_attempts"."status" IN ('prepared', 'in_flight', 'unknown');--> statement-breakpoint
CREATE INDEX `cms_publication_attempts_draft_history` ON `cms_publication_attempts` (`draft_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `cms_publication_attempts_reconcile` ON `cms_publication_attempts` (`status`,`updated_at`);