CREATE TABLE `idea_votes` (
	`idea_id` text NOT NULL,
	`slot_id` text NOT NULL,
	`user_id` text NOT NULL,
	`response` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`idea_id`, `slot_id`, `user_id`),
	FOREIGN KEY (`idea_id`) REFERENCES `ideas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idea_votes_idea_slot_idx` ON `idea_votes` (`idea_id`,`slot_id`);--> statement-breakpoint
CREATE TABLE `ideas` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`place` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`preferred_date` text,
	`suggestions` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ideas_updated_at_idx` ON `ideas` (`updated_at`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_date` text NOT NULL,
	`place` text DEFAULT '' NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`uploader_id` text NOT NULL,
	`uploader_label` text NOT NULL,
	`uploaded_at` text NOT NULL,
	`object_key` text NOT NULL,
	`byte_size` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photos_object_key_unique` ON `photos` (`object_key`);--> statement-breakpoint
CREATE INDEX `photos_trip_date_idx` ON `photos` (`trip_date`,`uploaded_at`);