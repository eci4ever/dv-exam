import { createServerFn } from "@tanstack/react-start";
import {
	and,
	asc,
	count,
	desc,
	eq,
	gt,
	inArray,
	isNull,
	like,
	or,
	sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { deleteOrganizationLifecycle } from "@/lib/organization-lifecycle";
import {
	auditForSession,
	ensurePlatformData,
	requireAccountSession,
} from "@/lib/platform-core";
import {
	canDeleteWorkspace,
	canManageWorkspace,
	getUsageHealth,
	workspaceAudience,
} from "@/lib/workspace-governance-policy";

export interface WorkspaceUsage {
	members: { used: number; limit: number };
	activeExams: { used: number; limit: number };
	monthlyAttempts: { used: number; limit: number };
	health: ReturnType<typeof getUsageHealth>;
}

async function workspaceContext(options?: { writable?: boolean }) {
	const { headers, session } = await requireAccountSession(options);
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
	return { headers, session, organizationId, membership, organizations };
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

async function workspaceManagerContext(options?: { writable?: boolean }) {
	const context = await workspaceContext(options);
	if (!canManageWorkspace(context.membership.role))
		throw new Error("Workspace manager access is required.");
	const plan = await workspaceUsage(context.organizationId);
	if (options?.writable && plan.status === "suspended")
		throw new Error("This workspace is suspended. Contact platform support.");
	return { ...context, plan };
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

function objectInput(value: unknown) {
	if (!value || typeof value !== "object") throw new Error("Invalid request.");
	return value as Record<string, unknown>;
}

function identityInput(value: unknown) {
	const input = objectInput(value);
	const name = typeof input.name === "string" ? input.name.trim() : "";
	const slug = typeof input.slug === "string" ? input.slug.trim() : "";
	if (name.length < 2 || name.length > 80)
		throw new Error("Name must be between 2 and 80 characters.");
	if (
		slug.length < 2 ||
		slug.length > 64 ||
		!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
	)
		throw new Error(
			"Slug must use 2–64 lowercase letters, numbers, and single hyphens.",
		);
	return { name, slug };
}

export const getWorkspaceSettings = createServerFn({ method: "GET" }).handler(
	async () => {
		const context = await workspaceManagerContext();
		const [organization] = await db
			.select()
			.from(schema.organization)
			.where(eq(schema.organization.id, context.organizationId))
			.limit(1);
		if (!organization) throw new Error("Workspace not found.");
		return {
			organization,
			role: context.membership.role,
			canDelete: canDeleteWorkspace(context.membership.role),
			...context.plan,
		};
	},
);

export const updateWorkspaceIdentity = createServerFn({ method: "POST" })
	.validator(identityInput)
	.handler(async ({ data }) => {
		const context = await workspaceManagerContext({ writable: true });
		const [duplicate] = await db
			.select({ id: schema.organization.id })
			.from(schema.organization)
			.where(
				and(
					eq(schema.organization.slug, data.slug),
					sql`${schema.organization.id} <> ${context.organizationId}`,
				),
			)
			.limit(1);
		if (duplicate) throw new Error("This workspace slug is already in use.");
		await db
			.update(schema.organization)
			.set({ name: data.name, slug: data.slug })
			.where(eq(schema.organization.id, context.organizationId));
		await auditForSession(context.session, {
			category: "organization",
			type: "organization.identity-updated",
			targetType: "organization",
			targetId: context.organizationId,
			organizationId: context.organizationId,
		});
		return { ...data, organizationId: context.organizationId };
	});

export const listWorkspaceActivity = createServerFn({ method: "GET" })
	.validator((value: unknown) => {
		const input = value && typeof value === "object" ? objectInput(value) : {};
		return {
			search:
				typeof input.search === "string"
					? input.search.trim().slice(0, 100)
					: "",
			category:
				typeof input.category === "string" ? input.category.trim() : "all",
			result:
				input.result === "success" || input.result === "failure"
					? input.result
					: "all",
			page:
				typeof input.page === "number" && Number.isInteger(input.page)
					? Math.max(1, input.page)
					: 1,
		};
	})
	.handler(async ({ data }) => {
		const context = await workspaceManagerContext();
		const actor = alias(schema.user, "workspaceActivityActor");
		const category = [
			"auth",
			"user",
			"organization",
			"plan",
			"system",
			"security",
		].includes(data.category)
			? (data.category as typeof schema.auditEvent.category._.data)
			: null;
		const filters = and(
			eq(schema.auditEvent.organizationId, context.organizationId),
			category ? eq(schema.auditEvent.category, category) : undefined,
			data.result !== "all"
				? eq(schema.auditEvent.result, data.result as "success" | "failure")
				: undefined,
			data.search
				? or(
						like(schema.auditEvent.type, `%${data.search}%`),
						like(actor.name, `%${data.search}%`),
					)
				: undefined,
		);
		const [totalRows, rows] = await Promise.all([
			db
				.select({ count: count() })
				.from(schema.auditEvent)
				.leftJoin(actor, eq(actor.id, schema.auditEvent.actorUserId))
				.where(filters),
			db
				.select({
					id: schema.auditEvent.id,
					category: schema.auditEvent.category,
					type: schema.auditEvent.type,
					result: schema.auditEvent.result,
					actorName: actor.name,
					createdAt: schema.auditEvent.createdAt,
				})
				.from(schema.auditEvent)
				.leftJoin(actor, eq(actor.id, schema.auditEvent.actorUserId))
				.where(filters)
				.orderBy(desc(schema.auditEvent.createdAt))
				.limit(25)
				.offset((data.page - 1) * 25),
		]);
		const total = totalRows[0]?.count ?? 0;
		return {
			rows,
			total,
			page: data.page,
			pageCount: Math.max(1, Math.ceil(total / 25)),
		};
	});

export const deleteWorkspace = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = objectInput(value);
		return {
			confirmationName:
				typeof input.confirmationName === "string"
					? input.confirmationName.trim()
					: "",
			password: typeof input.password === "string" ? input.password : "",
		};
	})
	.handler(async ({ data }) => {
		const context = await workspaceManagerContext({ writable: true });
		if (!canDeleteWorkspace(context.membership.role))
			throw new Error("Only the workspace owner can delete this workspace.");
		const [organization] = await db
			.select({ name: schema.organization.name })
			.from(schema.organization)
			.where(eq(schema.organization.id, context.organizationId))
			.limit(1);
		if (!organization) throw new Error("Workspace not found.");
		if (data.confirmationName !== organization.name)
			throw new Error("Enter the workspace name exactly to confirm deletion.");
		if (!data.password) throw new Error("Enter your current password.");
		const { auth } = await import("@/lib/auth");
		try {
			await auth.api.verifyPassword({
				headers: context.headers,
				body: { password: data.password },
			});
		} catch {
			await auditForSession(context.session, {
				category: "security",
				type: "organization.owner-delete-failed",
				result: "failure",
				targetType: "organization",
				targetId: context.organizationId,
				organizationId: context.organizationId,
			});
			throw new Error("The current password is incorrect.");
		}
		await deleteOrganizationLifecycle(context.organizationId);
		await auditForSession(context.session, {
			category: "organization",
			type: "organization.owner-deleted",
			targetType: "organization",
			targetId: context.organizationId,
			organizationId: context.organizationId,
			metadata: { name: organization.name },
		});
		return {
			organizationId: context.organizationId,
			nextOrganizationId: context.organizations.find(
				(item) => item.id !== context.organizationId,
			)?.id,
		};
	});
