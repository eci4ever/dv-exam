import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { getAuth } from "./auth";
import { requireGlobalAdmin } from "#/server/auth/authorization";
import { writeAuditEvent } from "#/server/audit/events.server";
import {
	createOrganizationSchema,
	platformAuditLogQuerySchema,
	platformOrganizationsQuerySchema,
	platformUsersQuerySchema,
	resendUserVerificationSchema,
	revokeUserSessionsSchema,
	setOrganizationOwnerSchema,
	updateOrganizationLifecycleSchema,
	updatePlatformOrganizationSchema,
	updatePlatformSettingsSchema,
	updateUserAccessSchema,
} from "#/server/validation/super-admin";

async function writeAudit(
	actorUserId: string,
	action: string,
	targetType: string,
	targetId: string | null,
	reason: string,
	metadata: Record<string, unknown> = {},
) {
	await writeAuditEvent({
		actorUserId,
		action,
		targetType,
		targetId,
		reason,
		metadata,
	});
}

function requireReason(reason: string) {
	const value = reason.trim();
	if (value.length < 3)
		throw new Error("A reason of at least 3 characters is required.");
	return value;
}

async function requireSuperAdmin() {
	return requireGlobalAdmin();
}

function slugify(value: string) {
	return value
		.toLowerCase()
		.trim()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "")
		.slice(0, 60);
}

export const getSuperAdminOverview = createServerFn({ method: "GET" }).handler(
	async () => {
		await requireSuperAdmin();
		const [
			organizationCount,
			userCount,
			activeSessionCount,
			organizations,
			users,
		] = await Promise.all([
			env.DB.prepare("SELECT COUNT(*) AS count FROM organization").first<{
				count: number;
			}>(),
			env.DB.prepare("SELECT COUNT(*) AS count FROM user").first<{
				count: number;
			}>(),
			env.DB.prepare(
				"SELECT COUNT(*) AS count FROM session WHERE expiresAt > ?",
			)
				.bind(Date.now())
				.first<{ count: number }>(),
			env.DB.prepare(
				`SELECT organization.id, organization.name, organization.slug, organization.createdAt, COUNT(DISTINCT member.id) AS memberCount, COUNT(DISTINCT CASE WHEN invitation.status = 'pending' THEN invitation.id END) AS pendingInvitationCount, MAX(CASE WHEN instr(member.role, 'owner') > 0 THEN user.name END) AS ownerName, MAX(CASE WHEN instr(member.role, 'owner') > 0 THEN user.email END) AS ownerEmail FROM organization LEFT JOIN member ON member.organizationId = organization.id LEFT JOIN user ON user.id = member.userId LEFT JOIN invitation ON invitation.organizationId = organization.id GROUP BY organization.id ORDER BY organization.createdAt DESC LIMIT 8`,
			).all<{
				id: string;
				name: string;
				slug: string;
				createdAt: number;
				memberCount: number;
				pendingInvitationCount: number;
				ownerName: string | null;
				ownerEmail: string | null;
			}>(),
			env.DB.prepare(
				"SELECT id, name, email, role, banned, createdAt FROM user ORDER BY createdAt DESC LIMIT 8",
			).all<{
				id: string;
				name: string;
				email: string;
				role: string | null;
				banned: number | null;
				createdAt: number;
			}>(),
		]);
		return {
			metrics: {
				organizations: organizationCount?.count ?? 0,
				users: userCount?.count ?? 0,
				activeSessions: activeSessionCount?.count ?? 0,
			},
			organizations: organizations.results,
			users: users.results,
		};
	},
);

