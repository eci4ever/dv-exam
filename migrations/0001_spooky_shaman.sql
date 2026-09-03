PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_exam_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_exam_sessions`("id", "name", "starts_at", "ends_at", "status", "created_at") SELECT "id", "name", "starts_at", "ends_at", "status", "created_at" FROM `exam_sessions`;--> statement-breakpoint
DROP TABLE `exam_sessions`;--> statement-breakpoint
ALTER TABLE `__new_exam_sessions` RENAME TO `exam_sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;