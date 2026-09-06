import { env } from "cloudflare:workers";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { getAuth } from "#/lib/auth";
import {
	hasOrganizationPermission,
	isOrganizationMemberRole,
	type OrganizationPermission,
} from "./authorization-policy";
import { forbidden, unauthorized } from "#/server/errors";

export type { OrganizationPermission } from "./authorization-policy";

export async function requireSession() {
	const session = await getAuth().api.getSession({
		headers: getRequestHeaders(),
	});
	if (!session) throw unauthorized("Please sign in to continue.");
	return session;
}

export async function requireGlobalAdmin() {
	const session = await requireSession();
	if (session.user.role !== "admin")
		throw forbidden("Platform administrator access is required.");
	return session;
}

export async function requireOrganizationMember(organizationId: string) {
	const session = await requireSession();
	if (!organizationId) throw forbidden("An organisation context is required.");
	const membership = await env.DB.prepare(
		"SELECT role FROM member WHERE organizationId = ? AND userId = ?",
	)
		.bind(organizationId, session.user.id)
		.first<{ role: string }>();
	if (!membership || !isOrganizationMemberRole(membership.role))
		throw forbidden("You are not a member of this organisation.");
	return { session, role: membership.role };
}

export async function requireOrganizationPermission({
	organizationId,
	permission,
}: {
	organizationId: string;
	permission: OrganizationPermission;
}) {
	const membership = await requireOrganizationMember(organizationId);
	if (!hasOrganizationPermission(membership.role, permission))
		throw forbidden("Organisation owner or admin access is required.");
	const lifecycle = await env.DB.prepare(
		"SELECT status FROM platform_organization WHERE organizationId = ?",
	)
		.bind(organizationId)
		.first<{ status: string }>();
	if (lifecycle && lifecycle.status !== "active")
		throw forbidden("This organisation is not active for operational changes.");
	return membership;
}

export async function requireActiveOrganization() {
	const session = await requireSession();
	const organizationId = session.session.activeOrganizationId;
	if (!organizationId) throw forbidden("Choose an active organisation first.");
	return requireOrganizationMember(organizationId);
}

export async function requireActiveOrganizationPermission(
	permission: OrganizationPermission,
) {
	const session = await requireSession();
	const organizationId = session.session.activeOrganizationId;
	if (!organizationId) throw forbidden("Choose an active organisation first.");
	return requireOrganizationPermission({ organizationId, permission });
}
