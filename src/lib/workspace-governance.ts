import { createServerFn } from "@tanstack/react-start";
import { and, asc, count, eq, gt, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { ensurePlatformData, requireAccountSession } from "@/lib/platform-core";
import {
	getUsageHealth,
	workspaceAudience,
} from "@/lib/workspace-governance-policy";

export interface WorkspaceUsage {
	members: { used: number; limit: number };
	activeExams: { used: number; limit: number };
	monthlyAttempts: { used: number; limit: number };
	health: ReturnType<typeof getUsageHealth>;
}

async function workspaceContext() {
	const { headers, session } = await requireAccountSession();
	await ensurePlatformData();
	const { auth } = await import("@/lib/auth");
	const organizations = await auth.api.listOrganizations({ headers });
	const organizationId =
		session.session.activeOrganizationId ?? organizations[0]?.id;
	if (!organizationId) throw new Error("Select a workspace to continue.");
	const [membership] = await db
		.select({ id: schema.member.id, role: schema.member.role })
		.from(schema.member)
		.where(
			and(
				eq(schema.member.organizationId, organizationId),
				eq(schema.member.userId, session.user.id),
			),
		)
		.limit(1);
	if (!membership) throw new Error("Workspace access is required.");
	return { headers, session, organizationId, membership };
}

function monthWindow(now: Date) {
	return {
		start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
		end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
	};
}

async function workspaceUsage(organizationId: string, now = new Date()) {
	const month = monthWindow(now);
	const [row] = await db
		.select({
			status: schema.organizationEntitlement.status,
			planId: schema.platformPlan.id,
			planName: schema.platformPlan.name,
			planDescription: schema.platformPlan.description,
			memberLimit: schema.platformPlan.memberLimit,
			activeExamLimit: schema.platformPlan.activeExamLimit,
			monthlyAttemptLimit: schema.platformPlan.monthlyAttemptLimit,
			members: sql<number>`(select count(*) from ${schema.member} member where member.organizationId = ${organizationId})`,
			activeExams: sql<number>`(select count(*) from ${schema.examSchedule} schedule where schedule.organizationId = ${organizationId} and schedule.cancelledAt is null and schedule.opensAt <= ${now.getTime()} and schedule.closesAt > ${now.getTime()})`,
			monthlyAttempts: sql<number>`(select count(*) from ${schema.examAttempt} attempt inner join ${schema.examSchedule} schedule on schedule.id = attempt.scheduleId where schedule.organizationId = ${organizationId} and attempt.startedAt >= ${month.start.getTime()} and attempt.startedAt < ${month.end.getTime()})`,
		})
		.from(schema.organizationEntitlement)
		.innerJoin(
			schema.platformPlan,
			eq(schema.platformPlan.id, schema.organizationEntitlement.planId),
		)
		.where(eq(schema.organizationEntitlement.organizationId, organizationId))
		.limit(1);
	if (!row) throw new Error("Workspace plan is unavailable.");
	const usage: WorkspaceUsage = {
		members: { used: row.members, limit: row.memberLimit },
		activeExams: { used: row.activeExams, limit: row.activeExamLimit },
		monthlyAttempts: {
			used: row.monthlyAttempts,
			limit: row.monthlyAttemptLimit,
		},
		health: getUsageHealth({
			status: row.status,
			usage: [
				{ used: row.members, limit: row.memberLimit },
				{ used: row.activeExams, limit: row.activeExamLimit },
				{ used: row.monthlyAttempts, limit: row.monthlyAttemptLimit },
			],
		}),
	};
	return {
		status: row.status,
		plan: {
			id: row.planId,
			name: row.planName,
			description: row.planDescription,
		},
		usage,
		calculatedAt: now,
	};
}

export const getWorkspaceOverview = createServerFn({ method: "GET" }).handler(
	async () => {
		const context = await workspaceContext();
		const now = new Date();
		const audience = workspaceAudience(context.membership.role);
		const [organization] = await db
			.select()
			.from(schema.organization)
			.where(eq(schema.organization.id, context.organizationId))
			.limit(1);
		if (!organization) throw new Error("Workspace not found.");
		const plan = await workspaceUsage(context.organizationId, now);

		if (audience === "manager") {
			const [counts, recentSchedules] = await Promise.all([
				db
					.select({
						activeClasses: sql<number>`(select count(*) from ${schema.academicClass} class where class.organizationId = ${context.organizationId} and class.status = 'active')`,
						pendingInvitations: sql<number>`(select count(*) from ${schema.invitation} invitation where invitation.organizationId = ${context.organizationId} and invitation.status = 'pending' and invitation.expiresAt > ${now.getTime()})`,
					})
					.from(schema.organization)
					.where(eq(schema.organization.id, context.organizationId))
					.limit(1)
					.then(
						(rows) => rows[0] ?? { activeClasses: 0, pendingInvitations: 0 },
					),
				db
					.select({
						id: schema.examSchedule.id,
						title: schema.exam.title,
						opensAt: schema.examSchedule.opensAt,
						closesAt: schema.examSchedule.closesAt,
					})
					.from(schema.examSchedule)
					.innerJoin(
						schema.exam,
						eq(schema.exam.id, schema.examSchedule.examId),
					)
					.where(
						and(
							eq(schema.examSchedule.organizationId, context.organizationId),
							gt(schema.examSchedule.closesAt, now),
							isNull(schema.examSchedule.cancelledAt),
						),
					)
					.orderBy(asc(schema.examSchedule.opensAt))
					.limit(5),
			]);
			return {
				organization,
				role: context.membership.role,
				audience,
				...plan,
				metrics: {
					members: plan.usage.members.used,
					activeClasses: counts.activeClasses,
					activeExams: plan.usage.activeExams.used,
					monthlyAttempts: plan.usage.monthlyAttempts.used,
					pendingInvitations: counts.pendingInvitations,
				},
				recent: recentSchedules,
			};
		}

		if (audience === "teacher") {
			const classRows = await db
				.select({ id: schema.academicClass.id })
				.from(schema.academicClassMember)
				.innerJoin(
					schema.academicClass,
					eq(schema.academicClass.id, schema.academicClassMember.classId),
				)
				.where(
					and(
						eq(schema.academicClassMember.memberId, context.membership.id),
						eq(schema.academicClassMember.role, "teacher"),
						eq(schema.academicClass.status, "active"),
					),
				);
			const classIds = classRows.map((item) => item.id);
			const recent = classIds.length
				? await db
						.selectDistinct({
							id: schema.examSchedule.id,
							title: schema.exam.title,
							opensAt: schema.examSchedule.opensAt,
							closesAt: schema.examSchedule.closesAt,
						})
						.from(schema.examScheduleClass)
						.innerJoin(
							schema.examSchedule,
							eq(schema.examSchedule.id, schema.examScheduleClass.scheduleId),
						)
						.innerJoin(
							schema.exam,
							eq(schema.exam.id, schema.examSchedule.examId),
						)
						.where(
							and(
								inArray(schema.examScheduleClass.classId, classIds),
								gt(schema.examSchedule.closesAt, now),
							),
						)
						.orderBy(asc(schema.examSchedule.opensAt))
						.limit(5)
				: [];
			const [participation] = classIds.length
				? await db
						.select({
							recipients: count(schema.examScheduleRecipient.id),
							completed: sql<number>`sum(case when ${schema.examAttempt.status} in ('submitted', 'timed_out') then 1 else 0 end)`,
						})
						.from(schema.examScheduleRecipientClass)
						.innerJoin(
							schema.examScheduleRecipient,
							eq(
								schema.examScheduleRecipient.id,
								schema.examScheduleRecipientClass.recipientId,
							),
						)
						.leftJoin(
							schema.examAttempt,
							and(
								eq(
									schema.examAttempt.scheduleId,
									schema.examScheduleRecipient.scheduleId,
								),
								eq(
									schema.examAttempt.userId,
									schema.examScheduleRecipient.userId,
								),
							),
						)
						.where(inArray(schema.examScheduleRecipientClass.classId, classIds))
				: [{ recipients: 0, completed: 0 }];
			return {
				organization,
				role: context.membership.role,
				audience,
				...plan,
				metrics: {
					assignedClasses: classIds.length,
					upcomingDeliveries: recent.length,
					students: participation?.recipients ?? 0,
					completedAttempts: participation?.completed ?? 0,
				},
				recent,
			};
		}

		const [classes, upcoming, completed] = await Promise.all([
			db
				.select({ count: count() })
				.from(schema.academicClassMember)
				.where(
					and(
						eq(schema.academicClassMember.memberId, context.membership.id),
						eq(schema.academicClassMember.role, "student"),
					),
				),
			db
				.select({
					id: schema.examSchedule.id,
					title: schema.exam.title,
					opensAt: schema.examSchedule.opensAt,
					closesAt: schema.examSchedule.closesAt,
				})
				.from(schema.examScheduleRecipient)
				.innerJoin(
					schema.examSchedule,
					eq(schema.examSchedule.id, schema.examScheduleRecipient.scheduleId),
				)
				.innerJoin(schema.exam, eq(schema.exam.id, schema.examSchedule.examId))
				.where(
					and(
						eq(schema.examScheduleRecipient.userId, context.session.user.id),
						eq(schema.examSchedule.organizationId, context.organizationId),
						gt(schema.examSchedule.closesAt, now),
					),
				)
				.orderBy(asc(schema.examSchedule.opensAt))
				.limit(5),
			db
				.select({ count: count() })
				.from(schema.examAttempt)
				.innerJoin(
					schema.examSchedule,
					eq(schema.examSchedule.id, schema.examAttempt.scheduleId),
				)
				.where(
					and(
						eq(schema.examAttempt.userId, context.session.user.id),
						eq(schema.examSchedule.organizationId, context.organizationId),
						inArray(schema.examAttempt.status, ["submitted", "timed_out"]),
					),
				),
		]);
		return {
			organization,
			role: context.membership.role,
			audience,
			...plan,
			metrics: {
				activeClasses: classes[0]?.count ?? 0,
				upcomingExams: upcoming.length,
				completedExams: completed[0]?.count ?? 0,
				recentResults: completed[0]?.count ?? 0,
			},
			recent: upcoming,
		};
	},
);
