CREATE TABLE `billing_customers` (
	`user_id` text PRIMARY KEY NOT NULL,
	`stripe_customer_id` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_customers_stripe_customer_id_unique` ON `billing_customers` (`stripe_customer_id`);--> statement-breakpoint
CREATE TABLE `billing_events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`processed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `checkout_intents` (
	`user_id` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`session_id` text DEFAULT '' NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `featured_listings` (
	`user_id` text NOT NULL,
	`listing_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `listing_id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`user_id` text PRIMARY KEY NOT NULL,
	`stripe_subscription_id` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`source` text DEFAULT 'stripe' NOT NULL,
	`current_period_end` integer NOT NULL,
	`cancel_at_period_end` integer DEFAULT 0 NOT NULL,
	`risk_hold` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
