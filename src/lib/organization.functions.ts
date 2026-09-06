import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { getAuth } from "./auth";
import {
	requireOrganizationMember,
	requireOrganizationPermission,
	requireSession,
} from "#/server/auth/authorization";
import { canUpdateOrganizationMemberRole } from "#/server/auth/authorization-policy";
import {
	cancelOrganizationInvitationSchema,
	inviteOrganizationMemberSchema,
	removeOrganizationMemberSchema,
	respondToOrganizationInvitationSchema,
	setActiveOrganizationSchema,
	updateOrganizationMemberSchema,
	updateOrganizationProfileSchema,
} from "#/server/validation/organization";
import { writeAuditEvent } from "#/server/audit/events.server";

async function requireOrganizationManager(organizationId: string) {
	const { session } = await requireOrganizationPermission({
		organizationId,
		permission: "organization:manage",
	});
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
	.validator((data: unknown) => setActiveOrganizationSchema.parse(data))
	.handler(async ({ data }) => {
		await requireOrganizationMember(data.organizationId);
		await getAuth().api.setActiveOrganization({
			headers: getRequestHeaders(),
			body: { organizationId: data.organizationId },
		});
		return { success: true };
	});

export const inviteOrganizationMember = createServerFn({ method: "POST" })
	.validator((data: unknown) => inviteOrganizationMemberSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await requireOrganizationManager(data.organizationId);
		await getAuth().api.createInvitation({
			headers: getRequestHeaders(),
			body: {
				organizationId: data.organizationId,
				email: data.email,
				role: data.role,
				resend: true,
			},
		});
		await writeAuditEvent({
			action: "organization.invitation.create",
			actorUserId: session.user.id,
			targetType: "invitation",
			targetId: null,
			reason: "Organisation invitation created",
			metadata: {
				organizationId: data.organizationId,
				email: data.email,
				role: data.role,
			},
		});
		return { success: true };
	});

export const updateOrganizationMember = createServerFn({ method: "POST" })
	.validator((data: unknown) => updateOrganizationMemberSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await requireOrganizationManager(data.organizationId);
		const target = await env.DB.prepare(
			"SELECT role FROM member WHERE id = ? AND organizationId = ?",
		)
			.bind(data.memberId, data.organizationId)
			.first<{ role: string }>();
		if (!target) throw new Error("Organisation member not found.");
		if (!canUpdateOrganizationMemberRole(target.role))
			throw new Error(
				"Transfer ownership before changing the organisation owner's role.",
			);
		await getAuth().api.updateMemberRole({
			headers: getRequestHeaders(),
			body: {
				organizationId: data.organizationId,
				memberId: data.memberId,
				role: data.role,
			},
		});
		await writeAuditEvent({
			action: "organization.member.role.update",
			actorUserId: session.user.id,
			targetType: "member",
			targetId: data.memberId,
			reason: "Organisation member role updated",
			metadata: { organizationId: data.organizationId, role: data.role },
		});
		return { success: true };
	});

export const removeOrganizationMember = createServerFn({ method: "POST" })
	.validator((data: unknown) => removeOrganizationMemberSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await requireOrganizationManager(data.organizationId);
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
		await writeAuditEvent({
			action: "organization.member.remove",
			actorUserId: session.user.id,
			targetType: "member",
			targetId: data.memberIdOrEmail,
			reason: "Organisation member removed",
			metadata: { organizationId: data.organizationId },
		});
		return { success: true };
	});

export const cancelOrganizationInvitation = createServerFn({ method: "POST" })
	.validator((data: unknown) => cancelOrganizationInvitationSchema.parse(data))
	.handler(async ({ data }) => {
		const invitation = await env.DB.prepare(
			"SELECT organizationId FROM invitation WHERE id = ?",
		)
			.bind(data.invitationId)
			.first<{ organizationId: string }>();
		if (!invitation) throw new Error("Invitation not found.");
		const session = await requireOrganizationManager(invitation.organizationId);
		await getAuth().api.cancelInvitation({
			headers: getRequestHeaders(),
			body: { invitationId: data.invitationId },
		});
		await writeAuditEvent({
			action: "organization.invitation.cancel",
			actorUserId: session.user.id,
			targetType: "invitation",
			targetId: data.invitationId,
			reason: "Organisation invitation cancelled",
			metadata: { organizationId: invitation.organizationId },
		});
		return { success: true };
	});

export const respondToOrganizationInvitation = createServerFn({
	method: "POST",
})
	.validator((data: unknown) =>
		respondToOrganizationInvitationSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const session = await requireSession();
		const invitation = await env.DB.prepare(
			"SELECT organizationId FROM invitation WHERE id = ?",
		)
			.bind(data.invitationId)
			.first<{ organizationId: string }>();
		const auth = getAuth();
		const request = {
			headers: getRequestHeaders(),
			body: { invitationId: data.invitationId },
		};
		if (data.response === "accept") await auth.api.acceptInvitation(request);
		else await auth.api.rejectInvitation(request);
		await writeAuditEvent({
			action: `organization.invitation.${data.response}`,
			actorUserId: session.user.id,
			targetType: "invitation",
			targetId: data.invitationId,
			reason: "Organisation invitation response",
			metadata: { organizationId: invitation?.organizationId ?? null },
		});
		return { success: true };
	});

export const updateOrganizationProfile = createServerFn({ method: "POST" })
	.validator((data: unknown) => updateOrganizationProfileSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await requireOrganizationManager(data.organizationId);
		await env.DB.prepare("UPDATE organization SET name = ? WHERE id = ?")
			.bind(data.name, data.organizationId)
			.run();
		await writeAuditEvent({
			action: "organization.profile.update",
			actorUserId: session.user.id,
			targetType: "organization",
			targetId: data.organizationId,
			reason: "Organisation profile updated",
			metadata: { name: data.name },
		});
		return { success: true };
	});
