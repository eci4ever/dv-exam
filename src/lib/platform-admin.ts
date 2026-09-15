import { createServerFn } from "@tanstack/react-start";
import {
	and,
	asc,
	count,
	countDistinct,
	desc,
	eq,
	gte,
	isNull,
	like,
	lte,
	or,
	sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import { db } from "@/db";
import * as schema from "@/db/schema";
import {
	auditForSession,
	ensurePlatformData,
	getPlatformSettingsRecord,
	PLATFORM_SETTINGS_ID,
	requirePlatformAdmin,
} from "@/lib/platform-core";
import { assertPlanLimitReductionSafe } from "@/lib/platform-policy";

export type OrganizationStatus = "active" | "suspended";
export type AuditCategory =
	| "auth"
	| "user"
	| "organization"
	| "plan"
	| "system"
	| "security";

function objectInput(value: unknown) {
	if (!value || typeof value !== "object") throw new Error("Invalid request.");
	return value as Record<string, unknown>;
}

function textInput(value: unknown, label: string, min: number, max: number) {
	if (typeof value !== "string") throw new Error(`${label} is required.`);
	const result = value.trim();
	if (result.length < min || result.length > max) {
		throw new Error(`${label} must be between ${min} and ${max} characters.`);
	}
	return result;
}

function optionalText(value: unknown, max: number) {
	if (value == null || value === "") return "";
	if (typeof value !== "string") throw new Error("Invalid text value.");
	return value.trim().slice(0, max);
}

function positiveInteger(value: unknown, label: string) {
	if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
		throw new Error(`${label} must be a positive integer.`);
	}
	return value;
}

function paginationInput(value: unknown) {
	const input =
		value && typeof value === "object"
			? (value as Record<string, unknown>)
			: {};
	return {
		page:
			typeof input.page === "number" && Number.isInteger(input.page)
				? Math.max(1, input.page)
				: 1,
		pageSize: 25,
		search:
			typeof input.search === "string" ? input.search.trim().slice(0, 100) : "",
	};
}

function validatePlanInput(value: unknown) {
	const input = objectInput(value);
	const slug = textInput(input.slug, "Slug", 2, 32);
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
		throw new Error(
			"Slug must use lowercase letters, numbers, and hyphens only.",
		);
	}
	const description = optionalText(input.description, 160);
	return {
		id: typeof input.id === "string" ? input.id : undefined,
		name: textInput(input.name, "Name", 2, 40),
		slug,
		description,
		memberLimit: positiveInteger(input.memberLimit, "Member limit"),
		activeExamLimit: positiveInteger(
			input.activeExamLimit,
			"Active exam limit",
		),
		monthlyAttemptLimit: positiveInteger(
			input.monthlyAttemptLimit,
			"Monthly attempt limit",
		),
	};
}

export const getRegistrationStatus = createServerFn({ method: "GET" }).handler(
	async () => {
		const settings = await getPlatformSettingsRecord();
		return { enabled: settings.publicSignupEnabled };
	},
);

export const getPlatformSettings = createServerFn({ method: "GET" }).handler(
	async () => {
		await requirePlatformAdmin();
		const settings = await getPlatformSettingsRecord();
		const plans = await db
			.select({ id: schema.platformPlan.id, name: schema.platformPlan.name })
			.from(schema.platformPlan)
			.where(eq(schema.platformPlan.isActive, true))
			.orderBy(asc(schema.platformPlan.name));
		return { settings, plans };
	},
);

