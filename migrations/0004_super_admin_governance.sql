CREATE TABLE `platform_organization` (
  `organizationId` text PRIMARY KEY NOT NULL REFERENCES `organization`(`id`) ON DELETE CASCADE,
  `status` text NOT NULL DEFAULT 'active',
  `archivedAt` integer,
  `updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `platform_audit_log` (
  `id` text PRIMARY KEY NOT NULL,
  `actorUserId` text NOT NULL REFERENCES `user`(`id`),
  `action` text NOT NULL,
  `targetType` text NOT NULL,
  `targetId` text,
  `reason` text NOT NULL,
  `outcome` text NOT NULL,
  `metadata` text,
  `createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `platform_audit_log_created_at_idx` ON `platform_audit_log` (`createdAt` DESC);
--> statement-breakpoint
CREATE INDEX `platform_audit_log_actor_idx` ON `platform_audit_log` (`actorUserId`);
--> statement-breakpoint
CREATE TABLE `platform_setting` (
  `key` text PRIMARY KEY NOT NULL,
  `value` text NOT NULL,
  `updatedByUserId` text NOT NULL REFERENCES `user`(`id`),
  `updatedAt` integer NOT NULL
);
