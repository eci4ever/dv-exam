import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { getAuth } from "./auth";

type OrganizationRole = "admin" | "member";

async function requireSession() {
	const session = await getAuth().api.getSession({
		headers: getRequestHeaders(),
	});
	if (!session) throw new Error("Sila log masuk untuk meneruskan.");
	return session;
}

async function requireOrganizationManager(organizationId: string) {
	const session = await requireSession();
	const membership = await env.DB.prepare(
		"SELECT role FROM member WHERE organizationId = ? AND userId = ?",
	)
		.bind(organizationId, session.user.id)
		.first<{ role: string }>();
	if (!membership || !["owner", "admin"].includes(membership.role))
		throw new Error("Organisation owner or admin access is required.");
	return session;
}

export const getOrganizationWorkspace = createServerFn({
	method: "GET",
}).handler(async () => {
	const session = await requireSession();
	const organizations = await env.DB.prepare(
		`SELECT organization.id, organization.name, organization.slug, organization.logo, organization.createdAt, member.role
			 FROM member
			 INNER JOIN organization ON organization.id = member.organizationId
			 WHERE member.userId = ?
			 ORDER BY organization.name`,
	)
		.bind(session.user.id)
		.all<{
			id: string;
			name: string;
			slug: string;
			logo: string | null;
			createdAt: number;
			role: string;
		}>();

	const activeOrganizationId = organizations.results.some(
		(organization) => organization.id === session.session.activeOrganizationId,
	)
		? (session.session.activeOrganizationId ?? null)
		: (organizations.results[0]?.id ?? null);
	const activeMembership = organizations.results.find(
		(organization) => organization.id === activeOrganizationId,
	);
	const canManageActiveOrganization =
		activeMembership?.role === "owner" || activeMembership?.role === "admin";

	const [members, invitations, receivedInvitations] = await Promise.all([
		activeOrganizationId
			? env.DB.prepare(
					`SELECT member.id, member.userId, member.role, member.createdAt, user.name, user.email, user.image
						 FROM member INNER JOIN user ON user.id = member.userId
						 WHERE member.organizationId = ?
						 ORDER BY CASE member.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, user.name`,
				)
					.bind(activeOrganizationId)
					.all<{
						id: string;
						userId: string;
						role: string;
						createdAt: number;
						name: string;
						email: string;
						image: string | null;
					}>()
			: Promise.resolve({ results: [] }),
		activeOrganizationId && canManageActiveOrganization
			? env.DB.prepare(
					`SELECT invitation.id, invitation.email, invitation.role, invitation.expiresAt, invitation.createdAt, user.name AS inviterName
						 FROM invitation INNER JOIN user ON user.id = invitation.inviterId
						 WHERE invitation.organizationId = ? AND invitation.status = 'pending'
						 ORDER BY invitation.createdAt DESC`,
				)
					.bind(activeOrganizationId)
					.all<{
						id: string;
						email: string;
						role: string | null;
						expiresAt: number;
						createdAt: number;
						inviterName: string;
					}>()
			: Promise.resolve({ results: [] }),
		env.DB.prepare(
			`SELECT invitation.id, invitation.role, invitation.expiresAt, organization.name AS organizationName
				 FROM invitation INNER JOIN organization ON organization.id = invitation.organizationId
				 WHERE lower(invitation.email) = lower(?) AND invitation.status = 'pending' AND invitation.expiresAt > ?
				 ORDER BY invitation.createdAt DESC`,
		)
			.bind(session.user.email, Date.now())
			.all<{
				id: string;
				role: string | null;
				expiresAt: number;
				organizationName: string;
			}>(),
	]);

	return {
		activeOrganizationId,
		organizations: organizations.results,
		members: members.results,
		invitations: invitations.results,
		receivedInvitations: receivedInvitations.results,
		emailVerified: session.user.emailVerified,
	};
});

export const setActiveOrganization = createServerFn({ method: "POST" })
	.validator((data: { organizationId: string }) => ({
		organizationId: data.organizationId.trim(),
	}))
	.handler(async ({ data }) => {
		await requireOrganizationManager(data.organizationId);
		if (!data.organizationId) throw new Error("Organisasi tidak sah.");
		await getAuth().api.setActiveOrganization({
			headers: getRequestHeaders(),
			body: { organizationId: data.organizationId },
		});
		return { success: true };
	});