export const updatePlatformSettings = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = objectInput(value);
		const maintenanceEnabled = input.maintenanceEnabled === true;
		const maintenanceMessage = optionalText(input.maintenanceMessage, 240);
		if (maintenanceEnabled && maintenanceMessage.length < 5) {
			throw new Error("Maintenance message must be at least 5 characters.");
		}
		return {
			publicSignupEnabled: input.publicSignupEnabled === true,
			defaultPlanId: textInput(input.defaultPlanId, "Default plan", 1, 100),
			maintenanceEnabled,
			maintenanceMessage: maintenanceMessage || null,
		};
	})
	.handler(async ({ data }) => {
		const { session } = await requirePlatformAdmin({ writable: true });
		await ensurePlatformData();
		const [plan] = await db
			.select({ id: schema.platformPlan.id })
			.from(schema.platformPlan)
			.where(
				and(
					eq(schema.platformPlan.id, data.defaultPlanId),
					eq(schema.platformPlan.isActive, true),
				),
			)
			.limit(1);
		if (!plan) throw new Error("Select an active default plan.");
		await db
			.update(schema.platformSettings)
			.set({ ...data, updatedAt: new Date(), updatedBy: session.user.id })
			.where(eq(schema.platformSettings.id, PLATFORM_SETTINGS_ID));
		await auditForSession(session, {
			category: "system",
			type: "settings.updated",
			targetType: "platformSettings",
			targetId: PLATFORM_SETTINGS_ID,
			metadata: {
				publicSignupEnabled: data.publicSignupEnabled,
				defaultPlanId: data.defaultPlanId,
				maintenanceEnabled: data.maintenanceEnabled,
			},
		});
		return getPlatformSettingsRecord();
	});

export const listPlans = createServerFn({ method: "GET" }).handler(async () => {
	await requirePlatformAdmin();
	await ensurePlatformData();
	const settings = await getPlatformSettingsRecord();
	const [planRows, organizationCounts, memberUsageRows] = await Promise.all([
		db
			.select({
				id: schema.platformPlan.id,
				name: schema.platformPlan.name,
				slug: schema.platformPlan.slug,
				description: schema.platformPlan.description,
				memberLimit: schema.platformPlan.memberLimit,
				activeExamLimit: schema.platformPlan.activeExamLimit,
				monthlyAttemptLimit: schema.platformPlan.monthlyAttemptLimit,
				isActive: schema.platformPlan.isActive,
				createdAt: schema.platformPlan.createdAt,
				updatedAt: schema.platformPlan.updatedAt,
			})
			.from(schema.platformPlan)
			.orderBy(asc(schema.platformPlan.createdAt)),
		db
			.select({
				planId: schema.organizationEntitlement.planId,
				count: count(schema.organizationEntitlement.organizationId),
			})
			.from(schema.organizationEntitlement)
			.groupBy(schema.organizationEntitlement.planId),
		db
			.select({
				planId: schema.organizationEntitlement.planId,
				organizationId: schema.organizationEntitlement.organizationId,
				usage: count(schema.member.id),
			})
			.from(schema.organizationEntitlement)
			.leftJoin(
				schema.member,
				eq(
					schema.member.organizationId,
					schema.organizationEntitlement.organizationId,
				),
			)
			.groupBy(
				schema.organizationEntitlement.planId,
				schema.organizationEntitlement.organizationId,
			),
	]);
	const plans = planRows.map((plan) => ({
		...plan,
		organizationCount:
			organizationCounts.find((row) => row.planId === plan.id)?.count ?? 0,
		largestMemberUsage: Math.max(
			0,
			...memberUsageRows
				.filter((row) => row.planId === plan.id)
				.map((row) => row.usage),
		),
	}));
	return { plans, defaultPlanId: settings.defaultPlanId };
});

export const createPlan = createServerFn({ method: "POST" })
	.validator(validatePlanInput)
	.handler(async ({ data }) => {
		const { session } = await requirePlatformAdmin({ writable: true });
		const now = new Date();
		const id = crypto.randomUUID();
		try {
			await db.insert(schema.platformPlan).values({
				...data,
				id,
				isActive: true,
				createdAt: now,
				updatedAt: now,
			});
		} catch (error) {
			if (error instanceof Error && error.message.includes("UNIQUE")) {
				throw new Error("A plan with this slug already exists.");
			}
			throw error;
		}
		await auditForSession(session, {
			category: "plan",
			type: "plan.created",
			targetType: "platformPlan",
			targetId: id,
			metadata: { name: data.name, slug: data.slug },
		});
		return { id };
	});

