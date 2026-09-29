UPDATE `user`
SET `role` = replace(`role`, 'admin', 'platform_admin')
WHERE `role` = 'admin';

ALTER TABLE `platformPlan` ADD `priceCents` integer NOT NULL DEFAULT 0;
ALTER TABLE `platformPlan` ADD `currency` text NOT NULL DEFAULT 'MYR';
ALTER TABLE `platformPlan` ADD `billingInterval` text NOT NULL DEFAULT 'month';
ALTER TABLE `platformPlan` ADD `trialDays` integer NOT NULL DEFAULT 0;
ALTER TABLE `platformPlan` ADD `isPublic` integer NOT NULL DEFAULT 1;
ALTER TABLE `platformPlan` ADD `providerPriceId` text;

CREATE TABLE `organizationSubscription` (
	`id` text PRIMARY KEY NOT NULL,
	`organizationId` text NOT NULL UNIQUE,
	`planId` text NOT NULL,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`provider` text,
	`providerCustomerId` text,
	`providerSubscriptionId` text,
	`currentPeriodStart` integer,
	`currentPeriodEnd` integer,
	`trialEndsAt` integer,
	`cancelAtPeriodEnd` integer NOT NULL DEFAULT 0,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`planId`) REFERENCES `platformPlan`(`id`) ON UPDATE no action ON DELETE restrict
);

CREATE INDEX `organizationSubscription_plan_idx` ON `organizationSubscription` (`planId`);
CREATE INDEX `organizationSubscription_status_idx` ON `organizationSubscription` (`status`);
CREATE UNIQUE INDEX `organizationSubscription_provider_subscription_idx` ON `organizationSubscription` (`providerSubscriptionId`);

INSERT INTO `organizationSubscription` (
	`id`, `organizationId`, `planId`, `status`, `source`, `createdAt`, `updatedAt`
)
SELECT
	'sub-legacy-' || `organizationId`,
	`organizationId`,
	`planId`,
	CASE WHEN `status` = 'suspended' THEN 'suspended' ELSE 'active' END,
	'legacy',
	`assignedAt`,
	`updatedAt`
FROM `organizationEntitlement`;
