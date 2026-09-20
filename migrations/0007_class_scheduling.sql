ALTER TABLE `examSchedule` ADD `audienceMode` text DEFAULT 'all_students' NOT NULL;
CREATE TABLE `examScheduleClass` (
	`id` text PRIMARY KEY NOT NULL,
	`scheduleId` text NOT NULL,
	`classId` text NOT NULL,
	FOREIGN KEY (`scheduleId`) REFERENCES `examSchedule`(`id`) ON DELETE cascade,
	FOREIGN KEY (`classId`) REFERENCES `academicClass`(`id`) ON DELETE restrict
);
CREATE UNIQUE INDEX `examScheduleClass_schedule_class_idx` ON `examScheduleClass` (`scheduleId`,`classId`);
CREATE INDEX `examScheduleClass_class_idx` ON `examScheduleClass` (`classId`);
PRAGMA optimize;