export const updatePlan = createServerFn({ method: "POST" })
	.validator(validatePlanInput)
	.handler(async ({ data }) => {
		const { session } = await requirePlatformAdmin({ writable: true });
		if (!data.id) throw new Error("Plan is required.");
		const [current] = await db
			.select()
			.from(schema.platformPlan)
			.where(eq(schema.platformPlan.id, data.id))
			.limit(1);
		if (!current) throw new Error("Plan not found.");

		const usageRows = await db
			.select({ usage: count(schema.member.id) })
			.from(schema.organizationEntitlement)
			.leftJoin(
				schema.member,
				eq(
					schema.member.organizationId,
					schema.organizationEntitlement.organizationId,
				),
			)
			.where(eq(schema.organizationEntitlement.planId, data.id))
			.groupBy(schema.organizationEntitlement.organizationId);
		const maxMembers = Math.max(0, ...usageRows.map((row) => row.usage));
		assertPlanLimitReductionSafe(data.memberLimit, maxMembers, "members");

		try {
			await db
				.update(schema.platformPlan)
				.set({
					name: data.name,
					slug: data.slug,
					description: data.description,
					memberLimit: data.memberLimit,
					activeExamLimit: data.activeExamLimit,
					monthlyAttemptLimit: data.monthlyAttemptLimit,
					updatedAt: new Date(),
				})
				.where(eq(schema.platformPlan.id, data.id));
		} catch (error) {
			if (error instanceof Error && error.message.includes("UNIQUE")) {
				throw new Error("A plan with this slug already exists.");
			}
			throw error;
		}
		await auditForSession(session, {
			category: "plan",
			type: "plan.updated",
			targetType: "platformPlan",
			targetId: data.id,
			metadata: { name: data.name, slug: data.slug },
		});
		return { id: data.id };
	});

export const setPlanActive = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = objectInput(value);
		return {
			planId: textInput(input.planId, "Plan", 1, 100),
			isActive: input.isActive === true,
		};
	})
	.handler(async ({ data }) => {
		const { session } = await requirePlatformAdmin({ writable: true });
		const settings = await getPlatformSettingsRecord();
		if (!data.isActive && settings.defaultPlanId === data.planId) {
			throw new Error("The default plan cannot be deactivated.");
		}
		const result = await db
			.update(schema.platformPlan)
			.set({ isActive: data.isActive, updatedAt: new Date() })
			.where(eq(schema.platformPlan.id, data.planId));
		if (!result.meta.changes) throw new Error("Plan not found.");
		await auditForSession(session, {
			category: "plan",
			type: data.isActive ? "plan.activated" : "plan.deactivated",
			targetType: "platformPlan",
			targetId: data.planId,
		});
		return { success: true };
	});

export const listPlanOrganizations = createServerFn({ method: "GET" })
	.validator((value: unknown) => {
		const result = paginationInput(value);
		const input =
			value && typeof value === "object"
				? (value as Record<string, unknown>)
				: {};
		return {
			...result,
			planId: typeof input.planId === "string" ? input.planId : "all",
			status:
				input.status === "active" || input.status === "suspended"
					? (input.status as OrganizationStatus)
					: "all",
		};
	})
	.handler(async ({ data }) => {
		await requirePlatformAdmin();
		await ensurePlatformData();
		const conditions = [
			data.search
				? or(
						like(schema.organization.name, `%${data.search}%`),
						like(schema.organization.slug, `%${data.search}%`),
					)
				: undefined,
			data.planId !== "all"
				? eq(schema.organizationEntitlement.planId, data.planId)
				: undefined,
			data.status !== "all"
				? eq(
						schema.organizationEntitlement.status,
						data.status as OrganizationStatus,
					)
				: undefined,
		].filter(Boolean);
		const where = conditions.length ? and(...conditions) : undefined;
		const memberCount = count(schema.member.id);
		const [rows, totals] = await Promise.all([
			db
				.select({
					id: schema.organization.id,
					name: schema.organization.name,
					slug: schema.organization.slug,
					planId: schema.platformPlan.id,
					planName: schema.platformPlan.name,
					planActive: schema.platformPlan.isActive,
					status: schema.organizationEntitlement.status,
					memberLimit: schema.platformPlan.memberLimit,
					memberCount,
					activeExamLimit: schema.platformPlan.activeExamLimit,
					activeExamCount: sql<number>`(select count(*) from ${schema.exam} where ${schema.exam.organizationId} = ${schema.organization.id} and ${schema.exam.status} = 'published')`,
				})
				.from(schema.organization)
				.innerJoin(
					schema.organizationEntitlement,
					eq(
						schema.organizationEntitlement.organizationId,
						schema.organization.id,
					),
				)
				.innerJoin(
					schema.platformPlan,
					eq(schema.platformPlan.id, schema.organizationEntitlement.planId),
				)
				.leftJoin(
					schema.member,
					eq(schema.member.organizationId, schema.organization.id),
				)
				.where(where)
				.groupBy(schema.organization.id)
				.orderBy(asc(schema.organization.name))
				.limit(data.pageSize)
				.offset((data.page - 1) * data.pageSize),
			db
				.select({ total: count() })
				.from(schema.organization)
				.innerJoin(
					schema.organizationEntitlement,
					eq(
						schema.organizationEntitlement.organizationId,
						schema.organization.id,
					),
				)
				.where(where),
		]);
		const total = totals[0]?.total ?? 0;
		return {
			rows,
			total,
			page: data.page,
			pageCount: Math.max(1, Math.ceil(total / 25)),
		};
	});

