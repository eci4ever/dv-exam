ALTER TABLE `examSchedule` ADD `classSnapshotCapturedAt` integer;
CREATE TABLE `examScheduleRecipientClass` (
	`id` text PRIMARY KEY NOT NULL,
	`recipientId` text NOT NULL,
	`classId` text NOT NULL,
	FOREIGN KEY (`recipientId`) REFERENCES `examScheduleRecipient`(`id`) ON DELETE cascade,
	FOREIGN KEY (`classId`) REFERENCES `academicClass`(`id`) ON DELETE restrict
);
CREATE UNIQUE INDEX `examScheduleRecipientClass_recipient_class_idx` ON `examScheduleRecipientClass` (`recipientId`,`classId`);
CREATE INDEX `examScheduleRecipientClass_class_idx` ON `examScheduleRecipientClass` (`classId`);
CREATE INDEX `examAttempt_reporting_idx` ON `examAttempt` (`scheduleId`,`status`,`percentage`);
CREATE INDEX `examResponse_item_option_idx` ON `examResponse` (`examItemId`,`selectedOptionId`);
PRAGMA optimize;
