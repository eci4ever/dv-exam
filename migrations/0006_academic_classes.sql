CREATE TABLE `academicClass` (
	`id` text PRIMARY KEY NOT NULL,
	`organizationId` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`createdBy` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `organization`(`id`) ON DELETE cascade,
	FOREIGN KEY (`createdBy`) REFERENCES `user`(`id`) ON DELETE restrict
);
CREATE UNIQUE INDEX `academicClass_organization_code_idx` ON `academicClass` (`organizationId`,`code`);
CREATE INDEX `academicClass_organization_status_idx` ON `academicClass` (`organizationId`,`status`);
CREATE TABLE `academicClassMember` (
	`id` text PRIMARY KEY NOT NULL,
	`classId` text NOT NULL,
	`memberId` text NOT NULL,
	`role` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`classId`) REFERENCES `academicClass`(`id`) ON DELETE cascade,
	FOREIGN KEY (`memberId`) REFERENCES `member`(`id`) ON DELETE cascade
);
CREATE UNIQUE INDEX `academicClassMember_class_member_idx` ON `academicClassMember` (`classId`,`memberId`);
CREATE INDEX `academicClassMember_class_role_idx` ON `academicClassMember` (`classId`,`role`);
CREATE INDEX `academicClassMember_member_idx` ON `academicClassMember` (`memberId`);
PRAGMA optimize;