export const assignOrganizationPlan = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = objectInput(value);
		return {
			organizationId: textInput(input.organizationId, "Organization", 1, 100),
			planId: textInput(input.planId, "Plan", 1, 100),
		};
	})
	.handler(async ({ data }) => {
		const { session } = await requirePlatformAdmin({ writable: true });
		const [plan] = await db
			.select({
				id: schema.platformPlan.id,
				memberLimit: schema.platformPlan.memberLimit,
			})
			.from(schema.platformPlan)
			.where(
				and(
					eq(schema.platformPlan.id, data.planId),
					eq(schema.platformPlan.isActive, true),
				),
			)
			.limit(1);
		if (!plan) throw new Error("Select an active plan.");
		const [usage] = await db
			.select({ count: count() })
			.from(schema.member)
			.where(eq(schema.member.organizationId, data.organizationId));
		assertPlanLimitReductionSafe(
			plan.memberLimit,
			usage?.count ?? 0,
			"members",
		);
		const result = await db
			.update(schema.organizationEntitlement)
			.set({
				planId: data.planId,
				assignedAt: new Date(),
				assignedBy: session.user.id,
				updatedAt: new Date(),
			})
			.where(
				eq(schema.organizationEntitlement.organizationId, data.organizationId),
			);
		if (!result.meta.changes) throw new Error("Organization not found.");
		await auditForSession(session, {
			category: "organization",
			type: "organization.plan-assigned",
			targetType: "organization",
			targetId: data.organizationId,
			organizationId: data.organizationId,
			metadata: { planId: data.planId },
		});
		return { success: true };
	});

export const suspendOrganization = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = objectInput(value);
		return {
			organizationId: textInput(input.organizationId, "Organization", 1, 100),
			reason: textInput(input.reason, "Suspension reason", 3, 240),
		};
	})
	.handler(async ({ data }) => {
		const { session } = await requirePlatformAdmin({ writable: true });
		const result = await db
			.update(schema.organizationEntitlement)
			.set({
				status: "suspended",
				suspensionReason: data.reason,
				suspendedAt: new Date(),
				suspendedBy: session.user.id,
				updatedAt: new Date(),
			})
			.where(
				eq(schema.organizationEntitlement.organizationId, data.organizationId),
			);
		if (!result.meta.changes) throw new Error("Organization not found.");
		await auditForSession(session, {
			category: "organization",
			type: "organization.suspended",
			targetType: "organization",
			targetId: data.organizationId,
			organizationId: data.organizationId,
			metadata: { reason: data.reason },
		});
		return { success: true };
	});

