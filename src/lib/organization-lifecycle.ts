import { createServerOnlyFn } from "@tanstack/react-start";
import { and, count, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { assertWorkspaceDeletionAllowed } from "@/lib/workspace-governance-policy";

export const deleteOrganizationLifecycle = createServerOnlyFn(
	async (organizationId: string) => {
		const now = new Date();
		const [activeSchedules, attempts] = await Promise.all([
			db
				.select({ count: count() })
				.from(schema.examSchedule)
				.where(
					and(
						eq(schema.examSchedule.organizationId, organizationId),
						isNull(schema.examSchedule.cancelledAt),
						gt(schema.examSchedule.closesAt, now),
					),
				),
			db
				.select({ count: count() })
				.from(schema.examAttempt)
				.innerJoin(
					schema.examSchedule,
					eq(schema.examSchedule.id, schema.examAttempt.scheduleId),
				)
				.where(
					and(
						eq(schema.examSchedule.organizationId, organizationId),
						eq(schema.examAttempt.status, "in_progress"),
					),
				),
		]);
		assertWorkspaceDeletionAllowed({
			scheduledOrOpenSchedules: activeSchedules[0]?.count ?? 0,
			inProgressAttempts: attempts[0]?.count ?? 0,
		});
		await db.batch([
			db
				.update(schema.session)
				.set({ activeOrganizationId: null })
				.where(eq(schema.session.activeOrganizationId, organizationId)),
			db
				.delete(schema.invitation)
				.where(eq(schema.invitation.organizationId, organizationId)),
			db
				.delete(schema.member)
				.where(eq(schema.member.organizationId, organizationId)),
			db
				.delete(schema.organization)
				.where(eq(schema.organization.id, organizationId)),
		]);
		return { organizationId };
	},
);
