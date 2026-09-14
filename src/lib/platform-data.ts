import { eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { sanitizeAuditMetadata } from "@/lib/platform-policy";

export const DEFAULT_PLAN_ID = "plan-free";
export const PLATFORM_SETTINGS_ID = "default";

export type AuditCategory =
	| "auth"
	| "user"
	| "organization"
	| "plan"
	| "system"
	| "security";

export interface AuditInput {
	category: AuditCategory;
	type: string;
	result?: "success" | "failure";
	actorUserId?: string | null;
	effectiveUserId?: string | null;
	targetType?: string | null;
	targetId?: string | null;
	organizationId?: string | null;
	sessionId?: string | null;
	userAgent?: string | null;
	metadata?: Record<string, unknown>;
}

const seededPlans = [
	{
		id: DEFAULT_PLAN_ID,
		name: "Free",
		slug: "free",
		description: "For individual learners and small study groups.",
		memberLimit: 10,
		activeExamLimit: 5,
		monthlyAttemptLimit: 100,
	},
	{
		id: "plan-starter",
		name: "Starter",
		slug: "starter",
		description: "For growing classes and education teams.",
		memberLimit: 50,
		activeExamLimit: 25,
		monthlyAttemptLimit: 1_000,
	},
	{
		id: "plan-pro",
		name: "Pro",
		slug: "pro",
		description: "For established learning organizations.",
		memberLimit: 250,
		activeExamLimit: 100,
		monthlyAttemptLimit: 10_000,
	},
] as const;

export async function ensurePlatformData() {
	const now = new Date();
	for (const plan of seededPlans) {
		await db
			.insert(schema.platformPlan)
			.values({ ...plan, isActive: true, createdAt: now, updatedAt: now })
			.onConflictDoNothing();
	}
	await db
		.insert(schema.platformSettings)
		.values({
			id: PLATFORM_SETTINGS_ID,
			publicSignupEnabled: true,
			defaultPlanId: DEFAULT_PLAN_ID,
			maintenanceEnabled: false,
			maintenanceMessage: null,
			updatedAt: now,
		})
		.onConflictDoNothing();
	const missing = await db
		.select({ organizationId: schema.organization.id })
		.from(schema.organization)
		.leftJoin(
			schema.organizationEntitlement,
			eq(schema.organizationEntitlement.organizationId, schema.organization.id),
		)
		.where(isNull(schema.organizationEntitlement.organizationId));
	for (const { organizationId } of missing) {
		await db
			.insert(schema.organizationEntitlement)
			.values({
				organizationId,
				planId: DEFAULT_PLAN_ID,
				status: "active",
				assignedAt: now,
				updatedAt: now,
			})
			.onConflictDoNothing();
	}
}

export async function getPlatformSettingsRecord() {
	await ensurePlatformData();
	const [settings] = await db
		.select()
		.from(schema.platformSettings)
		.where(eq(schema.platformSettings.id, PLATFORM_SETTINGS_ID))
		.limit(1);
	if (!settings) throw new Error("Platform settings are unavailable.");
	return settings;
}

export async function assignDefaultPlan(
	organizationId: string,
	assignedBy?: string | null,
) {
	const settings = await getPlatformSettingsRecord();
	const now = new Date();
	await db
		.insert(schema.organizationEntitlement)
		.values({
			organizationId,
			planId: settings.defaultPlanId,
			status: "active",
			assignedAt: now,
			assignedBy,
			updatedAt: now,
		})
		.onConflictDoNothing();
}

export async function writeAuditEvent(input: AuditInput) {
	await db.insert(schema.auditEvent).values({
		id: crypto.randomUUID(),
		category: input.category,
		type: input.type,
		result: input.result ?? "success",
		actorUserId: input.actorUserId ?? null,
		effectiveUserId: input.effectiveUserId ?? null,
		targetType: input.targetType ?? null,
		targetId: input.targetId ?? null,
		organizationId: input.organizationId ?? null,
		sessionId: input.sessionId ?? null,
		userAgent: input.userAgent?.slice(0, 500) ?? null,
		metadata: input.metadata ? sanitizeAuditMetadata(input.metadata) : null,
		createdAt: new Date(),
	});
}
