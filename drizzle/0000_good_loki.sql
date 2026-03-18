CREATE TABLE `office_activity_feed` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`agent_id` text,
	`room_id` text,
	`message` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `office_agents`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`room_id`) REFERENCES `office_rooms`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `office_agents` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`team` text NOT NULL,
	`internal_staff` integer DEFAULT true NOT NULL,
	`office_visible` integer DEFAULT true NOT NULL,
	`character_id` text,
	`sprite_sheet` text,
	`system_prompt` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `office_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`target_agent_id` text NOT NULL,
	`task_title` text NOT NULL,
	`task_brief` text NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`routing_target` text DEFAULT 'work_tracker' NOT NULL,
	`source` text DEFAULT 'office_ui' NOT NULL,
	`result` text,
	`completed_at` text,
	`duration_ms` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`target_agent_id`) REFERENCES `office_agents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `office_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`detail` text NOT NULL,
	`status` text DEFAULT 'proposed' NOT NULL,
	`proposed_by` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`proposed_by`) REFERENCES `office_agents`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `office_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`from_agent_id` text NOT NULL,
	`to_agent_id` text,
	`room_id` text,
	`message` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`from_agent_id`) REFERENCES `office_agents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_agent_id`) REFERENCES `office_agents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`room_id`) REFERENCES `office_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `office_presence` (
	`agent_id` text PRIMARY KEY NOT NULL,
	`presence_state` text DEFAULT 'available' NOT NULL,
	`effective_presence_state` text DEFAULT 'available' NOT NULL,
	`critical_task` integer DEFAULT false NOT NULL,
	`focus` text,
	`collaboration_mode` text,
	`office_hours_timezone` text DEFAULT 'Europe/Berlin' NOT NULL,
	`office_hours_days` text DEFAULT 'Monday-Friday' NOT NULL,
	`office_hours_window` text DEFAULT '09:00-17:00' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `office_agents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `office_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`team` text NOT NULL,
	`purpose` text,
	`zone_x` real NOT NULL,
	`zone_y` real NOT NULL,
	`zone_w` real NOT NULL,
	`zone_h` real NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `office_webhook_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`webhook_id` text NOT NULL,
	`event` text NOT NULL,
	`status_code` integer,
	`delivered_at` text NOT NULL,
	FOREIGN KEY (`webhook_id`) REFERENCES `office_webhooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `office_webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`secret` text DEFAULT '' NOT NULL,
	`events` text DEFAULT '[]' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `office_world_entities` (
	`agent_id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`anchor_x_pct` real NOT NULL,
	`anchor_y_pct` real NOT NULL,
	`facing` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `office_agents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`room_id`) REFERENCES `office_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
