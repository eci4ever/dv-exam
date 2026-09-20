import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { and, asc, count, eq, like, ne, or, sql } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { auth } from "@/lib/auth";
import {
	auditForSession,
	requireAccountSession,
	requireActiveOrganization,
} from "@/lib/platform-core";
import {
	assertMemberCanBeManaged,
	assertMemberRole,
	assertWorkspaceManager,
} from "@/lib/workspace-member-policy";

function inputObject(value: unknown) {
	if (!value || typeof value !== "object") throw new Error("Invalid request.");
	return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string) {
	if (typeof value !== "string" || !value.trim())
		throw new Error(`${label} is required.`);
	return value.trim();
}

export const requireWorkspaceManager = createServerOnlyFn(
	async (options?: { writable?: boolean }) => {
		const { headers, session } = await requireAccountSession(options);
		const organizations = await auth.api.listOrganizations({ headers });
		const organizationId =
			session.session.activeOrganizationId ?? organizations[0]?.id;
		if (!organizationId) throw new Error("Select a workspace to continue.");
		const [membership] = await db
			.select({ id: schema.member.id, role: schema.member.role })
			.from(schema.member)
			.where(
				and(
					eq(schema.member.organizationId, organizationId),
					eq(schema.member.userId, session.user.id),
				),
			)
			.limit(1);
		if (!membership) throw new Error("Workspace access is required.");
		assertWorkspaceManager(membership.role);
		await requireActiveOrganization(organizationId);
		return { headers, session, organizationId, membership };
	},
);

export const listWorkspaceMembers = createServerFn({ method: "GET" })
	.validator((value: unknown) => {
		const input =
			value && typeof value === "object"
				? (value as Record<string, unknown>)
				: {};
		return {
			search:
				typeof input.search === "string"
					? input.search.trim().slice(0, 100)
					: "",
			role: ["owner", "admin", "teacher", "student"].includes(
				String(input.role),
			)
				? String(input.role)
				: "all",
			page:
				typeof input.page === "number"
					? Math.max(1, Math.floor(input.page))
					: 1,
		};
	})
	.handler(async ({ data }) => {
		const { session, organizationId, membership } =
			await requireWorkspaceManager();
		const conditions = [
			eq(schema.member.organizationId, organizationId),
			data.search
				? or(
						like(schema.user.name, `%${data.search}%`),
						like(schema.user.email, `%${data.search}%`),
					)
				: undefined,
			data.role !== "all"
				? or(
						eq(schema.member.role, data.role),
						like(schema.member.role, `${data.role},%`),
						like(schema.member.role, `%,${data.role}`),
						like(schema.member.role, `%,${data.role},%`),
					)
				: undefined,
		];
		const where = and(...conditions);
		const [rows, totals, entitlement] = await Promise.all([
			db
				.select({
					id: schema.member.id,
					userId: schema.user.id,
					name: schema.user.name,
					email: schema.user.email,
					image: schema.user.image,
					role: schema.member.role,
					createdAt: schema.member.createdAt,
				})
				.from(schema.member)
				.innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
				.where(where)
				.orderBy(
					sql`case when ${schema.member.role} = 'owner' then 0 else 1 end`,
					asc(schema.user.name),
				)
				.limit(25)
				.offset((data.page - 1) * 25),
			db
				.select({ total: count() })
				.from(schema.member)
				.innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
				.where(where),
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
		const [usage] = await db
			.select({ total: count() })
			.from(schema.member)
			.where(eq(schema.member.organizationId, organizationId));
		const total = totals[0]?.total ?? 0;
		return {
			rows,
			total,
			page: data.page,
			pageCount: Math.max(1, Math.ceil(total / 25)),
			usage: usage?.total ?? 0,
			memberLimit: entitlement?.memberLimit ?? 0,
			currentUserId: session.user.id,
			currentRole: membership.role,
		};
	});

export const updateWorkspaceMemberRole = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = inputObject(value);
		const role = requiredString(input.role, "Role");
		assertMemberRole(role);
		return { memberId: requiredString(input.memberId, "Member"), role };
	})
	.handler(async ({ data }) => {
		const { session, organizationId, membership } =
			await requireWorkspaceManager({ writable: true });
		const [target] = await db
			.select({
				id: schema.member.id,
				userId: schema.member.userId,
				role: schema.member.role,
			})
			.from(schema.member)
			.where(
				and(
					eq(schema.member.id, data.memberId),
					eq(schema.member.organizationId, organizationId),
				),
			)
			.limit(1);
		if (!target) throw new Error("Workspace member not found.");
		assertMemberCanBeManaged({
			actorUserId: session.user.id,
			actorRole: membership.role,
			targetUserId: target.userId,
			targetRole: target.role,
			action: "update",
		});
		await db.batch([
			db
				.update(schema.member)
				.set({ role: data.role })
				.where(eq(schema.member.id, target.id)),
			db
				.delete(schema.academicClassMember)
				.where(
					and(
						eq(schema.academicClassMember.memberId, target.id),
						data.role === "admin"
							? undefined
							: ne(schema.academicClassMember.role, data.role),
					),
				),
		]);
		await auditForSession(session, {
			category: "organization",
			type: "workspace.member-role-updated",
			organizationId,
			targetType: "member",
			targetId: target.id,
			metadata: { role: data.role },
		});
		return { success: true };
	});

