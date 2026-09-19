CREATE TABLE `friend_links` (
	`id` text PRIMARY KEY NOT NULL,
	`submitted_url` text NOT NULL,
	`canonical_url` text NOT NULL,
	`description` text NOT NULL,
	`contact_email` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`screenshot_key` text,
	`screenshot_mime` text,
	`screenshot_bytes` integer,
	`screenshot_sha256` text,
	`submission_key_hash` text NOT NULL,
	`submission_payload_hash` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`reviewed_by` text,
	`reviewed_at` integer,
	`published_at` integer,
	`updated_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "friend_links_status" CHECK("friend_links"."status" IN ('pending', 'active', 'rejected', 'hidden')),
	CONSTRAINT "friend_links_version" CHECK("friend_links"."version" > 0),
	CONSTRAINT "friend_links_description" CHECK(length("friend_links"."description") BETWEEN 1 AND 200),
	CONSTRAINT "friend_links_email" CHECK("friend_links"."contact_email" IS NULL OR length("friend_links"."contact_email") BETWEEN 3 AND 254),
	CONSTRAINT "friend_links_review" CHECK(("friend_links"."status" = 'pending' AND "friend_links"."reviewed_by" IS NULL AND "friend_links"."reviewed_at" IS NULL AND "friend_links"."updated_by" IS NULL) OR ("friend_links"."status" != 'pending' AND "friend_links"."reviewed_by" IS NOT NULL AND "friend_links"."reviewed_at" IS NOT NULL AND "friend_links"."updated_by" IS NOT NULL)),
	CONSTRAINT "friend_links_publication" CHECK(("friend_links"."status" IN ('pending', 'rejected') AND "friend_links"."published_at" IS NULL) OR ("friend_links"."status" IN ('active', 'hidden') AND "friend_links"."published_at" IS NOT NULL)),
	CONSTRAINT "friend_links_image" CHECK(("friend_links"."screenshot_key" IS NULL AND "friend_links"."screenshot_mime" IS NULL AND "friend_links"."screenshot_bytes" IS NULL AND "friend_links"."screenshot_sha256" IS NULL) OR ("friend_links"."screenshot_key" IS NOT NULL AND "friend_links"."screenshot_mime" IS NOT NULL AND "friend_links"."screenshot_mime" IN ('image/png', 'image/jpeg', 'image/webp') AND "friend_links"."screenshot_bytes" IS NOT NULL AND "friend_links"."screenshot_bytes" BETWEEN 1 AND 2097152 AND "friend_links"."screenshot_sha256" IS NOT NULL AND length("friend_links"."screenshot_sha256") = 64))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friend_links_submission_key` ON `friend_links` (`submission_key_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `friend_links_published_url` ON `friend_links` (`canonical_url`) WHERE "friend_links"."status" IN ('active', 'hidden');--> statement-breakpoint
CREATE UNIQUE INDEX `friend_links_screenshot_key` ON `friend_links` (`screenshot_key`);--> statement-breakpoint
CREATE INDEX `friend_links_admin_list` ON `friend_links` (`status`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `friend_links_public_list` ON `friend_links` (`status`,`published_at`,`id`);--> statement-breakpoint
CREATE INDEX `friend_links_url_history` ON `friend_links` (`canonical_url`,`status`);