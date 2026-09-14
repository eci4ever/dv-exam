import { env } from "cloudflare:workers";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { admin, organization } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { and, count, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import {
	organizationAccessControl,
	organizationRoles,
} from "@/lib/organization-permissions";
import {
	assignDefaultPlan,
	ensurePlatformData,
	getPlatformSettingsRecord,
	writeAuditEvent,
} from "@/lib/platform-data";
import {
	assertLastActiveAdminSafe,
	assertPublicSignupEnabled,
	assertUserHasNoOwnedOrganizations,
	assertWritableSession,
} from "@/lib/platform-policy";

async function assertMemberCapacity(organizationId: string) {
	await ensurePlatformData();
	const [capacity] = await db
		.select({
			usage: count(schema.member.id),
			limit: schema.platformPlan.memberLimit,
			status: schema.organizationEntitlement.status,
		})
		.from(schema.organizationEntitlement)
		.innerJoin(
			schema.platformPlan,
			eq(schema.platformPlan.id, schema.organizationEntitlement.planId),
		)
		.leftJoin(
			schema.member,
			eq(
				schema.member.organizationId,
				schema.organizationEntitlement.organizationId,
			),
		)
		.where(eq(schema.organizationEntitlement.organizationId, organizationId))
		.groupBy(schema.organizationEntitlement.organizationId)
		.limit(1);
	if (capacity?.status === "suspended") {
		throw new APIError("FORBIDDEN", {
			message: "This workspace is suspended.",
		});
	}
	if (capacity && capacity.usage >= capacity.limit) {
		throw new APIError("FORBIDDEN", {
			message: "This workspace has reached its member limit.",
		});
	}
}

export const auth = betterAuth({
	baseURL: env.BETTER_AUTH_URL,
	database: drizzleAdapter(db, {
		camelCase: true,
		provider: "sqlite",
		schema,
	}),
	secret: env.BETTER_AUTH_SECRET,
	emailAndPassword: {
		enabled: true,
	},
	hooks: {
		before: createAuthMiddleware(async (ctx) => {
			if (ctx.path === "/sign-up/email") {
				const settings = await getPlatformSettingsRecord();
				try {
					assertPublicSignupEnabled(settings.publicSignupEnabled, false);
				} catch (error) {
					throw new APIError("FORBIDDEN", {
						message:
							error instanceof Error
								? error.message
								: "Sign-ups are currently closed.",
					});
				}
			}

			if (
				ctx.request?.method === "POST" &&
				ctx.path !== "/admin/stop-impersonating" &&
				ctx.path !== "/sign-out"
			) {
				const cookieName = ctx.context.authCookies.sessionToken.name;
				const token = await ctx.getSignedCookie(cookieName, ctx.context.secret);
				if (token) {
					const [activeSession] = await db
						.select({ impersonatedBy: schema.session.impersonatedBy })
						.from(schema.session)
						.where(eq(schema.session.token, token))
						.limit(1);
					try {
						assertWritableSession(activeSession?.impersonatedBy);
					} catch (error) {
						throw new APIError("FORBIDDEN", {
							message:
								error instanceof Error
									? error.message
									: "Return to admin to make changes.",
						});
					}
				}
			}
		}),
		after: createAuthMiddleware(async (ctx) => {
			if (ctx.path !== "/sign-up/email" && ctx.path !== "/sign-in/email")
				return;
			const newSession = ctx.context.newSession;
			if (!newSession) return;
			await writeAuditEvent({
				category: "auth",
				type: ctx.path === "/sign-up/email" ? "auth.signup" : "auth.sign-in",
				result: "success",
				actorUserId: newSession.user.id,
				effectiveUserId: newSession.user.id,
				sessionId: newSession.session.id,
				userAgent: ctx.headers?.get("user-agent"),
			});
		}),
	},
	databaseHooks: {
		user: {
			create: {
				after: async (createdUser) => {
					const firstUser = db
						.select({ id: schema.user.id })
						.from(schema.user)
						.orderBy(sql`rowid`)
						.limit(1);

					await db
						.update(schema.user)
						.set({ role: "admin" })
						.where(
							and(
								eq(schema.user.id, createdUser.id),
								inArray(schema.user.id, firstUser),
							),
						);
				},
			},
			update: {
				before: async (updatedUser) => {
					if (!updatedUser.id) return;
					const [current] = await db
						.select({ role: schema.user.role, banned: schema.user.banned })
						.from(schema.user)
						.where(eq(schema.user.id, updatedUser.id))
						.limit(1);
					const targetIsActiveAdmin = Boolean(
						current?.role?.split(",").includes("admin") && !current.banned,
					);
					const nextRole =
						typeof updatedUser.role === "string" ? updatedUser.role : undefined;
					const demoting =
						updatedUser.role !== undefined &&
						!nextRole?.split(",").includes("admin");
					const banning = updatedUser.banned === true;
					if (demoting || banning) {
						const [activeAdmins] = await db
							.select({ count: count() })
							.from(schema.user)
							.where(
								and(
									eq(schema.user.role, "admin"),
									eq(schema.user.banned, false),
								),
							);
						assertLastActiveAdminSafe({
							action: banning ? "ban" : "demote",
							targetIsActiveAdmin,
							activeAdminCount: activeAdmins?.count ?? 0,
						});
					}
				},
			},
			delete: {
				before: async (deletedUser) => {
					const [owned, activeAdmins] = await Promise.all([
						db
							.select({ count: count() })
							.from(schema.member)
							.where(
								and(
									eq(schema.member.userId, deletedUser.id),
									eq(schema.member.role, "owner"),
								),
							),
						db
							.select({ count: count() })
							.from(schema.user)
							.where(
								and(
									eq(schema.user.role, "admin"),
									eq(schema.user.banned, false),
								),
							),
					]);
					assertUserHasNoOwnedOrganizations(owned[0]?.count ?? 0);
					const deletedRole =
						typeof deletedUser.role === "string" ? deletedUser.role : undefined;
					assertLastActiveAdminSafe({
						action: "delete",
						targetIsActiveAdmin: Boolean(
							deletedRole?.split(",").includes("admin") && !deletedUser.banned,
						),
						activeAdminCount: activeAdmins[0]?.count ?? 0,
					});
				},
			},
		},
	},
	plugins: [
		admin(),
		organization({
			ac: organizationAccessControl,
			organizationLimit: 1,
			roles: organizationRoles,
			organizationHooks: {
				afterCreateOrganization: async ({
					organization: createdOrganization,
					user: createdBy,
				}) => {
					await assignDefaultPlan(createdOrganization.id, createdBy.id);
					await writeAuditEvent({
						category: "organization",
						type: "organization.created",
						actorUserId: createdBy.id,
						effectiveUserId: createdBy.id,
						targetType: "organization",
						targetId: createdOrganization.id,
						organizationId: createdOrganization.id,
					});
				},
				beforeAddMember: async ({ organization: targetOrganization }) => {
					await assertMemberCapacity(targetOrganization.id);
				},
				beforeAcceptInvitation: async ({
					organization: targetOrganization,
				}) => {
					await assertMemberCapacity(targetOrganization.id);
				},
			},
		}),
		tanstackStartCookies(),
	],
});