export const reactivateOrganization = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = objectInput(value);
		return {
			organizationId: textInput(input.organizationId, "Organization", 1, 100),
		};
	})
	.handler(async ({ data }) => {
		const { session } = await requirePlatformAdmin({ writable: true });
		const result = await db
			.update(schema.organizationEntitlement)
			.set({
				status: "active",
				suspensionReason: null,
				suspendedAt: null,
				suspendedBy: null,
				updatedAt: new Date(),
			})
			.where(
				eq(schema.organizationEntitlement.organizationId, data.organizationId),
			);
		if (!result.meta.changes) throw new Error("Organization not found.");
		await auditForSession(session, {
			category: "organization",
			type: "organization.reactivated",
			targetType: "organization",
			targetId: data.organizationId,
			organizationId: data.organizationId,
		});
		return { success: true };
	});

export const getPlatformOverview = createServerFn({ method: "GET" }).handler(
	async () => {
		await requirePlatformAdmin();
		await ensurePlatformData();
		const now = new Date();
		const [
			totals,
			activeUsers,
			activeOrgs,
			suspendedOrgs,
			bannedUsers,
			ownerless,
			atLimit,
			recent,
		] = await Promise.all([
			db.select({ count: count() }).from(schema.user),
			db
				.select({ count: countDistinct(schema.session.userId) })
				.from(schema.session)
				.where(gte(schema.session.expiresAt, now)),
			db
				.select({ count: count() })
				.from(schema.organizationEntitlement)
				.where(eq(schema.organizationEntitlement.status, "active")),
			db
				.select({ count: count() })
				.from(schema.organizationEntitlement)
				.where(eq(schema.organizationEntitlement.status, "suspended")),
			db
				.select({ count: count() })
				.from(schema.user)
				.where(eq(schema.user.banned, true)),
			db
				.select({ count: count() })
				.from(schema.organization)
				.leftJoin(
					schema.member,
					and(
						eq(schema.member.organizationId, schema.organization.id),
						eq(schema.member.role, "owner"),
					),
				)
				.where(isNull(schema.member.id)),
			db.select({ count: count() }).from(
				db
					.select({ id: schema.organization.id })
					.from(schema.organization)
					.innerJoin(
						schema.organizationEntitlement,
						eq(
							schema.organizationEntitlement.organizationId,
							schema.organization.id,
						),
					)
					.innerJoin(
						schema.platformPlan,
						eq(schema.platformPlan.id, schema.organizationEntitlement.planId),
					)
					.leftJoin(
						schema.member,
						eq(schema.member.organizationId, schema.organization.id),
					)
					.groupBy(schema.organization.id)
					.having(gte(count(schema.member.id), schema.platformPlan.memberLimit))
					.as("atLimit"),
			),
			db
				.select()
				.from(schema.auditEvent)
				.orderBy(desc(schema.auditEvent.createdAt))
				.limit(10),
		]);
		return {
			metrics: {
				totalUsers: totals[0]?.count ?? 0,
				activeUsers: activeUsers[0]?.count ?? 0,
				activeOrganizations: activeOrgs[0]?.count ?? 0,
				suspendedOrganizations: suspendedOrgs[0]?.count ?? 0,
			},
			attention: {
				bannedUsers: bannedUsers[0]?.count ?? 0,
				ownerlessOrganizations: ownerless[0]?.count ?? 0,
				organizationsAtLimit: atLimit[0]?.count ?? 0,
				suspendedOrganizations: suspendedOrgs[0]?.count ?? 0,
			},
			recent,
		};
	},
);

