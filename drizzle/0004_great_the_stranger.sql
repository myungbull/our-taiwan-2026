ALTER TABLE `weather_cache` ADD `accuweather_json` text;--> statement-breakpoint
ALTER TABLE `weather_cache` ADD `accuweather_failures` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `weather_cache` ADD `accuweather_next_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `weather_cache` ADD `accuweather_location_key` text;