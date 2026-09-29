import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireAccountSession } from "@/lib/platform-core";

async function requireOrganizationOwner() {
	const { headers, session } = await requireAccountSession();
	const organizationId =
		session.session.activeOrganizationId ??
		(await auth.api.listOrganizations({ headers }))[0]?.id;
	if (!organizationId) throw new Error("Select a workspace to continue.");
	const [membership] = await db
		.select({ role: schema.member.role })
		.from(schema.member)
		.where(
			and(
				eq(schema.member.organizationId, organizationId),
				eq(schema.member.userId, session.user.id),
			),
		)
		.limit(1);
	if (!membership?.role.split(",").includes("owner")) {
		throw new Error("Only the organization owner can manage billing.");
	}
	return { organizationId };
}

export const getWorkspaceBilling = createServerFn({ method: "GET" }).handler(
	async () => {
		const { organizationId } = await requireOrganizationOwner();
		const [current, plans] = await Promise.all([
			db
				.select({
					organizationName: schema.organization.name,
					planId: schema.platformPlan.id,
					planName: schema.platformPlan.name,
					description: schema.platformPlan.description,
					memberLimit: schema.platformPlan.memberLimit,
					activeExamLimit: schema.platformPlan.activeExamLimit,
					monthlyAttemptLimit: schema.platformPlan.monthlyAttemptLimit,
					status: schema.organizationSubscription.status,
					source: schema.organizationSubscription.source,
					provider: schema.organizationSubscription.provider,
					currentPeriodEnd: schema.organizationSubscription.currentPeriodEnd,
					cancelAtPeriodEnd: schema.organizationSubscription.cancelAtPeriodEnd,
				})
				.from(schema.organizationSubscription)
				.innerJoin(
					schema.organization,
					eq(
						schema.organization.id,
						schema.organizationSubscription.organizationId,
					),
				)
				.innerJoin(
					schema.platformPlan,
					eq(schema.platformPlan.id, schema.organizationSubscription.planId),
				)
				.where(
					eq(schema.organizationSubscription.organizationId, organizationId),
				)
				.limit(1)
				.then((rows) => rows[0] ?? null),
			db
				.select({
					id: schema.platformPlan.id,
					name: schema.platformPlan.name,
					description: schema.platformPlan.description,
					memberLimit: schema.platformPlan.memberLimit,
					activeExamLimit: schema.platformPlan.activeExamLimit,
					monthlyAttemptLimit: schema.platformPlan.monthlyAttemptLimit,
					priceCents: schema.platformPlan.priceCents,
					currency: schema.platformPlan.currency,
					billingInterval: schema.platformPlan.billingInterval,
					providerReady: schema.platformPlan.providerPriceId,
				})
				.from(schema.platformPlan)
				.where(
					and(
						eq(schema.platformPlan.isActive, true),
						eq(schema.platformPlan.isPublic, true),
					),
				)
				.orderBy(asc(schema.platformPlan.priceCents)),
		]);
		if (!current) throw new Error("Workspace subscription is unavailable.");
		return { current, plans };
	},
);
