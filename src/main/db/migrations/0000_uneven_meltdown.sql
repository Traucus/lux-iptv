CREATE TABLE `episodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`series_id` integer NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`season` integer NOT NULL,
	`episode` integer NOT NULL,
	`cover` text,
	`enrichment_status` text DEFAULT 'pending' NOT NULL,
	`added_at` integer NOT NULL,
	FOREIGN KEY (`series_id`) REFERENCES `series`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `episodes_url_unique` ON `episodes` (`url`);--> statement-breakpoint
CREATE INDEX `episodes_series_idx` ON `episodes` (`series_id`);--> statement-breakpoint
CREATE INDEX `episodes_season_episode_idx` ON `episodes` (`series_id`,`season`,`episode`);--> statement-breakpoint
CREATE TABLE `live_channels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`xtream_id` integer,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`group_title` text,
	`tvg_id` text,
	`tvg_logo` text,
	`stream_type` text DEFAULT 'live' NOT NULL,
	`enrichment_status` text DEFAULT 'pending' NOT NULL,
	`added_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `live_channels_url_unique` ON `live_channels` (`url`);--> statement-breakpoint
CREATE UNIQUE INDEX `live_xtream_id_uq` ON `live_channels` (`xtream_id`) WHERE "live_channels"."xtream_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `live_name_idx` ON `live_channels` (`name`);--> statement-breakpoint
CREATE INDEX `live_group_idx` ON `live_channels` (`group_title`);--> statement-breakpoint
CREATE TABLE `schema_version` (
	`version` integer PRIMARY KEY NOT NULL,
	`applied_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `series` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`xtream_id` integer,
	`name` text NOT NULL,
	`group_title` text,
	`cover` text,
	`stream_type` text DEFAULT 'series' NOT NULL,
	`year` integer,
	`enrichment_status` text DEFAULT 'pending' NOT NULL,
	`added_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `series_xtream_id_uq` ON `series` (`xtream_id`) WHERE "series"."xtream_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `series_name_idx` ON `series` (`name`);--> statement-breakpoint
CREATE INDEX `series_group_idx` ON `series` (`group_title`);--> statement-breakpoint
CREATE TABLE `vod_movies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`xtream_id` integer,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`group_title` text,
	`cover` text,
	`stream_type` text DEFAULT 'movie' NOT NULL,
	`year` integer,
	`enrichment_status` text DEFAULT 'pending' NOT NULL,
	`added_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vod_movies_url_unique` ON `vod_movies` (`url`);--> statement-breakpoint
CREATE UNIQUE INDEX `vod_xtream_id_uq` ON `vod_movies` (`xtream_id`) WHERE "vod_movies"."xtream_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `vod_name_idx` ON `vod_movies` (`name`);--> statement-breakpoint
CREATE INDEX `vod_group_idx` ON `vod_movies` (`group_title`);