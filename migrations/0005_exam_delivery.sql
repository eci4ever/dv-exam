CREATE TABLE `examSchedule` (
	`id` text PRIMARY KEY NOT NULL,
	`organizationId` text NOT NULL,
	`examId` text NOT NULL,
	`opensAt` integer NOT NULL,
	`closesAt` integer NOT NULL,
	`cancelledAt` integer,
	`cancelledBy` text,
	`createdBy` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `organization`(`id`) ON DELETE cascade,
	FOREIGN KEY (`examId`) REFERENCES `exam`(`id`) ON DELETE restrict,
	FOREIGN KEY (`cancelledBy`) REFERENCES `user`(`id`) ON DELETE set null,
	FOREIGN KEY (`createdBy`) REFERENCES `user`(`id`) ON DELETE restrict
);
CREATE INDEX `examSchedule_organization_window_idx` ON `examSchedule` (`organizationId`,`opensAt`,`closesAt`);
CREATE INDEX `examSchedule_exam_idx` ON `examSchedule` (`examId`);
CREATE TABLE `examScheduleRecipient` (
	`id` text PRIMARY KEY NOT NULL,
	`scheduleId` text NOT NULL,
	`userId` text NOT NULL,
	`assignedAt` integer NOT NULL,
	FOREIGN KEY (`scheduleId`) REFERENCES `examSchedule`(`id`) ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE cascade
);
CREATE UNIQUE INDEX `examScheduleRecipient_schedule_user_idx` ON `examScheduleRecipient` (`scheduleId`,`userId`);
CREATE INDEX `examScheduleRecipient_user_idx` ON `examScheduleRecipient` (`userId`);
CREATE TABLE `examAttempt` (
	`id` text PRIMARY KEY NOT NULL,
	`scheduleId` text NOT NULL,
	`examId` text NOT NULL,
	`userId` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`submissionReason` text,
	`startedAt` integer NOT NULL,
	`deadlineAt` integer NOT NULL,
	`submittedAt` integer,
	`score` integer,
	`maxScore` integer,
	`percentage` integer,
	`passed` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`scheduleId`) REFERENCES `examSchedule`(`id`) ON DELETE cascade,
	FOREIGN KEY (`examId`) REFERENCES `exam`(`id`) ON DELETE restrict,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE cascade
);
CREATE UNIQUE INDEX `examAttempt_schedule_user_idx` ON `examAttempt` (`scheduleId`,`userId`);
CREATE INDEX `examAttempt_user_status_idx` ON `examAttempt` (`userId`,`status`);
CREATE INDEX `examAttempt_schedule_status_idx` ON `examAttempt` (`scheduleId`,`status`);
CREATE INDEX `examAttempt_organization_usage_idx` ON `examAttempt` (`startedAt`);
CREATE TABLE `examResponse` (
	`id` text PRIMARY KEY NOT NULL,
	`attemptId` text NOT NULL,
	`examItemId` text NOT NULL,
	`selectedOptionId` text,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`attemptId`) REFERENCES `examAttempt`(`id`) ON DELETE cascade,
	FOREIGN KEY (`examItemId`) REFERENCES `examItem`(`id`) ON DELETE restrict,
	FOREIGN KEY (`selectedOptionId`) REFERENCES `examItemOption`(`id`) ON DELETE restrict
);
CREATE UNIQUE INDEX `examResponse_attempt_item_idx` ON `examResponse` (`attemptId`,`examItemId`);
PRAGMA optimize;
