CREATE TABLE `question` (
	`id` text PRIMARY KEY NOT NULL,
	`organizationId` text NOT NULL,
	`authorId` text NOT NULL,
	`type` text NOT NULL,
	`prompt` text NOT NULL,
	`explanation` text,
	`difficulty` text NOT NULL,
	`defaultMarks` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `organization`(`id`) ON DELETE cascade,
	FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON DELETE restrict
);
CREATE INDEX `question_organization_status_idx` ON `question` (`organizationId`,`status`);
CREATE INDEX `question_author_idx` ON `question` (`authorId`);
CREATE TABLE `questionOption` (
	`id` text PRIMARY KEY NOT NULL,
	`questionId` text NOT NULL,
	`text` text NOT NULL,
	`isCorrect` integer NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`questionId`) REFERENCES `question`(`id`) ON DELETE cascade
);
CREATE UNIQUE INDEX `questionOption_question_position_idx` ON `questionOption` (`questionId`,`position`);
CREATE TABLE `questionTag` (
	`id` text PRIMARY KEY NOT NULL,
	`questionId` text NOT NULL,
	`tag` text NOT NULL,
	FOREIGN KEY (`questionId`) REFERENCES `question`(`id`) ON DELETE cascade
);
CREATE UNIQUE INDEX `questionTag_question_tag_idx` ON `questionTag` (`questionId`,`tag`);
CREATE INDEX `questionTag_tag_idx` ON `questionTag` (`tag`);
CREATE TABLE `exam` (
	`id` text PRIMARY KEY NOT NULL,
	`organizationId` text NOT NULL,
	`seriesId` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`durationMinutes` integer NOT NULL,
	`passingPercentage` integer NOT NULL,
	`shuffleQuestions` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`createdBy` text NOT NULL,
	`publishedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `organization`(`id`) ON DELETE cascade,
	FOREIGN KEY (`createdBy`) REFERENCES `user`(`id`) ON DELETE restrict
);
CREATE UNIQUE INDEX `exam_series_version_idx` ON `exam` (`seriesId`,`version`);
CREATE UNIQUE INDEX `exam_series_open_draft_idx` ON `exam` (`seriesId`) WHERE `status` = 'draft';
CREATE INDEX `exam_organization_status_idx` ON `exam` (`organizationId`,`status`);
CREATE TABLE `examItem` (
	`id` text PRIMARY KEY NOT NULL,
	`examId` text NOT NULL,
	`sourceQuestionId` text,
	`type` text NOT NULL,
	`prompt` text NOT NULL,
	`explanation` text,
	`difficulty` text NOT NULL,
	`marks` integer NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`examId`) REFERENCES `exam`(`id`) ON DELETE cascade,
	FOREIGN KEY (`sourceQuestionId`) REFERENCES `question`(`id`) ON DELETE set null
);
CREATE UNIQUE INDEX `examItem_exam_position_idx` ON `examItem` (`examId`,`position`);
CREATE INDEX `examItem_sourceQuestion_idx` ON `examItem` (`sourceQuestionId`);
CREATE TABLE `examItemOption` (
	`id` text PRIMARY KEY NOT NULL,
	`examItemId` text NOT NULL,
	`text` text NOT NULL,
	`isCorrect` integer NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`examItemId`) REFERENCES `examItem`(`id`) ON DELETE cascade
);
CREATE UNIQUE INDEX `examItemOption_item_position_idx` ON `examItemOption` (`examItemId`,`position`);
PRAGMA optimize;
