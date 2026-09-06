CREATE INDEX `platform_audit_log_action_created_at_idx`
  ON `platform_audit_log` (`action`, `createdAt` DESC);
--> statement-breakpoint
CREATE INDEX `platform_audit_log_actor_created_at_idx`
  ON `platform_audit_log` (`actorUserId`, `createdAt` DESC);
--> statement-breakpoint
CREATE INDEX `platform_audit_log_target_created_at_idx`
  ON `platform_audit_log` (`targetId`, `createdAt` DESC);
