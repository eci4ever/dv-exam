CREATE TABLE `platformPlan` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text NOT NULL,
	`memberLimit` integer NOT NULL,
	`activeExamLimit` integer NOT NULL,
	`monthlyAttemptLimit` integer NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
CREATE UNIQUE INDEX `platformPlan_slug_unique` ON `platformPlan` (`slug`);
CREATE INDEX `platformPlan_active_idx` ON `platformPlan` (`isActive`);

CREATE TABLE `organizationEntitlement` (
	`organizationId` text PRIMARY KEY NOT NULL,
	`planId` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`suspensionReason` text,
	`suspendedAt` integer,
	`suspendedBy` text,
	`assignedAt` integer NOT NULL,
	`assignedBy` text,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`planId`) REFERENCES `platformPlan`(`id`) ON UPDATE no action ON DELETE restrict
);
CREATE INDEX `organizationEntitlement_plan_idx` ON `organizationEntitlement` (`planId`);
CREATE INDEX `organizationEntitlement_status_idx` ON `organizationEntitlement` (`status`);

CREATE TABLE `platformSettings` (
	`id` text PRIMARY KEY NOT NULL,
	`publicSignupEnabled` integer DEFAULT true NOT NULL,
	`defaultPlanId` text NOT NULL,
	`maintenanceEnabled` integer DEFAULT false NOT NULL,
	`maintenanceMessage` text,
	`updatedAt` integer NOT NULL,
	`updatedBy` text,
	FOREIGN KEY (`defaultPlanId`) REFERENCES `platformPlan`(`id`) ON UPDATE no action ON DELETE restrict
);

CREATE TABLE `auditEvent` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`type` text NOT NULL,
	`result` text NOT NULL,
	`actorUserId` text,
	`effectiveUserId` text,
	`targetType` text,
	`targetId` text,
	`organizationId` text,
	`sessionId` text,
	`userAgent` text,
	`metadata` text,
	`createdAt` integer NOT NULL
);
CREATE INDEX `auditEvent_createdAt_idx` ON `auditEvent` (`createdAt`);
CREATE INDEX `auditEvent_type_idx` ON `auditEvent` (`type`);
CREATE INDEX `auditEvent_actor_idx` ON `auditEvent` (`actorUserId`);
CREATE INDEX `auditEvent_organization_idx` ON `auditEvent` (`organizationId`);

PRAGMA optimize;
