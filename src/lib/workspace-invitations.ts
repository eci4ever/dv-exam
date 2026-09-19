import { createServerFn } from "@tanstack/react-start";
import { and, asc, count, eq, gt, like, lt } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { auth } from "@/lib/auth";
import { auditForSession, requireAccountSession } from "@/lib/platform-core";
import {
	assertMemberRole,
	invitationState,
} from "@/lib/workspace-member-policy";
import { requireWorkspaceManager } from "@/lib/workspace-members";

function objectInput(value: unknown) {
	if (!value || typeof value !== "object") throw new Error("Invalid request.");
	return value as Record<string, unknown>;
}

function text(value: unknown, label: string) {
	if (typeof value !== "string" || !value.trim())
		throw new Error(`${label} is required.`);
	return value.trim();
}

function invitationRole(value: unknown) {
	const role = text(value, "Role");
	assertMemberRole(role);
	return role;
}

export const listWorkspaceInvitations = createServerFn({ method: "GET" })
	.validator((value: unknown) => {
		const input = value && typeof value === "object" ? objectInput(value) : {};
		return {
			search:
				typeof input.search === "string"
					? input.search.trim().slice(0, 100)
					: "",
			status: [
				"all",
				"pending",
				"expired",
				"accepted",
				"rejected",
				"canceled",
			].includes(String(input.status))
				? String(input.status)
				: "pending",
			page:
				typeof input.page === "number"
					? Math.max(1, Math.floor(input.page))
					: 1,
		};
	})
	.handler(async ({ data }) => {
		const { organizationId } = await requireWorkspaceManager();
		const now = new Date();
		const statusCondition =
			data.status === "pending"
				? and(
						eq(schema.invitation.status, "pending"),
						gt(schema.invitation.expiresAt, now),
					)
				: data.status !== "all" && data.status !== "expired"
					? eq(schema.invitation.status, data.status)
					: undefined;
		const where = and(
			eq(schema.invitation.organizationId, organizationId),
			data.search
				? like(schema.invitation.email, `%${data.search}%`)
				: undefined,
			statusCondition,
		);
		// SQLite date comparisons are emitted explicitly to keep timestamp handling consistent.
		const filteredWhere =
			data.status === "expired"
				? and(
						eq(schema.invitation.organizationId, organizationId),
						data.search
							? like(schema.invitation.email, `%${data.search}%`)
							: undefined,
						eq(schema.invitation.status, "pending"),
						lt(schema.invitation.expiresAt, now),
					)
				: where;
		const [rows, totalRows, seats, plan] = await Promise.all([
			db
				.select({
					id: schema.invitation.id,
					email: schema.invitation.email,
					role: schema.invitation.role,
					status: schema.invitation.status,
					expiresAt: schema.invitation.expiresAt,
					createdAt: schema.invitation.createdAt,
					inviterName: schema.user.name,
				})
				.from(schema.invitation)
				.innerJoin(schema.user, eq(schema.user.id, schema.invitation.inviterId))
				.where(filteredWhere)
				.orderBy(asc(schema.invitation.expiresAt))
				.limit(25)
				.offset((data.page - 1) * 25),
			db
				.select({ total: count() })
				.from(schema.invitation)
				.where(filteredWhere),
			Promise.all([
				db
					.select({ total: count() })
					.from(schema.member)
					.where(eq(schema.member.organizationId, organizationId)),
				db
					.select({ total: count() })
					.from(schema.invitation)
					.where(
						and(
							eq(schema.invitation.organizationId, organizationId),
							eq(schema.invitation.status, "pending"),
							gt(schema.invitation.expiresAt, now),
						),
					),
			]).then(
				([members, pending]) =>
					(members[0]?.total ?? 0) + (pending[0]?.total ?? 0),
			),
			db
				.select({ memberLimit: schema.platformPlan.memberLimit })
				.from(schema.organizationEntitlement)
				.innerJoin(
					schema.platformPlan,
					eq(schema.platformPlan.id, schema.organizationEntitlement.planId),
				)
				.where(
					eq(schema.organizationEntitlement.organizationId, organizationId),
				)
				.limit(1)
				.then((values) => values[0]),
		]);
		const normalized = rows.map((row) => ({
			...row,
			status:
				row.status === "pending" && row.expiresAt <= now
					? "expired"
					: row.status,
		}));
		const total = totalRows[0]?.total ?? 0;
		return {
			rows: normalized,
			total,
			page: data.page,
			pageCount: Math.max(1, Math.ceil(total / 25)),
			seats,
			memberLimit: plan?.memberLimit ?? 0,
		};
	});

