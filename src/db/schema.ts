import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("emailVerified", { mode: "boolean" })
		.default(false)
		.notNull(),
	image: text("image"),
	createdAt: integer("createdAt", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
	role: text("role"),
	banned: integer("banned", { mode: "boolean" }).default(false),
	banReason: text("banReason"),
	banExpires: integer("banExpires", { mode: "timestamp_ms" }),
});

export const session = sqliteTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
		token: text("token").notNull().unique(),
		createdAt: integer("createdAt", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		ipAddress: text("ipAddress"),
		userAgent: text("userAgent"),
		userId: text("userId")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		impersonatedBy: text("impersonatedBy"),
		activeOrganizationId: text("activeOrganizationId"),
	},
	(table) => [index("session_userId_idx").on(table.userId)],
);

export const account = sqliteTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("accountId").notNull(),
		providerId: text("providerId").notNull(),
		userId: text("userId")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("accessToken"),
		refreshToken: text("refreshToken"),
		idToken: text("idToken"),
		accessTokenExpiresAt: integer("accessTokenExpiresAt", {
			mode: "timestamp_ms",
		}),
		refreshTokenExpiresAt: integer("refreshTokenExpiresAt", {
			mode: "timestamp_ms",
		}),
		scope: text("scope"),
		password: text("password"),
		createdAt: integer("createdAt", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = sqliteTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
		createdAt: integer("createdAt", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const rateLimit = sqliteTable(
	"rateLimit",
	{
		id: text("id").primaryKey(),
		key: text("key").notNull(),
		count: integer("count").notNull(),
		lastRequest: integer("lastRequest").notNull(),
	},
	(table) => [uniqueIndex("rateLimit_key_idx").on(table.key)],
);

export const organization = sqliteTable("organization", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),
	logo: text("logo"),
	createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
	metadata: text("metadata"),
});

export const member = sqliteTable(
	"member",
	{
		id: text("id").primaryKey(),
		organizationId: text("organizationId")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		userId: text("userId")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		role: text("role").default("member").notNull(),
		createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		index("member_organizationId_idx").on(table.organizationId),
		index("member_userId_idx").on(table.userId),
	],
);

export const invitation = sqliteTable(
	"invitation",
	{
		id: text("id").primaryKey(),
		organizationId: text("organizationId")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		email: text("email").notNull(),
		role: text("role"),
		status: text("status").default("pending").notNull(),
		expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
		createdAt: integer("createdAt", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		inviterId: text("inviterId")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("invitation_organizationId_idx").on(table.organizationId),
		index("invitation_email_idx").on(table.email),
	],
);

export const platformPlan = sqliteTable(
	"platformPlan",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		slug: text("slug").notNull().unique(),
		description: text("description").notNull(),
		memberLimit: integer("memberLimit").notNull(),
		activeExamLimit: integer("activeExamLimit").notNull(),
		monthlyAttemptLimit: integer("monthlyAttemptLimit").notNull(),
		isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
		createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [index("platformPlan_active_idx").on(table.isActive)],
);

export const organizationEntitlement = sqliteTable(
	"organizationEntitlement",
	{
		organizationId: text("organizationId")
			.primaryKey()
			.references(() => organization.id, { onDelete: "cascade" }),
		planId: text("planId")
			.notNull()
			.references(() => platformPlan.id, { onDelete: "restrict" }),
		status: text("status")
			.$type<"active" | "suspended">()
			.default("active")
			.notNull(),
		suspensionReason: text("suspensionReason"),
		suspendedAt: integer("suspendedAt", { mode: "timestamp_ms" }),
		suspendedBy: text("suspendedBy"),
		assignedAt: integer("assignedAt", { mode: "timestamp_ms" }).notNull(),
		assignedBy: text("assignedBy"),
		updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		index("organizationEntitlement_plan_idx").on(table.planId),
		index("organizationEntitlement_status_idx").on(table.status),
	],
);

export const platformSettings = sqliteTable("platformSettings", {
	id: text("id").primaryKey(),
	publicSignupEnabled: integer("publicSignupEnabled", { mode: "boolean" })
		.default(true)
		.notNull(),
	defaultPlanId: text("defaultPlanId")
		.notNull()
		.references(() => platformPlan.id, { onDelete: "restrict" }),
	maintenanceEnabled: integer("maintenanceEnabled", { mode: "boolean" })
		.default(false)
		.notNull(),
	maintenanceMessage: text("maintenanceMessage"),
	updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
	updatedBy: text("updatedBy"),
});

export const auditEvent = sqliteTable(
	"auditEvent",
	{
		id: text("id").primaryKey(),
		category: text("category")
			.$type<
				"auth" | "user" | "organization" | "plan" | "system" | "security"
			>()
			.notNull(),
		type: text("type").notNull(),
		result: text("result").$type<"success" | "failure">().notNull(),
		actorUserId: text("actorUserId"),
		effectiveUserId: text("effectiveUserId"),
		targetType: text("targetType"),
		targetId: text("targetId"),
		organizationId: text("organizationId"),
		sessionId: text("sessionId"),
		userAgent: text("userAgent"),
		metadata: text("metadata", { mode: "json" }).$type<
			Record<string, string | number | boolean | null>
		>(),
		createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		index("auditEvent_createdAt_idx").on(table.createdAt),
		index("auditEvent_type_idx").on(table.type),
		index("auditEvent_actor_idx").on(table.actorUserId),
		index("auditEvent_organization_idx").on(table.organizationId),
	],
);

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account),
	members: many(member),
	invitations: many(invitation),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id],
	}),
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id],
	}),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
	members: many(member),
	invitations: many(invitation),
	entitlements: many(organizationEntitlement),
}));

export const platformPlanRelations = relations(platformPlan, ({ many }) => ({
	entitlements: many(organizationEntitlement),
}));

export const organizationEntitlementRelations = relations(
	organizationEntitlement,
	({ one }) => ({
		organization: one(organization, {
			fields: [organizationEntitlement.organizationId],
			references: [organization.id],
		}),
		plan: one(platformPlan, {
			fields: [organizationEntitlement.planId],
			references: [platformPlan.id],
		}),
	}),
);

export const memberRelations = relations(member, ({ one }) => ({
	organization: one(organization, {
		fields: [member.organizationId],
		references: [organization.id],
	}),
	user: one(user, {
		fields: [member.userId],
		references: [user.id],
	}),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
	organization: one(organization, {
		fields: [invitation.organizationId],
		references: [organization.id],
	}),
	user: one(user, {
		fields: [invitation.inviterId],
		references: [user.id],
	}),
}));
