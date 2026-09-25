import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { auth } from "@/lib/auth";
import { getPlatformSettingsRecord } from "@/lib/platform-data";

export const getSession = createServerFn({ method: "GET" }).handler(async () =>
	auth.api.getSession({ headers: getRequestHeaders() }),
);

export const getDashboardSession = createServerFn({ method: "GET" }).handler(
	async () => {
		const headers = getRequestHeaders();
		const session = await auth.api.getSession({ headers });

		if (!session) {
			return null;
		}
		const sessionOrganizationId = session.session.activeOrganizationId;
		const loadOrganization = (organizationId: string) =>
			auth.api.getFullOrganization({
				headers,
				query: { organizationId },
			});
		const [organizations, settings, sessionOrganization] = await Promise.all([
			auth.api.listOrganizations({ headers }),
			getPlatformSettingsRecord(),
			sessionOrganizationId
				? loadOrganization(sessionOrganizationId)
				: Promise.resolve(null),
		]);
		const activeOrganizationId = sessionOrganizationId ?? organizations[0]?.id;
		const organization =
			sessionOrganization ??
			(activeOrganizationId
				? await loadOrganization(activeOrganizationId)
				: null);
		const isOrganizationOwner =
			organization?.members.some(
				(member) =>
					member.userId === session.user.id &&
					member.role.split(",").includes("owner"),
			) ?? false;
		const organizationRole = organization?.members.find(
			(member) => member.userId === session.user.id,
		)?.role;
		const [entitlement, studentClasses] = await Promise.all([
			activeOrganizationId
				? db
						.select({
							status: schema.organizationEntitlement.status,
							suspensionReason: schema.organizationEntitlement.suspensionReason,
							planName: schema.platformPlan.name,
							memberLimit: schema.platformPlan.memberLimit,
						})
						.from(schema.organizationEntitlement)
						.innerJoin(
							schema.platformPlan,
							eq(schema.platformPlan.id, schema.organizationEntitlement.planId),
						)
						.where(
							eq(
								schema.organizationEntitlement.organizationId,
								activeOrganizationId,
							),
						)
						.limit(1)
						.then((rows) => rows[0] ?? null)
				: Promise.resolve(null),
			activeOrganizationId && organizationRole?.split(",").includes("student")
				? db
						.select({
							id: schema.academicClass.id,
							name: schema.academicClass.name,
							code: schema.academicClass.code,
						})
						.from(schema.academicClassMember)
						.innerJoin(
							schema.academicClass,
							eq(schema.academicClass.id, schema.academicClassMember.classId),
						)
						.innerJoin(
							schema.member,
							eq(schema.member.id, schema.academicClassMember.memberId),
						)
						.where(
							and(
								eq(schema.member.userId, session.user.id),
								eq(schema.member.organizationId, activeOrganizationId),
								eq(schema.academicClassMember.role, "student"),
								eq(schema.academicClass.status, "active"),
							),
						)
						.orderBy(asc(schema.academicClass.name))
				: Promise.resolve([]),
		]);

		return {
			session,
			organization,
			organizations,
			activeOrganizationId,
			isOrganizationOwner,
			organizationRole,
			entitlement,
			studentClasses,
			maintenanceNotice:
				settings.maintenanceEnabled && settings.maintenanceMessage
					? settings.maintenanceMessage
					: null,
		};
	},
);
