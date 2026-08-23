CREATE TABLE `ingredient_cost_history` (
	`id` text PRIMARY KEY NOT NULL,
	`ingredient_id` text NOT NULL,
	`business_id` text NOT NULL,
	`cost_per_base_unit` real NOT NULL,
	`effective_from` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ingredient_cost_history_ingredient_id_idx` ON `ingredient_cost_history` (`ingredient_id`);--> statement-breakpoint
CREATE INDEX `ingredient_cost_history_business_id_idx` ON `ingredient_cost_history` (`business_id`);--> statement-breakpoint
CREATE INDEX `ingredient_cost_history_effective_from_idx` ON `ingredient_cost_history` (`effective_from`);--> statement-breakpoint
CREATE TABLE `ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`base_unit` text NOT NULL,
	`current_cost` real NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ingredients_business_id_idx` ON `ingredients` (`business_id`);--> statement-breakpoint
CREATE TABLE `product_cost_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`product_id` text NOT NULL,
	`total_cost` real NOT NULL,
	`calculation_basis` text NOT NULL,
	`effective_from` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `product_cost_versions_product_id_idx` ON `product_cost_versions` (`product_id`);--> statement-breakpoint
CREATE INDEX `product_cost_versions_business_id_idx` ON `product_cost_versions` (`business_id`);--> statement-breakpoint
CREATE INDEX `product_cost_versions_effective_from_idx` ON `product_cost_versions` (`effective_from`);--> statement-breakpoint
CREATE TABLE `product_recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`business_id` text NOT NULL,
	`quantity` real NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `product_recipes_product_id_idx` ON `product_recipes` (`product_id`);--> statement-breakpoint
CREATE INDEX `product_recipes_ingredient_id_idx` ON `product_recipes` (`ingredient_id`);--> statement-breakpoint
CREATE INDEX `product_recipes_business_id_idx` ON `product_recipes` (`business_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text,
	`current_selling_price` real,
	`current_hpp` real,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `products_business_id_idx` ON `products` (`business_id`);--> statement-breakpoint
CREATE TABLE `selling_price_history` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`product_id` text NOT NULL,
	`selling_price` real NOT NULL,
	`effective_from` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `selling_price_history_product_id_idx` ON `selling_price_history` (`product_id`);--> statement-breakpoint
CREATE INDEX `selling_price_history_business_id_idx` ON `selling_price_history` (`business_id`);--> statement-breakpoint
CREATE INDEX `selling_price_history_effective_from_idx` ON `selling_price_history` (`effective_from`);