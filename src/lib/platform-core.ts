import { getRequestHeaders } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";

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
