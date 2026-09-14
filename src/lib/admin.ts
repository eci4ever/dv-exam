import { createServerFn } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";
import { and, asc, count, desc, eq, isNull, like, or } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { auth } from "@/lib/auth";
import { auditForSession, requirePlatformAdmin } from "@/lib/platform-core";
import {
	assertLastActiveAdminSafe,
	assertUserHasNoOwnedOrganizations,
} from "@/lib/platform-policy";

async function protectAdminMutation(
	userId: string,
	action: "demote" | "ban" | "delete",
) {
	const [[target], [activeAdmins]] = await Promise.all([
		db
			.select({ role: schema.user.role, banned: schema.user.banned })
			.from(schema.user)
			.where(eq(schema.user.id, userId))
			.limit(1),
		db
			.select({ count: count() })
			.from(schema.user)
			.where(
				and(
					eq(schema.user.role, "admin"),
					or(eq(schema.user.banned, false), isNull(schema.user.banned)),
				),
			),
	]);
	if (!target) throw new Error("User not found.");
	assertLastActiveAdminSafe({
		action,
		targetIsActiveAdmin: Boolean(
			target.role?.split(",").includes("admin") && !target.banned,
		),
		activeAdminCount: activeAdmins?.count ?? 0,
	});
}

function objectInput(value: unknown) {
	if (!value || typeof value !== "object") throw new Error("Invalid request.");
	return value as Record<string, unknown>;
}

function requiredText(value: unknown, label: string, min = 1, max = 120) {
	if (typeof value !== "string") throw new Error(`${label} is required.`);
	const text = value.trim();
	if (text.length < min || text.length > max)
		throw new Error(`${label} must be between ${min} and ${max} characters.`);
	return text;
}

const listValidator = (value: unknown) => {
	const input =
		value && typeof value === "object"
			? (value as Record<string, unknown>)
			: {};
	return {
		search:
			typeof input.search === "string" ? input.search.trim().slice(0, 100) : "",
		role: input.role === "admin" || input.role === "user" ? input.role : "all",
		status:
			input.status === "active" || input.status === "banned"
				? input.status
				: "all",
		page:
			typeof input.page === "number" && Number.isInteger(input.page)
				? Math.max(1, input.page)
				: 1,
		sortBy:
			input.sortBy === "name" ||
			input.sortBy === "email" ||
			input.sortBy === "createdAt"
				? input.sortBy
				: "createdAt",
		sortDirection: input.sortDirection === "asc" ? "asc" : "desc",
	};
};

export const listPlatformUsers = createServerFn({ method: "GET" })
	.validator(listValidator)
	.handler(async ({ data }) => {
		await requirePlatformAdmin();
		const conditions = [
			data.search
				? or(
						like(schema.user.name, `%${data.search}%`),
						like(schema.user.email, `%${data.search}%`),
					)
				: undefined,
			data.role === "admin"
				? eq(schema.user.role, "admin")
				: data.role === "user"
					? or(eq(schema.user.role, "user"), isNull(schema.user.role))
					: undefined,
			data.status === "banned"
				? eq(schema.user.banned, true)
				: data.status === "active"
					? or(eq(schema.user.banned, false), isNull(schema.user.banned))
					: undefined,
		].filter(Boolean);
		const where = conditions.length ? and(...conditions) : undefined;
		const sortColumn =
			data.sortBy === "name"
				? schema.user.name
				: data.sortBy === "email"
					? schema.user.email
					: schema.user.createdAt;
		const direction = data.sortDirection === "asc" ? asc : desc;
		const [users, totals] = await Promise.all([
			db
				.select({
					id: schema.user.id,
					name: schema.user.name,
					email: schema.user.email,
					image: schema.user.image,
					role: schema.user.role,
					banned: schema.user.banned,
					banReason: schema.user.banReason,
					banExpires: schema.user.banExpires,
					createdAt: schema.user.createdAt,
				})
				.from(schema.user)
				.where(where)
				.orderBy(direction(sortColumn))
				.limit(25)
				.offset((data.page - 1) * 25),
			db.select({ total: count() }).from(schema.user).where(where),
		]);
		const total = totals[0]?.total ?? 0;
		return {
			users,
			total,
			page: data.page,
			pageCount: Math.max(1, Math.ceil(total / 25)),
		};
	});

