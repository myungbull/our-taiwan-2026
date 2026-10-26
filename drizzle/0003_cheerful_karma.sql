CREATE TABLE `weather_cache` (
	`region` text PRIMARY KEY NOT NULL,
	`primary_json` text,
	`fallback_json` text,
	`primary_failures` integer DEFAULT 0 NOT NULL,
	`primary_next_at` integer DEFAULT 0 NOT NULL,
	`fallback_next_at` integer DEFAULT 0 NOT NULL,
	`lease_token` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`last_error` text
);
