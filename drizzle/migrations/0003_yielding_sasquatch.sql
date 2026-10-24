CREATE TABLE `cms_draft_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`object_key` text NOT NULL,
	`content_hash` text NOT NULL,
	`mime` text NOT NULL,
	`bytes` integer NOT NULL,
	`public_path` text NOT NULL,
	`status` text DEFAULT 'staged' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `cms_drafts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "cms_draft_assets_bytes" CHECK("cms_draft_assets"."bytes" BETWEEN 1 AND 2097152),
	CONSTRAINT "cms_draft_assets_status" CHECK("cms_draft_assets"."status" IN ('staged', 'committed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cms_draft_assets_object_key` ON `cms_draft_assets` (`object_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `cms_draft_assets_public_path` ON `cms_draft_assets` (`public_path`);--> statement-breakpoint
CREATE INDEX `cms_draft_assets_draft_status` ON `cms_draft_assets` (`draft_id`,`status`);