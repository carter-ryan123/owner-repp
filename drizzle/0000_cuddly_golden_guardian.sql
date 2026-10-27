CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`buyer_id` text NOT NULL,
	`seller_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `favorites` (
	`user_id` text NOT NULL,
	`listing_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `listing_id`)
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`condition` text NOT NULL,
	`mode` text NOT NULL,
	`price` integer NOT NULL,
	`trade_for` text DEFAULT '' NOT NULL,
	`image` text DEFAULT '' NOT NULL,
	`school` text NOT NULL,
	`city` text NOT NULL,
	`zip` text NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `listings_owner` ON `listings` (`owner_id`);--> statement-breakpoint
CREATE INDEX `listings_created` ON `listings` (`created_at`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `messages_conversation` ON `messages` (`conversation_id`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`school` text NOT NULL,
	`city` text NOT NULL,
	`zip` text NOT NULL,
	`school_type` text NOT NULL
);
