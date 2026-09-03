import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { getAuth } from "./auth";

type UserAction = "ban" | "unban" | "make-admin" | "make-user";

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
				`SELECT organization.id, organization.name, organization.slug, organization.createdAt, COUNT(DISTINCT member.id) AS memberCount, COUNT(DISTINCT CASE WHEN invitation.status = 'pending' THEN invitation.id END) AS pendingInvitationCount FROM organization LEFT JOIN member ON member.organizationId = organization.id LEFT JOIN invitation ON invitation.organizationId = organization.id GROUP BY organization.id ORDER BY organization.createdAt DESC LIMIT 8`,
			).all<{
				id: string;
				name: string;
				slug: string;
				createdAt: number;
				memberCount: number;
				pendingInvitationCount: number;
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
	.validator((data: { userId: string; action: UserAction }) => data)
	.handler(async ({ data }) => {
		const session = await requireSuperAdmin();
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
		return { success: true };
	});
