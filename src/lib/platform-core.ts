import { getRequestHeaders } from "@tanstack/react-start/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { auth } from "@/lib/auth";
import type { AuditInput } from "@/lib/platform-data";
import { ensurePlatformData, writeAuditEvent } from "@/lib/platform-data";
import {
	assertOrganizationAccessible,
	assertWritableSession,
	mapAuditIdentity,
} from "@/lib/platform-policy";

export {
	DEFAULT_PLAN_ID,
	ensurePlatformData,
	getPlatformSettingsRecord,
	PLATFORM_SETTINGS_ID,
} from "@/lib/platform-data";

export async function requirePlatformAdmin(options?: { writable?: boolean }) {
	const headers = getRequestHeaders();
	const session = await auth.api.getSession({ headers });
	if (!session?.user.role?.split(",").includes("admin")) {
		throw new Error("Administrator access is required.");
	}
	if (options?.writable) {
		assertWritableSession(session.session.impersonatedBy);
	}
	return { headers, session };
}

export async function requireAccountSession(options?: { writable?: boolean }) {
	const headers = getRequestHeaders();
	const session = await auth.api.getSession({ headers });
	if (!session) throw new Error("Please sign in to continue.");
	if (options?.writable) assertWritableSession(session.session.impersonatedBy);
	return { headers, session };
}

export async function auditForSession(
	session: Awaited<ReturnType<typeof auth.api.getSession>>,
	input: Omit<
		AuditInput,
		"actorUserId" | "effectiveUserId" | "sessionId" | "userAgent"
	>,
) {
	if (!session) return;
	const identity = mapAuditIdentity({
		userId: session.user.id,
		impersonatedBy: session.session.impersonatedBy,
	});
	const headers = getRequestHeaders();
	await writeAuditEvent({
		...input,
		...identity,
		sessionId: session.session.id,
		userAgent: headers.get("user-agent"),
	});
}

export async function requireActiveOrganization(organizationId: string) {
	await ensurePlatformData();
	const [entitlement] = await db
		.select({ status: schema.organizationEntitlement.status })
		.from(schema.organizationEntitlement)
		.where(eq(schema.organizationEntitlement.organizationId, organizationId))
		.limit(1);
	assertOrganizationAccessible(entitlement?.status ?? "active");
}

type OrganizationResource = "exam" | "question";
type OrganizationAction = "create" | "read" | "update" | "delete" | "publish";

const allowedActions: Record<
	"owner" | "admin" | "teacher" | "student",
	Record<OrganizationResource, OrganizationAction[]>
> = {
	owner: {
		exam: ["create", "read", "update", "delete", "publish"],
		question: ["create", "read", "update", "delete"],
	},
	admin: {
		exam: ["create", "read", "update", "delete", "publish"],
		question: ["create", "read", "update", "delete"],
	},
	teacher: {
		exam: ["create", "read", "update", "delete", "publish"],
		question: ["create", "read", "update", "delete"],
	},
	student: { exam: ["read"], question: [] },
};

export async function requireOrganizationPermission(input: {
	resource: OrganizationResource;
	action: OrganizationAction;
	writable?: boolean;
}) {
	const { headers, session } = await requireAccountSession({
		writable: input.writable,
	});
	const organizations = await auth.api.listOrganizations({ headers });
	const organizationId =
		session.session.activeOrganizationId ?? organizations[0]?.id;
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
	if (!membership) throw new Error("Workspace access is required.");
	const permitted = membership.role.split(",").some((role) => {
		if (!(role in allowedActions)) return false;
		return allowedActions[role as keyof typeof allowedActions][
			input.resource
		].includes(input.action);
	});
	if (!permitted)
		throw new Error("You do not have permission to perform this action.");
	await requireActiveOrganization(organizationId);
	return {
		headers,
		session,
		organizationId,
		organizationRole: membership.role,
	};
}
