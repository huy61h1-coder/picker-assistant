CREATE TABLE `planogram_products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`planogram_id` text NOT NULL,
	`aisle_key` text NOT NULL,
	`line_id` text NOT NULL,
	`side` text NOT NULL,
	`loc_id` integer NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`marker_x` real,
	`marker_y` real,
	`created_at` text NOT NULL,
	FOREIGN KEY (`planogram_id`) REFERENCES `planograms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_planogram_products_sku` ON `planogram_products` (`sku`);--> statement-breakpoint
CREATE INDEX `idx_planogram_products_aisle_loc` ON `planogram_products` (`aisle_key`,`loc_id`);--> statement-breakpoint
CREATE TABLE `planograms` (
	`id` text PRIMARY KEY NOT NULL,
	`aisle_key` text NOT NULL,
	`line_id` text NOT NULL,
	`side` text NOT NULL,
	`file_name` text NOT NULL,
	`pdf_key` text NOT NULL,
	`visual_key` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`page_number` integer DEFAULT 1 NOT NULL,
	`page_count` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_planograms_aisle_key` ON `planograms` (`aisle_key`);