export const getAdminUsers = createServerFn({ method: "GET" }).handler(() =>
	listPlatformUsers({ data: {} }),
);

export const listUserProvisioningOrganizations = createServerFn({
	method: "GET",
}).handler(async () => {
	await requirePlatformAdmin();
	return db
		.select({ id: schema.organization.id, name: schema.organization.name })
		.from(schema.organization)
		.orderBy(asc(schema.organization.name));
});

export const createPlatformUser = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = objectInput(value);
		const mode = input.mode === "organization" ? "organization" : "workspace";
		const organizationRole =
			input.organizationRole === "admin" || input.organizationRole === "teacher"
				? input.organizationRole
				: "student";
		return {
			name: requiredText(input.name, "Name", 2, 80),
			email: requiredText(input.email, "Email", 3, 160).toLowerCase(),
			password: requiredText(input.password, "Temporary password", 8, 128),
			mode,
			organizationId:
				typeof input.organizationId === "string" ? input.organizationId : "",
			organizationRole,
		};
	})
	.handler(async ({ data }) => {
		const { headers, session } = await requirePlatformAdmin({ writable: true });
		const created = await auth.api.createUser({
			headers,
			body: {
				name: data.name,
				email: data.email,
				password: data.password,
				role: "user",
			},
		});
		const createdId = created.user.id;
		let createdOrganizationId: string | null = null;
		try {
			if (data.mode === "workspace") {
				const firstName = data.name.split(/\s+/)[0] || "Personal";
				const slug = `${
					firstName
						.toLowerCase()
						.replace(/[^a-z0-9]+/g, "-")
						.replace(/^-|-$/g, "") || "personal"
				}-workspace-${createdId.toLowerCase()}`;
				const organization = await auth.api.createOrganization({
					body: { name: `${firstName}'s workspace`, slug, userId: createdId },
				});
				createdOrganizationId = organization?.id ?? null;
			} else {
				if (!data.organizationId) throw new Error("Select an organization.");
				await auth.api.addMember({
					body: {
						organizationId: data.organizationId,
						userId: createdId,
						role: data.organizationRole as "admin" | "teacher" | "student",
					},
				});
			}
		} catch (error) {
			if (createdOrganizationId)
				await db
					.delete(schema.organization)
					.where(eq(schema.organization.id, createdOrganizationId));
			await auth.api.removeUser({ headers, body: { userId: createdId } });
			throw error;
		}
		await auditForSession(session, {
			category: "user",
			type: "user.created",
			targetType: "user",
			targetId: createdId,
			organizationId:
				data.mode === "organization"
					? data.organizationId
					: createdOrganizationId,
			metadata: { mode: data.mode, role: data.organizationRole },
		});
		return created.user;
	});

const userIdValidator = (value: unknown) => ({
	userId: requiredText(objectInput(value).userId, "User"),
});

export const updatePlatformUser = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = objectInput(value);
		return {
			userId: requiredText(input.userId, "User"),
			name: requiredText(input.name, "Name", 2, 80),
		};
	})
	.handler(async ({ data }) => {
		const { headers, session } = await requirePlatformAdmin({ writable: true });
		await auth.api.adminUpdateUser({
			headers,
			body: { userId: data.userId, data: { name: data.name } },
		});
		await auditForSession(session, {
			category: "user",
			type: "user.updated",
			targetType: "user",
			targetId: data.userId,
			metadata: { name: data.name },
		});
		return { success: true };
	});

export const setPlatformUserRole = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = objectInput(value);
		return {
			userId: requiredText(input.userId, "User"),
			role: input.role === "admin" ? "admin" : "user",
		} as const;
	})
	.handler(async ({ data }) => {
		const { headers, session } = await requirePlatformAdmin({ writable: true });
		if (data.role !== "admin")
			await protectAdminMutation(data.userId, "demote");
		await auth.api.setRole({ headers, body: data });
		await auditForSession(session, {
			category: "security",
			type: "user.role-updated",
			targetType: "user",
			targetId: data.userId,
			metadata: { role: data.role },
		});
		return { success: true };
	});