export const removeWorkspaceMember = createServerFn({ method: "POST" })
	.validator((value: unknown) => ({
		memberId: requiredString(inputObject(value).memberId, "Member"),
	}))
	.handler(async ({ data }) => {
		const { session, organizationId, membership } =
			await requireWorkspaceManager({ writable: true });
		const [target] = await db
			.select({
				id: schema.member.id,
				userId: schema.member.userId,
				role: schema.member.role,
			})
			.from(schema.member)
			.where(
				and(
					eq(schema.member.id, data.memberId),
					eq(schema.member.organizationId, organizationId),
				),
			)
			.limit(1);
		if (!target) throw new Error("Workspace member not found.");
		assertMemberCanBeManaged({
			actorUserId: session.user.id,
			actorRole: membership.role,
			targetUserId: target.userId,
			targetRole: target.role,
			action: "remove",
		});
		await db.delete(schema.member).where(eq(schema.member.id, target.id));
		await auditForSession(session, {
			category: "organization",
			type: "workspace.member-removed",
			organizationId,
			targetType: "member",
			targetId: target.id,
		});
		return { success: true };
	});

export const transferWorkspaceOwnership = createServerFn({ method: "POST" })
	.validator((value: unknown) => ({
		memberId: requiredString(inputObject(value).memberId, "Member"),
	}))
	.handler(async ({ data }) => {
		const { session, organizationId, membership } =
			await requireWorkspaceManager({ writable: true });
		const [target] = await db
			.select({
				id: schema.member.id,
				userId: schema.member.userId,
				role: schema.member.role,
			})
			.from(schema.member)
			.where(
				and(
					eq(schema.member.id, data.memberId),
					eq(schema.member.organizationId, organizationId),
				),
			)
			.limit(1);
		if (!target) throw new Error("Workspace member not found.");
		assertMemberCanBeManaged({
			actorUserId: session.user.id,
			actorRole: membership.role,
			targetUserId: target.userId,
			targetRole: target.role,
			action: "transfer",
		});
		await db.batch([
			db
				.update(schema.member)
				.set({ role: "admin" })
				.where(
					and(
						eq(schema.member.organizationId, organizationId),
						eq(schema.member.userId, session.user.id),
						eq(schema.member.role, "owner"),
					),
				),
			db
				.update(schema.member)
				.set({ role: "owner" })
				.where(
					and(
						eq(schema.member.id, target.id),
						eq(schema.member.organizationId, organizationId),
					),
				),
		]);
		await auditForSession(session, {
			category: "organization",
			type: "workspace.ownership-transferred",
			organizationId,
			targetType: "member",
			targetId: target.id,
		});
		return { success: true };
	});
