CREATE TABLE `examination` (
  `id` text PRIMARY KEY NOT NULL,
  `organizationId` text NOT NULL REFERENCES `organization`(`id`) ON DELETE CASCADE,
  `title` text NOT NULL,
  `description` text,
  `durationMinutes` integer NOT NULL DEFAULT 60,
  `status` text NOT NULL DEFAULT 'draft',
  `startsAt` integer,
  `endsAt` integer,
  `resultsPublishedAt` integer,
  `createdByUserId` text NOT NULL REFERENCES `user`(`id`),
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `examination_organization_idx` ON `examination` (`organizationId`, `status`);
--> statement-breakpoint
CREATE TABLE `examination_question` (
  `id` text PRIMARY KEY NOT NULL,
  `examinationId` text NOT NULL REFERENCES `examination`(`id`) ON DELETE CASCADE,
  `prompt` text NOT NULL,
  `points` integer NOT NULL DEFAULT 1,
  `position` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `examination_question_exam_idx` ON `examination_question` (`examinationId`, `position`);
--> statement-breakpoint
CREATE TABLE `examination_option` (
  `id` text PRIMARY KEY NOT NULL,
  `questionId` text NOT NULL REFERENCES `examination_question`(`id`) ON DELETE CASCADE,
  `label` text NOT NULL,
  `isCorrect` integer NOT NULL DEFAULT 0,
  `position` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `examination_assignment` (
  `id` text PRIMARY KEY NOT NULL,
  `examinationId` text NOT NULL REFERENCES `examination`(`id`) ON DELETE CASCADE,
  `userId` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `assignedByUserId` text NOT NULL REFERENCES `user`(`id`),
  `createdAt` integer NOT NULL,
  UNIQUE(`examinationId`, `userId`)
);
--> statement-breakpoint
CREATE INDEX `examination_assignment_user_idx` ON `examination_assignment` (`userId`, `examinationId`);
--> statement-breakpoint
CREATE TABLE `examination_attempt` (
  `id` text PRIMARY KEY NOT NULL,
  `assignmentId` text NOT NULL UNIQUE REFERENCES `examination_assignment`(`id`) ON DELETE CASCADE,
  `status` text NOT NULL DEFAULT 'in_progress',
  `startedAt` integer NOT NULL,
  `submittedAt` integer,
  `score` integer,
  `maxScore` integer
);
--> statement-breakpoint
CREATE TABLE `examination_answer` (
  `id` text PRIMARY KEY NOT NULL,
  `attemptId` text NOT NULL REFERENCES `examination_attempt`(`id`) ON DELETE CASCADE,
  `questionId` text NOT NULL REFERENCES `examination_question`(`id`) ON DELETE CASCADE,
  `optionId` text REFERENCES `examination_option`(`id`) ON DELETE SET NULL,
  `updatedAt` integer NOT NULL,
  UNIQUE(`attemptId`, `questionId`)
);
