import { env } from "cloudflare:workers";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { getAuth } from "#/lib/auth";
import {
	hasOrganizationPermission,
	isOrganizationMemberRole,
	type OrganizationPermission,
} from "./authorization-policy";

export type { OrganizationPermission } from "./authorization-policy";

export class AuthorizationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AuthorizationError";
	}
}

export async function requireSession() {
	const session = await getAuth().api.getSession({
		headers: getRequestHeaders(),
	});
	if (!session) throw new AuthorizationError("Please sign in to continue.");
	return session;
}

export async function requireGlobalAdmin() {
	const session = await requireSession();
	if (session.user.role !== "admin")
		throw new AuthorizationError("Platform administrator access is required.");
	return session;
}

export async function requireOrganizationMember(organizationId: string) {
	const session = await requireSession();
	if (!organizationId)
		throw new AuthorizationError("An organisation context is required.");
	const membership = await env.DB.prepare(
		"SELECT role FROM member WHERE organizationId = ? AND userId = ?",
	)
		.bind(organizationId, session.user.id)
		.first<{ role: string }>();
	if (!membership || !isOrganizationMemberRole(membership.role))
		throw new AuthorizationError("You are not a member of this organisation.");
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
		throw new AuthorizationError(
			"Organisation owner or admin access is required.",
		);
	const lifecycle = await env.DB.prepare(
		"SELECT status FROM platform_organization WHERE organizationId = ?",
	)
		.bind(organizationId)
		.first<{ status: string }>();
	if (lifecycle && lifecycle.status !== "active")
		throw new AuthorizationError(
			"This organisation is not active for operational changes.",
		);
	return membership;
}

export async function requireActiveOrganization() {
	const session = await requireSession();
	const organizationId = session.session.activeOrganizationId;
	if (!organizationId)
		throw new AuthorizationError("Choose an active organisation first.");
	return requireOrganizationMember(organizationId);
}

export async function requireActiveOrganizationPermission(
	permission: OrganizationPermission,
) {
	const session = await requireSession();
	const organizationId = session.session.activeOrganizationId;
	if (!organizationId)
		throw new AuthorizationError("Choose an active organisation first.");
	return requireOrganizationPermission({ organizationId, permission });
}
