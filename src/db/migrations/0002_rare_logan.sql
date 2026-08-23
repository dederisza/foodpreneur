CREATE TABLE `capital_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`transaction_date` text NOT NULL,
	`amount` real NOT NULL,
	`source` text,
	`notes` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `capital_transactions_business_id_idx` ON `capital_transactions` (`business_id`);--> statement-breakpoint
CREATE INDEX `capital_transactions_transaction_date_idx` ON `capital_transactions` (`transaction_date`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`transaction_date` text NOT NULL,
	`amount` real NOT NULL,
	`category` text NOT NULL,
	`description` text,
	`notes` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `expenses_business_id_idx` ON `expenses` (`business_id`);--> statement-breakpoint
CREATE INDEX `expenses_transaction_date_idx` ON `expenses` (`transaction_date`);--> statement-breakpoint
CREATE TABLE `owner_drawings` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`transaction_date` text NOT NULL,
	`amount` real NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `owner_drawings_business_id_idx` ON `owner_drawings` (`business_id`);--> statement-breakpoint
CREATE INDEX `owner_drawings_transaction_date_idx` ON `owner_drawings` (`transaction_date`);--> statement-breakpoint
CREATE TABLE `sale_items` (
	`id` text PRIMARY KEY NOT NULL,
	`sale_id` text NOT NULL,
	`business_id` text NOT NULL,
	`product_id` text NOT NULL,
	`product_name_snapshot` text NOT NULL,
	`quantity` real NOT NULL,
	`selling_price_snapshot` real NOT NULL,
	`hpp_snapshot` real NOT NULL,
	`subtotal` real NOT NULL,
	`total_hpp` real NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `sale_items_sale_id_idx` ON `sale_items` (`sale_id`);--> statement-breakpoint
CREATE INDEX `sale_items_business_id_idx` ON `sale_items` (`business_id`);--> statement-breakpoint
CREATE INDEX `sale_items_product_id_idx` ON `sale_items` (`product_id`);--> statement-breakpoint
CREATE TABLE `sales` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`transaction_date` text NOT NULL,
	`transaction_number` text NOT NULL,
	`total_amount` real NOT NULL,
	`total_hpp` real NOT NULL,
	`payment_method` text,
	`notes` text,
	`status` text DEFAULT 'completed' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sales_business_id_idx` ON `sales` (`business_id`);--> statement-breakpoint
CREATE INDEX `sales_transaction_date_idx` ON `sales` (`transaction_date`);