export const createOrganization = createServerFn({ method: "POST" })
	.validator((data: unknown) => createOrganizationSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await requireSuperAdmin();
		const baseSlug = slugify(data.name);
		if (!baseSlug)
			throw new Error("Nama organisasi tidak boleh dijadikan slug.");
		const existing = await env.DB.prepare(
			"SELECT id FROM organization WHERE slug = ?",
		)
			.bind(baseSlug)
			.first();
		const slug = existing
			? `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`
			: baseSlug;
		const auth = getAuth();
		const organization = await auth.api.createOrganization({
			body: { name: data.name, slug, userId: session.user.id },
		});
		if (data.adminEmail)
			await auth.api.createInvitation({
				headers: getRequestHeaders(),
				body: {
					email: data.adminEmail,
					role: "admin",
					organizationId: organization.id,
				},
			});
		await writeAudit(
			session.user.id,
			"organization.create",
			"organization",
			organization.id,
			"Platform organisation creation",
			{ name: organization.name, adminEmail: data.adminEmail || null },
		);
		return { id: organization.id, name: organization.name };
	});

export const updateUserAccess = createServerFn({ method: "POST" })
	.validator((data: unknown) => updateUserAccessSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await requireSuperAdmin();
		const reason = requireReason(data.reason);
		if (
			data.userId === session.user.id &&
			(data.action === "ban" || data.action === "make-user")
		)
			throw new Error("Anda tidak boleh menukar akses Super Admin sendiri.");
		if (data.action === "make-user" || data.action === "ban") {
			const target = await env.DB.prepare(
				"SELECT role, banned FROM user WHERE id = ?",
			)
				.bind(data.userId)
				.first<{ role: string | null; banned: number | null }>();
			if (!target) throw new Error("User not found.");
			if (target.role === "admin" && !target.banned) {
				const activeAdminCount = await env.DB.prepare(
					"SELECT COUNT(*) AS count FROM user WHERE role = 'admin' AND (banned = 0 OR banned IS NULL)",
				).first<{ count: number }>();
				if ((activeAdminCount?.count ?? 0) <= 1)
					throw new Error(
						"The final active platform admin cannot be removed or suspended.",
					);
			}
		}
		const auth = getAuth();
		const headers = getRequestHeaders();
		if (data.action === "ban")
			await auth.api.banUser({
				headers,
				body: { userId: data.userId, banReason: "Dikawal oleh Super Admin" },
			});
		else if (data.action === "unban")
			await auth.api.unbanUser({ headers, body: { userId: data.userId } });
		else
			await auth.api.setRole({
				headers,
				body: {
					userId: data.userId,
					role: data.action === "make-admin" ? "admin" : "user",
				},
			});
		await writeAudit(session.user.id, data.action, "user", data.userId, reason);
		return { success: true };
	});

