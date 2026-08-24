CREATE TABLE `master_products` (
	`id` text PRIMARY KEY NOT NULL,
	`sku` text NOT NULL,
	`barcode` text DEFAULT '' NOT NULL,
	`name` text NOT NULL,
	`line` text NOT NULL,
	`loc_id` integer,
	`price` integer DEFAULT 0 NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`loss` integer DEFAULT 0 NOT NULL,
	`exp_date` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_master_products_sku` ON `master_products` (`sku`);
--> statement-breakpoint
CREATE INDEX `idx_master_products_line` ON `master_products` (`line`);
--> statement-breakpoint
PRAGMA optimize;