export const listAuditEvents = createServerFn({ method: "GET" })
	.validator((value: unknown) => {
		const result = paginationInput(value);
		const input =
			value && typeof value === "object"
				? (value as Record<string, unknown>)
				: {};
		return {
			...result,
			category: typeof input.category === "string" ? input.category : "all",
			type: typeof input.type === "string" ? input.type : "all",
			result: typeof input.result === "string" ? input.result : "all",
			actorId: typeof input.actorId === "string" ? input.actorId : "",
			organizationId:
				typeof input.organizationId === "string" ? input.organizationId : "",
			dateFrom:
				typeof input.dateFrom === "string" && input.dateFrom
					? new Date(input.dateFrom)
					: null,
			dateTo:
				typeof input.dateTo === "string" && input.dateTo
					? new Date(`${input.dateTo}T23:59:59.999`)
					: null,
			sortDirection: input.sortDirection === "asc" ? "asc" : "desc",
		};
	})
	.handler(async ({ data }) => {
		await requirePlatformAdmin();
		const actor = alias(schema.user, "auditActor");
		const organization = alias(schema.organization, "auditOrganization");
		const conditions = [
			data.search
				? or(
						like(schema.auditEvent.type, `%${data.search}%`),
						like(schema.auditEvent.targetId, `%${data.search}%`),
						like(actor.name, `%${data.search}%`),
						like(actor.email, `%${data.search}%`),
						like(organization.name, `%${data.search}%`),
					)
				: undefined,
			data.category !== "all"
				? eq(schema.auditEvent.category, data.category as AuditCategory)
				: undefined,
			data.type !== "all" ? eq(schema.auditEvent.type, data.type) : undefined,
			data.result !== "all"
				? eq(schema.auditEvent.result, data.result as "success" | "failure")
				: undefined,
			data.actorId
				? eq(schema.auditEvent.actorUserId, data.actorId)
				: undefined,
			data.organizationId
				? eq(schema.auditEvent.organizationId, data.organizationId)
				: undefined,
			data.dateFrom
				? gte(schema.auditEvent.createdAt, data.dateFrom)
				: undefined,
			data.dateTo ? lte(schema.auditEvent.createdAt, data.dateTo) : undefined,
		].filter(Boolean);
		const where = conditions.length ? and(...conditions) : undefined;
		const order = data.sortDirection === "asc" ? asc : desc;
		const [events, totals] = await Promise.all([
			db
				.select({
					id: schema.auditEvent.id,
					category: schema.auditEvent.category,
					type: schema.auditEvent.type,
					result: schema.auditEvent.result,
					actorUserId: schema.auditEvent.actorUserId,
					actorName: actor.name,
					actorEmail: actor.email,
					effectiveUserId: schema.auditEvent.effectiveUserId,
					targetType: schema.auditEvent.targetType,
					targetId: schema.auditEvent.targetId,
					organizationId: schema.auditEvent.organizationId,
					organizationName: organization.name,
					createdAt: schema.auditEvent.createdAt,
				})
				.from(schema.auditEvent)
				.leftJoin(actor, eq(actor.id, schema.auditEvent.actorUserId))
				.leftJoin(
					organization,
					eq(organization.id, schema.auditEvent.organizationId),
				)
				.where(where)
				.orderBy(order(schema.auditEvent.createdAt))
				.limit(25)
				.offset((data.page - 1) * 25),
			db
				.select({ total: countDistinct(schema.auditEvent.id) })
				.from(schema.auditEvent)
				.leftJoin(actor, eq(actor.id, schema.auditEvent.actorUserId))
				.leftJoin(
					organization,
					eq(organization.id, schema.auditEvent.organizationId),
				)
				.where(where),
		]);
		const total = totals[0]?.total ?? 0;
		return {
			events,
			total,
			page: data.page,
			pageCount: Math.max(1, Math.ceil(total / 25)),
		};
	});

export const listAuditFilterOptions = createServerFn({ method: "GET" }).handler(
	async () => {
		await requirePlatformAdmin();
		const [types, actors, organizations] = await Promise.all([
			db
				.selectDistinct({ type: schema.auditEvent.type })
				.from(schema.auditEvent)
				.orderBy(asc(schema.auditEvent.type)),
			db
				.select({
					id: schema.user.id,
					name: schema.user.name,
					email: schema.user.email,
				})
				.from(schema.user)
				.orderBy(asc(schema.user.name)),
			db
				.select({ id: schema.organization.id, name: schema.organization.name })
				.from(schema.organization)
				.orderBy(asc(schema.organization.name)),
		]);
		return { types, actors, organizations };
	},
);

export const getAuditEvent = createServerFn({ method: "GET" })
	.validator((value: unknown) => {
		const input = objectInput(value);
		return { eventId: textInput(input.eventId, "Audit event", 1, 100) };
	})
	.handler(async ({ data }) => {
		await requirePlatformAdmin();
		const [event] = await db
			.select()
			.from(schema.auditEvent)
			.where(eq(schema.auditEvent.id, data.eventId))
			.limit(1);
		if (!event) throw new Error("Audit event not found.");
		return event;
	});
