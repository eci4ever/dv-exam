CREATE INDEX `examination_organization_updated_at_idx`
  ON `examination` (`organizationId`, `updatedAt` DESC);
--> statement-breakpoint
CREATE INDEX `invitation_organization_status_created_at_idx`
  ON `invitation` (`organizationId`, `status`, `createdAt` DESC);
--> statement-breakpoint
CREATE INDEX `member_organization_user_idx`
  ON `member` (`organizationId`, `userId`);