export const setPlatformUserPassword = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = objectInput(value);
		return {
			userId: requiredText(input.userId, "User"),
			newPassword: requiredText(input.newPassword, "Password", 8, 128),
		};
	})
	.handler(async ({ data }) => {
		const { headers, session } = await requirePlatformAdmin({ writable: true });
		await auth.api.setUserPassword({ headers, body: data });
		await auditForSession(session, {
			category: "security",
			type: "user.password-reset",
			targetType: "user",
			targetId: data.userId,
		});
		return { success: true };
	});

export const setPlatformUserBan = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = objectInput(value);
		return {
			userId: requiredText(input.userId, "User"),
			banned: input.banned === true,
			reason:
				input.banned === true
					? requiredText(input.reason, "Ban reason", 3, 240)
					: "",
			duration:
				input.duration === "24h" ||
				input.duration === "7d" ||
				input.duration === "30d"
					? input.duration
					: "permanent",
		} as const;
	})
	.handler(async ({ data }) => {
		const { headers, session } = await requirePlatformAdmin({ writable: true });
		if (data.banned) await protectAdminMutation(data.userId, "ban");
		const seconds =
			data.duration === "24h"
				? 86_400
				: data.duration === "7d"
					? 604_800
					: data.duration === "30d"
						? 2_592_000
						: undefined;
		if (data.banned)
			await auth.api.banUser({
				headers,
				body: {
					userId: data.userId,
					banReason: data.reason,
					banExpiresIn: seconds,
				},
			});
		else await auth.api.unbanUser({ headers, body: { userId: data.userId } });
		await auditForSession(session, {
			category: "security",
			type: data.banned ? "user.banned" : "user.unbanned",
			targetType: "user",
			targetId: data.userId,
			metadata: data.banned
				? { reason: data.reason, duration: data.duration }
				: {},
		});
		return { success: true };
	});

export const listPlatformUserSessions = createServerFn({ method: "GET" })
	.validator(userIdValidator)
	.handler(async ({ data }) => {
		const { headers } = await requirePlatformAdmin();
		return auth.api.listUserSessions({ headers, body: data });
	});
export const revokePlatformUserSessions = createServerFn({ method: "POST" })
	.validator(userIdValidator)
	.handler(async ({ data }) => {
		const { headers, session } = await requirePlatformAdmin({ writable: true });
		await auth.api.revokeUserSessions({ headers, body: data });
		await auditForSession(session, {
			category: "security",
			type: "user.sessions-revoked",
			targetType: "user",
			targetId: data.userId,
		});
		return { success: true };
	});
export const revokePlatformUserSession = createServerFn({ method: "POST" })
	.validator((value: unknown) => ({
		sessionToken: requiredText(objectInput(value).sessionToken, "Session"),
	}))
	.handler(async ({ data }) => {
		const { headers, session } = await requirePlatformAdmin({ writable: true });
		await auth.api.revokeUserSession({ headers, body: data });
		await auditForSession(session, {
			category: "security",
			type: "user.session-revoked",
			targetType: "session",
		});
		return { success: true };
	});

export const impersonatePlatformUser = createServerFn({ method: "POST" })
	.validator(userIdValidator)
	.handler(async ({ data }) => {
		const { headers, session } = await requirePlatformAdmin({ writable: true });
		await auditForSession(session, {
			category: "security",
			type: "user.impersonation-started",
			targetType: "user",
			targetId: data.userId,
		});
		const result = await auth.api.impersonateUser({
			headers,
			body: data,
			returnHeaders: true,
		});
		setResponseHeaders(result.headers);
		return result.response;
	});

export const deletePlatformUser = createServerFn({ method: "POST" })
	.validator(userIdValidator)
	.handler(async ({ data }) => {
		const { headers, session } = await requirePlatformAdmin({ writable: true });
		await protectAdminMutation(data.userId, "delete");
		const [owned] = await db
			.select({ count: count() })
			.from(schema.member)
			.where(
				and(
					eq(schema.member.userId, data.userId),
					eq(schema.member.role, "owner"),
				),
			);
		assertUserHasNoOwnedOrganizations(owned?.count ?? 0);
		await auth.api.removeUser({ headers, body: data });
		await auditForSession(session, {
			category: "user",
			type: "user.deleted",
			targetType: "user",
			targetId: data.userId,
		});
		return { success: true };
	});
