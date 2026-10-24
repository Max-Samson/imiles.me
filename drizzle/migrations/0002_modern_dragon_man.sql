CREATE TABLE `cms_deletion_attempts` (
	`operation_id` text PRIMARY KEY NOT NULL,
	`target_path` text NOT NULL,
	`public_path` text NOT NULL,
	`expected_blob_sha` text NOT NULL,
	`status` text DEFAULT 'prepared' NOT NULL,
	`result_commit_sha` text,
	`deployment_status` text DEFAULT 'unverified' NOT NULL,
	`created_by` text NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "cms_deletion_attempts_status" CHECK("cms_deletion_attempts"."status" IN ('prepared', 'in_flight', 'unknown', 'committed', 'conflict', 'failed')),
	CONSTRAINT "cms_deletion_attempts_result" CHECK(("cms_deletion_attempts"."status" = 'committed' AND "cms_deletion_attempts"."result_commit_sha" IS NOT NULL) OR ("cms_deletion_attempts"."status" != 'committed' AND "cms_deletion_attempts"."result_commit_sha" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cms_deletion_attempts_active_path` ON `cms_deletion_attempts` (`target_path`) WHERE "cms_deletion_attempts"."status" IN ('prepared', 'in_flight', 'unknown');--> statement-breakpoint
CREATE INDEX `cms_deletion_attempts_reconcile` ON `cms_deletion_attempts` (`status`,`updated_at`);