export const getPlatformUsers = createServerFn({ method: "GET" })
	.validator((data: unknown) => platformUsersQuerySchema.parse(data))
	.handler(async ({ data }) => {
		await requireSuperAdmin();
		const query = data.query?.trim() ?? "";
		const users = await env.DB.prepare(
			`SELECT id, name, email, role, banned, emailVerified, createdAt FROM user ${query ? "WHERE lower(name) LIKE ? OR lower(email) LIKE ?" : ""} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
		)
			.bind(
				...(query
					? [`%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`]
					: []),
				data.limit + 1,
				data.offset,
			)
			.all();
		return {
			users: users.results.slice(0, data.limit),
			hasMore: users.results.length > data.limit,
		};
	});

export const resendUserVerification = createServerFn({ method: "POST" })
	.validator((data: unknown) => resendUserVerificationSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await requireSuperAdmin();
		const reason = requireReason(data.reason);
		const user = await env.DB.prepare(
			"SELECT email, emailVerified FROM user WHERE id = ?",
		)
			.bind(data.userId)
			.first<{ email: string; emailVerified: number }>();
		if (!user) throw new Error("User not found.");
		if (user.emailVerified)
			throw new Error("This user's email is already verified.");
		await getAuth().api.sendVerificationEmail({
			headers: getRequestHeaders(),
			body: { email: user.email, callbackURL: "/account" },
		});
		await writeAudit(
			session.user.id,
			"user.verification.resend",
			"user",
			data.userId,
			reason,
		);
		return { success: true };
	});

export const getPlatformOrganizations = createServerFn({
	method: "GET",
})
	.validator((data: unknown) => platformOrganizationsQuerySchema.parse(data))
	.handler(async ({ data }) => {
		await requireSuperAdmin();
		const query = data.query ?? "";
		const organizations = await env.DB.prepare(
			`SELECT organization.id, organization.name, organization.slug, organization.createdAt, COALESCE(platform_organization.status, 'active') AS status, platform_organization.archivedAt, COUNT(DISTINCT member.id) AS memberCount, MAX(CASE WHEN member.role = 'owner' THEN user.name END) AS ownerName, MAX(CASE WHEN member.role = 'owner' THEN user.email END) AS ownerEmail FROM organization LEFT JOIN platform_organization ON platform_organization.organizationId = organization.id LEFT JOIN member ON member.organizationId = organization.id LEFT JOIN user ON user.id = member.userId ${query ? "WHERE lower(organization.name) LIKE ? OR lower(organization.slug) LIKE ?" : ""} GROUP BY organization.id ORDER BY organization.createdAt DESC LIMIT ? OFFSET ?`,
		)
			.bind(
				...(query
					? [`%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`]
					: []),
				data.limit + 1,
				data.offset,
			)
			.all();
		return {
			organizations: organizations.results.slice(0, data.limit),
			hasMore: organizations.results.length > data.limit,
		};
	});

export const updatePlatformOrganization = createServerFn({ method: "POST" })
	.validator((data: unknown) => updatePlatformOrganizationSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await requireSuperAdmin();
		const reason = requireReason(data.reason);
		const { name } = data;
		const organization = await env.DB.prepare(
			"SELECT id FROM organization WHERE id = ?",
		)
			.bind(data.organizationId)
			.first();
		if (!organization) throw new Error("Organisation not found.");
		await env.DB.prepare("UPDATE organization SET name = ? WHERE id = ?")
			.bind(name, data.organizationId)
			.run();
		await writeAudit(
			session.user.id,
			"organization.update",
			"organization",
			data.organizationId,
			reason,
			{ name },
		);
		return { success: true };
	});

export const setOrganizationOwner = createServerFn({ method: "POST" })
	.validator((data: unknown) => setOrganizationOwnerSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await requireSuperAdmin();
		const reason = requireReason(data.reason);
		const [organization, user] = await Promise.all([
			env.DB.prepare("SELECT id FROM organization WHERE id = ?")
				.bind(data.organizationId)
				.first<{ id: string }>(),
			env.DB.prepare("SELECT id, name FROM user WHERE email = ?")
				.bind(data.email)
				.first<{ id: string; name: string }>(),
		]);
		if (!organization) throw new Error("Organisasi tidak ditemui.");
		if (!user) {
			throw new Error(
				"Pengguna belum berdaftar. Minta mereka daftar sebelum menetapkan Owner.",
			);
		}

		const membership = await env.DB.prepare(
			"SELECT id FROM member WHERE organizationId = ? AND userId = ?",
		)
			.bind(data.organizationId, user.id)
			.first<{ id: string }>();
		const statements = [
			env.DB.prepare(
				"UPDATE member SET role = 'admin' WHERE organizationId = ? AND instr(role, 'owner') > 0",
			).bind(data.organizationId),
			membership
				? env.DB.prepare("UPDATE member SET role = 'owner' WHERE id = ?").bind(
						membership.id,
					)
				: env.DB.prepare(
						"INSERT INTO member (id, organizationId, userId, role, createdAt) VALUES (?, ?, ?, 'owner', ?)",
					).bind(crypto.randomUUID(), data.organizationId, user.id, Date.now()),
		];
		await env.DB.batch(statements);
		await writeAudit(
			session.user.id,
			"owner.assign",
			"organization",
			data.organizationId,
			reason,
			{ email: data.email },
		);
		return { name: user.name, email: data.email };
	});

export const updateOrganizationLifecycle = createServerFn({ method: "POST" })
	.validator((data: unknown) => updateOrganizationLifecycleSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await requireSuperAdmin();
		const reason = requireReason(data.reason);
		const status =
			data.action === "suspend"
				? "suspended"
				: data.action === "archive"
					? "archived"
					: "active";
		const archivedAt = status === "archived" ? Date.now() : null;
		await env.DB.prepare(
			"INSERT INTO platform_organization (organizationId, status, archivedAt, updatedAt) VALUES (?, ?, ?, ?) ON CONFLICT(organizationId) DO UPDATE SET status = excluded.status, archivedAt = excluded.archivedAt, updatedAt = excluded.updatedAt",
		)
			.bind(data.organizationId, status, archivedAt, Date.now())
			.run();
		await writeAudit(
			session.user.id,
			`organization.${data.action}`,
			"organization",
			data.organizationId,
			reason,
		);
		return { status };
	});

export const revokeUserSessions = createServerFn({ method: "POST" })
	.validator((data: unknown) => revokeUserSessionsSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await requireSuperAdmin();
		const reason = requireReason(data.reason);
		if (data.userId === session.user.id)
			throw new Error("You cannot revoke your own sessions here.");
		await env.DB.prepare("DELETE FROM session WHERE userId = ?")
			.bind(data.userId)
			.run();
		await writeAudit(
			session.user.id,
			"user.sessions.revoke",
			"user",
			data.userId,
			reason,
		);
		return { success: true };
	});

export const getPlatformAuditLog = createServerFn({ method: "GET" })
	.validator((data: unknown) => platformAuditLogQuerySchema.parse(data))
	.handler(async ({ data }) => {
		await requireSuperAdmin();
		const clauses = ["1 = 1"];
		const values: Array<string | number> = [];
		if (data.action) {
			clauses.push("audit.action = ?");
			values.push(data.action);
		}
		if (data.actor) {
			clauses.push("(audit.actorUserId = ? OR lower(user.email) = lower(?))");
			values.push(data.actor, data.actor);
		}
		if (data.target) {
			clauses.push("audit.targetId = ?");
			values.push(data.target);
		}
		if (data.from) {
			clauses.push("audit.createdAt >= ?");
			values.push(data.from);
		}
		if (data.to) {
			clauses.push("audit.createdAt <= ?");
			values.push(data.to);
		}
		const query = `SELECT audit.*, user.name AS actorName, user.email AS actorEmail FROM platform_audit_log audit INNER JOIN user ON user.id = audit.actorUserId WHERE ${clauses.join(" AND ")} ORDER BY audit.createdAt DESC LIMIT ? OFFSET ?`;
		const records = await env.DB.prepare(query)
			.bind(...values, data.limit + 1, data.offset)
			.all();
		return {
			records: records.results.slice(0, data.limit),
			hasMore: records.results.length > data.limit,
		};
	});

export const getPlatformSettings = createServerFn({ method: "GET" }).handler(
	async () => {
		await requireSuperAdmin();
		const rows = await env.DB.prepare(
			"SELECT key, value FROM platform_setting",
		).all<{ key: string; value: string }>();
		return Object.fromEntries(rows.results.map((row) => [row.key, row.value]));
	},
);

export const updatePlatformSettings = createServerFn({ method: "POST" })
	.validator((data: unknown) => updatePlatformSettingsSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await requireSuperAdmin();
		const reason = requireReason(data.reason);
		const settings = {
			platformName: data.platformName,
			supportEmail: data.supportEmail,
			invitationExpiryHours: String(data.invitationExpiryHours),
			emailSenderName: data.emailSenderName,
		};
		await env.DB.batch(
			Object.entries(settings).map(([key, value]) =>
				env.DB.prepare(
					"INSERT INTO platform_setting (key, value, updatedByUserId, updatedAt) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedByUserId = excluded.updatedByUserId, updatedAt = excluded.updatedAt",
				).bind(key, value, session.user.id, Date.now()),
			),
		);
		await writeAudit(
			session.user.id,
			"platform.settings.update",
			"platform",
			null,
			reason,
			settings,
		);
		return settings;
	});
