CREATE TABLE `usage_counters` (
	`period` text NOT NULL,
	`kind` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`period`, `kind`)
);