export const inviteOrganizationMember = createServerFn({ method: "POST" })
	.validator(
		(data: {
			organizationId: string;
			email: string;
			role: OrganizationRole;
		}) => ({
			organizationId: data.organizationId.trim(),
			email: data.email.trim().toLowerCase(),
			role: data.role,
		}),
	)
	.handler(async ({ data }) => {
		await requireOrganizationManager(data.organizationId);
		if (!data.organizationId || !/^\S+@\S+\.\S+$/.test(data.email))
			throw new Error("Masukkan alamat e-mel yang sah.");
		if (!(["admin", "member"] as string[]).includes(data.role))
			throw new Error("Peranan organisasi tidak sah.");
		await getAuth().api.createInvitation({
			headers: getRequestHeaders(),
			body: {
				organizationId: data.organizationId,
				email: data.email,
				role: data.role,
				resend: true,
			},
		});
		return { success: true };
	});

export const updateOrganizationMember = createServerFn({ method: "POST" })
	.validator(
		(data: {
			organizationId: string;
			memberId: string;
			role: OrganizationRole;
		}) => data,
	)
	.handler(async ({ data }) => {
		await requireOrganizationManager(data.organizationId);
		if (!data.organizationId || !data.memberId)
			throw new Error("Ahli organisasi tidak sah.");
		if (!(["admin", "member"] as string[]).includes(data.role))
			throw new Error("Peranan organisasi tidak sah.");
		await getAuth().api.updateMemberRole({
			headers: getRequestHeaders(),
			body: {
				organizationId: data.organizationId,
				memberId: data.memberId,
				role: data.role,
			},
		});
		return { success: true };
	});

export const removeOrganizationMember = createServerFn({ method: "POST" })
	.validator(
		(data: { organizationId: string; memberIdOrEmail: string }) => data,
	)
	.handler(async ({ data }) => {
		await requireOrganizationManager(data.organizationId);
		if (!data.organizationId || !data.memberIdOrEmail)
			throw new Error("Ahli organisasi tidak sah.");
		const target = await env.DB.prepare(
			"SELECT role FROM member WHERE id = ? AND organizationId = ?",
		)
			.bind(data.memberIdOrEmail, data.organizationId)
			.first<{ role: string }>();
		if (target?.role === "owner")
			throw new Error(
				"Transfer ownership before removing the organisation owner.",
			);
		await getAuth().api.removeMember({
			headers: getRequestHeaders(),
			body: data,
		});
		return { success: true };
	});

export const cancelOrganizationInvitation = createServerFn({ method: "POST" })
	.validator((data: { invitationId: string }) => data)
	.handler(async ({ data }) => {
		if (!data.invitationId) throw new Error("Jemputan tidak sah.");
		const invitation = await env.DB.prepare(
			"SELECT organizationId FROM invitation WHERE id = ?",
		)
			.bind(data.invitationId)
			.first<{ organizationId: string }>();
		if (!invitation) throw new Error("Invitation not found.");
		await requireOrganizationManager(invitation.organizationId);
		await getAuth().api.cancelInvitation({
			headers: getRequestHeaders(),
			body: { invitationId: data.invitationId },
		});
		return { success: true };
	});

export const respondToOrganizationInvitation = createServerFn({
	method: "POST",
})
	.validator(
		(data: { invitationId: string; response: "accept" | "reject" }) => data,
	)
	.handler(async ({ data }) => {
		await requireOrganizationManager(data.organizationId);
		if (!data.invitationId || !["accept", "reject"].includes(data.response))
			throw new Error("Tindakan jemputan tidak sah.");
		const auth = getAuth();
		const request = {
			headers: getRequestHeaders(),
			body: { invitationId: data.invitationId },
		};
		if (data.response === "accept") await auth.api.acceptInvitation(request);
		else await auth.api.rejectInvitation(request);
		return { success: true };
	});

export const updateOrganizationProfile = createServerFn({ method: "POST" })
	.validator((data: { organizationId: string; name: string }) => ({
		organizationId: data.organizationId.trim(),
		name: data.name.trim(),
	}))
	.handler(async ({ data }) => {
		await requireOrganizationManager(data.organizationId);
		if (data.name.length < 3)
			throw new Error("Organisation name must be at least 3 characters.");
		await env.DB.prepare("UPDATE organization SET name = ? WHERE id = ?")
			.bind(data.name, data.organizationId)
			.run();
		return { success: true };
	});