export const inviteWorkspaceMember = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = objectInput(value);
		const email = text(input.email, "Email").toLowerCase();
		if (!/^\S+@\S+\.\S+$/.test(email))
			throw new Error("Enter a valid email address.");
		return { email, role: invitationRole(input.role) };
	})
	.handler(async ({ data }) => {
		const { headers, organizationId } = await requireWorkspaceManager({
			writable: true,
		});
		await auth.api.createInvitation({
			headers,
			body: { organizationId, email: data.email, role: data.role },
		});
		return { success: true };
	});

async function scopedInvitation(invitationId: string, organizationId: string) {
	const [invitation] = await db
		.select()
		.from(schema.invitation)
		.where(
			and(
				eq(schema.invitation.id, invitationId),
				eq(schema.invitation.organizationId, organizationId),
			),
		)
		.limit(1);
	if (!invitation) throw new Error("Invitation not found.");
	return invitation;
}

export const resendWorkspaceInvitation = createServerFn({ method: "POST" })
	.validator((value: unknown) => ({
		invitationId: text(objectInput(value).invitationId, "Invitation"),
	}))
	.handler(async ({ data }) => {
		const { headers, session, organizationId } = await requireWorkspaceManager({
			writable: true,
		});
		const invitation = await scopedInvitation(
			data.invitationId,
			organizationId,
		);
		if (invitation.status !== "pending")
			throw new Error("Only pending invitations can be resent.");
		await auth.api.createInvitation({
			headers,
			body: {
				organizationId,
				email: invitation.email,
				role: invitationRole(invitation.role),
				resend: true,
			},
		});
		await auditForSession(session, {
			category: "organization",
			type: "workspace.invitation-resent",
			organizationId,
			targetType: "organization",
			targetId: organizationId,
			metadata: { role: invitation.role },
		});
		return { success: true };
	});

export const cancelWorkspaceInvitation = createServerFn({ method: "POST" })
	.validator((value: unknown) => ({
		invitationId: text(objectInput(value).invitationId, "Invitation"),
	}))
	.handler(async ({ data }) => {
		const { headers, organizationId } = await requireWorkspaceManager({
			writable: true,
		});
		const invitation = await scopedInvitation(
			data.invitationId,
			organizationId,
		);
		if (invitation.status !== "pending")
			throw new Error("Only pending invitations can be cancelled.");
		await auth.api.cancelInvitation({
			headers,
			body: { invitationId: invitation.id },
		});
		return { success: true };
	});

function maskEmail(email: string) {
	const [local, domain] = email.split("@");
	if (!domain) return "Hidden email";
	return `${local.slice(0, 1)}${"•".repeat(Math.max(2, Math.min(6, local.length - 1)))}@${domain}`;
}

export const getInvitationPreview = createServerFn({ method: "GET" })
	.validator((value: unknown) => ({
		invitationId: text(objectInput(value).invitationId, "Invitation"),
	}))
	.handler(async ({ data }) => {
		const [invitation] = await db
			.select({
				id: schema.invitation.id,
				email: schema.invitation.email,
				role: schema.invitation.role,
				status: schema.invitation.status,
				expiresAt: schema.invitation.expiresAt,
				organizationName: schema.organization.name,
			})
			.from(schema.invitation)
			.innerJoin(
				schema.organization,
				eq(schema.organization.id, schema.invitation.organizationId),
			)
			.where(eq(schema.invitation.id, data.invitationId))
			.limit(1);
		if (!invitation) return { state: "invalid" as const };
		const state = invitationState(invitation.status, invitation.expiresAt);
		return {
			state,
			organizationName: invitation.organizationName,
			role: invitation.role,
			maskedEmail: maskEmail(invitation.email),
			expiresAt: invitation.expiresAt,
		};
	});

export const acceptWorkspaceInvitation = createServerFn({ method: "POST" })
	.validator((value: unknown) => ({
		invitationId: text(objectInput(value).invitationId, "Invitation"),
	}))
	.handler(async ({ data }) => {
		const { headers } = await requireAccountSession({ writable: true });
		const result = await auth.api.acceptInvitation({
			headers,
			body: { invitationId: data.invitationId },
		});
		await auth.api.setActiveOrganization({
			headers,
			body: { organizationId: result.member.organizationId },
		});
		return { organizationId: result.member.organizationId };
	});

export const rejectWorkspaceInvitation = createServerFn({ method: "POST" })
	.validator((value: unknown) => ({
		invitationId: text(objectInput(value).invitationId, "Invitation"),
	}))
	.handler(async ({ data }) => {
		const { headers } = await requireAccountSession({ writable: true });
		await auth.api.rejectInvitation({
			headers,
			body: { invitationId: data.invitationId },
		});
		return { success: true };
	});
