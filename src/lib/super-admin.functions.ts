import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { getAuth } from "./auth";

type UserAction = "ban" | "unban" | "make-admin" | "make-user";

type AuditedUserAction = UserAction & { reason: string };

async function writeAudit(
	actorUserId: string,
	action: string,
	targetType: string,
	targetId: string | null,
	reason: string,
	metadata: Record<string, unknown> = {},
) {
	await env.DB.prepare(
		"INSERT INTO platform_audit_log (id, actorUserId, action, targetType, targetId, reason, outcome, metadata, createdAt) VALUES (?, ?, ?, ?, ?, ?, 'success', ?, ?)",
	)
		.bind(
			crypto.randomUUID(),
			actorUserId,
			action,
			targetType,
			targetId,
			reason,
			JSON.stringify(metadata),
			Date.now(),
		)
		.run();
}

function requireReason(reason: string) {
	const value = reason.trim();
	if (value.length < 3)
		throw new Error("A reason of at least 3 characters is required.");
	return value;
}

async function requireSuperAdmin() {
	const session = await getAuth().api.getSession({
		headers: getRequestHeaders(),
	});
	if (!session || session.user.role !== "admin")
		throw new Error("Akses Super Admin diperlukan.");
	return session;
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
	.validator((data: { name: string; adminEmail?: string }) => ({
		name: data.name.trim(),
		adminEmail: data.adminEmail?.trim().toLowerCase() ?? "",
	}))
	.handler(async ({ data }) => {
		const session = await requireSuperAdmin();
		if (data.name.length < 3)
			throw new Error("Nama organisasi mesti sekurang-kurangnya 3 aksara.");
		if (data.adminEmail && !/^\S+@\S+\.\S+$/.test(data.adminEmail))
			throw new Error("Masukkan e-mel pentadbir organisasi yang sah.");
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
		return { id: organization.id, name: organization.name };
	});

export const updateUserAccess = createServerFn({ method: "POST" })
	.validator((data: AuditedUserAction) => ({
		...data,
		reason: data.reason.trim(),
	}))
	.handler(async ({ data }) => {
		const session = await requireSuperAdmin();
		const reason = requireReason(data.reason);
		if (
			!data.userId ||
			!["ban", "unban", "make-admin", "make-user"].includes(data.action)
		)
			throw new Error("Tindakan pengguna tidak sah.");
		if (
			data.userId === session.user.id &&
			(data.action === "ban" || data.action === "make-user")
		)
			throw new Error("Anda tidak boleh menukar akses Super Admin sendiri.");
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

export const setOrganizationOwner = createServerFn({ method: "POST" })
	.validator(
		(data: { organizationId: string; email: string; reason: string }) => ({
			organizationId: data.organizationId,
			email: data.email.trim().toLowerCase(),
			reason: data.reason.trim(),
		}),
	)
	.handler(async ({ data }) => {
		const session = await requireSuperAdmin();
		const reason = requireReason(data.reason);
		if (!data.organizationId || !/^\S+@\S+\.\S+$/.test(data.email)) {
			throw new Error("Pilih organisasi dan masukkan e-mel pengguna yang sah.");
		}
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
	.validator(
		(data: {
			organizationId: string;
			action: "suspend" | "reactivate" | "archive" | "restore";
			reason: string;
		}) => data,
	)
	.handler(async ({ data }) => {
		const session = await requireSuperAdmin();
		const reason = requireReason(data.reason);
		if (!data.organizationId) throw new Error("Organisation is required.");
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
	.validator((data: { userId: string; reason: string }) => data)
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
	.validator(
		(
			data: {
				action?: string;
				actor?: string;
				target?: string;
				from?: number;
				to?: number;
			} = {},
		) => data,
	)
	.handler(async ({ data }) => {
		await requireSuperAdmin();
		const clauses = ["1 = 1"];
		const values: Array<string | number> = [];
		if (data.action) {
			clauses.push("audit.action = ?");
			values.push(data.action);
		}
		if (data.actor) {
			clauses.push("audit.actorUserId = ?");
			values.push(data.actor);
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
		const query = `SELECT audit.*, user.name AS actorName, user.email AS actorEmail FROM platform_audit_log audit INNER JOIN user ON user.id = audit.actorUserId WHERE ${clauses.join(" AND ")} ORDER BY audit.createdAt DESC LIMIT 100`;
		return (
			await env.DB.prepare(query)
				.bind(...values)
				.all()
		).results;
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
	.validator(
		(data: {
			platformName: string;
			supportEmail: string;
			invitationExpiryHours: number;
			emailSenderName: string;
			reason: string;
		}) => data,
	)
	.handler(async ({ data }) => {
		const session = await requireSuperAdmin();
		const reason = requireReason(data.reason);
		if (!/^\S+@\S+\.\S+$/.test(data.supportEmail))
			throw new Error("A valid support email is required.");
		if (
			!Number.isInteger(data.invitationExpiryHours) ||
			data.invitationExpiryHours < 1 ||
			data.invitationExpiryHours > 720
		)
			throw new Error("Invitation expiry must be between 1 and 720 hours.");
		const settings = {
			platformName: data.platformName.trim(),
			supportEmail: data.supportEmail.trim().toLowerCase(),
			invitationExpiryHours: String(data.invitationExpiryHours),
			emailSenderName: data.emailSenderName.trim(),
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
