ALTER TABLE `user` ADD `role` text;
--> statement-breakpoint
ALTER TABLE `user` ADD `banned` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `user` ADD `banReason` text;
--> statement-breakpoint
ALTER TABLE `user` ADD `banExpires` integer;
--> statement-breakpoint
ALTER TABLE `session` ADD `impersonatedBy` text;
--> statement-breakpoint
ALTER TABLE `session` ADD `activeOrganizationId` text;
--> statement-breakpoint
CREATE TABLE `organization` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `slug` text NOT NULL UNIQUE,
  `logo` text,
  `metadata` text,
  `createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `member` (
  `id` text PRIMARY KEY NOT NULL,
  `organizationId` text NOT NULL REFERENCES `organization`(`id`) ON DELETE CASCADE,
  `userId` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `role` text NOT NULL DEFAULT 'member',
  `createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invitation` (
  `id` text PRIMARY KEY NOT NULL,
  `organizationId` text NOT NULL REFERENCES `organization`(`id`) ON DELETE CASCADE,
  `email` text NOT NULL,
  `role` text,
  `status` text NOT NULL DEFAULT 'pending',
  `expiresAt` integer NOT NULL,
  `createdAt` integer NOT NULL,
  `inviterId` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `member_organization_id_idx` ON `member` (`organizationId`);
--> statement-breakpoint
CREATE INDEX `member_user_id_idx` ON `member` (`userId`);
--> statement-breakpoint
CREATE INDEX `invitation_organization_id_idx` ON `invitation` (`organizationId`);
--> statement-breakpoint
CREATE INDEX `invitation_email_idx` ON `invitation` (`email`);
