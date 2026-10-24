CREATE TABLE `cms_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`collection` text NOT NULL,
	`format` text NOT NULL,
	`lang` text NOT NULL,
	`slug` text NOT NULL,
	`target_path` text NOT NULL,
	`public_path` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`pub_date` integer NOT NULL,
	`updated_date` integer,
	`tags` text NOT NULL,
	`hero_image` text,
	`share_text` text,
	`llms` integer DEFAULT false NOT NULL,
	`content_raw` text NOT NULL,
	`content_html` text NOT NULL,
	`source` text NOT NULL,
	`source_hash` text NOT NULL,
	`source_bytes` integer NOT NULL,
	`draft_id` text,
	`status` text DEFAULT 'published' NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "cms_posts_collection" CHECK("cms_posts"."collection" IN ('blog', 'stories')),
	CONSTRAINT "cms_posts_format" CHECK("cms_posts"."format" IN ('md', 'mdx')),
	CONSTRAINT "cms_posts_lang" CHECK("cms_posts"."lang" IN ('en', 'zh')),
	CONSTRAINT "cms_posts_status" CHECK("cms_posts"."status" IN ('published', 'archived')),
	CONSTRAINT "cms_posts_bytes" CHECK("cms_posts"."source_bytes" BETWEEN 1 AND 1048576)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cms_posts_active_target` ON `cms_posts` (`target_path`) WHERE "cms_posts"."status" = 'published';--> statement-breakpoint
CREATE UNIQUE INDEX `cms_posts_active_public` ON `cms_posts` (`public_path`) WHERE "cms_posts"."status" = 'published';--> statement-breakpoint
CREATE INDEX `cms_posts_public_list` ON `cms_posts` (`collection`,`lang`,`status`,`pub_date`);