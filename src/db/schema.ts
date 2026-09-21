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

export const academicClass = sqliteTable(
	"academicClass",
	{
		id: text("id").primaryKey(),
		organizationId: text("organizationId")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		code: text("code").notNull(),
		name: text("name").notNull(),
		description: text("description"),
		status: text("status")
			.$type<"active" | "archived">()
			.default("active")
			.notNull(),
		createdBy: text("createdBy")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		uniqueIndex("academicClass_organization_code_idx").on(
			table.organizationId,
			table.code,
		),
		index("academicClass_organization_status_idx").on(
			table.organizationId,
			table.status,
		),
	],
);

export const academicClassMember = sqliteTable(
	"academicClassMember",
	{
		id: text("id").primaryKey(),
		classId: text("classId")
			.notNull()
			.references(() => academicClass.id, { onDelete: "cascade" }),
		memberId: text("memberId")
			.notNull()
			.references(() => member.id, { onDelete: "cascade" }),
		role: text("role").$type<"teacher" | "student">().notNull(),
		createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		uniqueIndex("academicClassMember_class_member_idx").on(
			table.classId,
			table.memberId,
		),
		index("academicClassMember_class_role_idx").on(table.classId, table.role),
		index("academicClassMember_member_idx").on(table.memberId),
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

export const question = sqliteTable(
	"question",
	{
		id: text("id").primaryKey(),
		organizationId: text("organizationId")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		authorId: text("authorId")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		type: text("type").$type<"single_choice" | "true_false">().notNull(),
		prompt: text("prompt").notNull(),
		explanation: text("explanation"),
		difficulty: text("difficulty")
			.$type<"easy" | "medium" | "hard">()
			.notNull(),
		defaultMarks: integer("defaultMarks").default(1).notNull(),
		status: text("status")
			.$type<"active" | "archived">()
			.default("active")
			.notNull(),
		createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		index("question_organization_status_idx").on(
			table.organizationId,
			table.status,
		),
		index("question_author_idx").on(table.authorId),
	],
);

export const questionOption = sqliteTable(
	"questionOption",
	{
		id: text("id").primaryKey(),
		questionId: text("questionId")
			.notNull()
			.references(() => question.id, { onDelete: "cascade" }),
		text: text("text").notNull(),
		isCorrect: integer("isCorrect", { mode: "boolean" }).notNull(),
		position: integer("position").notNull(),
	},
	(table) => [
		uniqueIndex("questionOption_question_position_idx").on(
			table.questionId,
			table.position,
		),
	],
);

export const questionTag = sqliteTable(
	"questionTag",
	{
		id: text("id").primaryKey(),
		questionId: text("questionId")
			.notNull()
			.references(() => question.id, { onDelete: "cascade" }),
		tag: text("tag").notNull(),
	},
	(table) => [
		uniqueIndex("questionTag_question_tag_idx").on(table.questionId, table.tag),
		index("questionTag_tag_idx").on(table.tag),
	],
);

export const exam = sqliteTable(
	"exam",
	{
		id: text("id").primaryKey(),
		organizationId: text("organizationId")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		seriesId: text("seriesId").notNull(),
		version: integer("version").default(1).notNull(),
		title: text("title").notNull(),
		description: text("description"),
		durationMinutes: integer("durationMinutes").notNull(),
		passingPercentage: integer("passingPercentage").notNull(),
		shuffleQuestions: integer("shuffleQuestions", { mode: "boolean" })
			.default(false)
			.notNull(),
		status: text("status")
			.$type<"draft" | "published" | "archived">()
			.default("draft")
			.notNull(),
		createdBy: text("createdBy")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		publishedAt: integer("publishedAt", { mode: "timestamp_ms" }),
		createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		uniqueIndex("exam_series_version_idx").on(table.seriesId, table.version),
		uniqueIndex("exam_series_open_draft_idx")
			.on(table.seriesId)
			.where(sql`${table.status} = 'draft'`),
		index("exam_organization_status_idx").on(
			table.organizationId,
			table.status,
		),
	],
);

export const examItem = sqliteTable(
	"examItem",
	{
		id: text("id").primaryKey(),
		examId: text("examId")
			.notNull()
			.references(() => exam.id, { onDelete: "cascade" }),
		sourceQuestionId: text("sourceQuestionId").references(() => question.id, {
			onDelete: "set null",
		}),
		type: text("type").$type<"single_choice" | "true_false">().notNull(),
		prompt: text("prompt").notNull(),
		explanation: text("explanation"),
		difficulty: text("difficulty")
			.$type<"easy" | "medium" | "hard">()
			.notNull(),
		marks: integer("marks").notNull(),
		position: integer("position").notNull(),
	},
	(table) => [
		uniqueIndex("examItem_exam_position_idx").on(table.examId, table.position),
		index("examItem_sourceQuestion_idx").on(table.sourceQuestionId),
	],
);

export const examItemOption = sqliteTable(
	"examItemOption",
	{
		id: text("id").primaryKey(),
		examItemId: text("examItemId")
			.notNull()
			.references(() => examItem.id, { onDelete: "cascade" }),
		text: text("text").notNull(),
		isCorrect: integer("isCorrect", { mode: "boolean" }).notNull(),
		position: integer("position").notNull(),
	},
	(table) => [
		uniqueIndex("examItemOption_item_position_idx").on(
			table.examItemId,
			table.position,
		),
	],
);

export const examSchedule = sqliteTable(
	"examSchedule",
	{
		id: text("id").primaryKey(),
		organizationId: text("organizationId")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		examId: text("examId")
			.notNull()
			.references(() => exam.id, { onDelete: "restrict" }),
		audienceMode: text("audienceMode")
			.$type<"all_students" | "selected_classes">()
			.default("all_students")
			.notNull(),
		classSnapshotCapturedAt: integer("classSnapshotCapturedAt", {
			mode: "timestamp_ms",
		}),
		opensAt: integer("opensAt", { mode: "timestamp_ms" }).notNull(),
		closesAt: integer("closesAt", { mode: "timestamp_ms" }).notNull(),
		cancelledAt: integer("cancelledAt", { mode: "timestamp_ms" }),
		cancelledBy: text("cancelledBy").references(() => user.id, {
			onDelete: "set null",
		}),
		createdBy: text("createdBy")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		index("examSchedule_organization_window_idx").on(
			table.organizationId,
			table.opensAt,
			table.closesAt,
		),
		index("examSchedule_exam_idx").on(table.examId),
	],
);

export const examScheduleClass = sqliteTable(
	"examScheduleClass",
	{
		id: text("id").primaryKey(),
		scheduleId: text("scheduleId")
			.notNull()
			.references(() => examSchedule.id, { onDelete: "cascade" }),
		classId: text("classId")
			.notNull()
			.references(() => academicClass.id, { onDelete: "restrict" }),
	},
	(table) => [
		uniqueIndex("examScheduleClass_schedule_class_idx").on(
			table.scheduleId,
			table.classId,
		),
		index("examScheduleClass_class_idx").on(table.classId),
	],
);

export const examScheduleRecipient = sqliteTable(
	"examScheduleRecipient",
	{
		id: text("id").primaryKey(),
		scheduleId: text("scheduleId")
			.notNull()
			.references(() => examSchedule.id, { onDelete: "cascade" }),
		userId: text("userId")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		assignedAt: integer("assignedAt", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		uniqueIndex("examScheduleRecipient_schedule_user_idx").on(
			table.scheduleId,
			table.userId,
		),
		index("examScheduleRecipient_user_idx").on(table.userId),
	],
);

export const examScheduleRecipientClass = sqliteTable(
	"examScheduleRecipientClass",
	{
		id: text("id").primaryKey(),
		recipientId: text("recipientId")
			.notNull()
			.references(() => examScheduleRecipient.id, { onDelete: "cascade" }),
		classId: text("classId")
			.notNull()
			.references(() => academicClass.id, { onDelete: "restrict" }),
	},
	(table) => [
		uniqueIndex("examScheduleRecipientClass_recipient_class_idx").on(
			table.recipientId,
			table.classId,
		),
		index("examScheduleRecipientClass_class_idx").on(table.classId),
	],
);

export const examAttempt = sqliteTable(
	"examAttempt",
	{
		id: text("id").primaryKey(),
		scheduleId: text("scheduleId")
			.notNull()
			.references(() => examSchedule.id, { onDelete: "cascade" }),
		examId: text("examId")
			.notNull()
			.references(() => exam.id, { onDelete: "restrict" }),
		userId: text("userId")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		status: text("status")
			.$type<"in_progress" | "submitted" | "timed_out">()
			.default("in_progress")
			.notNull(),
		submissionReason: text("submissionReason").$type<"manual" | "timeout">(),
		startedAt: integer("startedAt", { mode: "timestamp_ms" }).notNull(),
		deadlineAt: integer("deadlineAt", { mode: "timestamp_ms" }).notNull(),
		submittedAt: integer("submittedAt", { mode: "timestamp_ms" }),
		score: integer("score"),
		maxScore: integer("maxScore"),
		percentage: integer("percentage"),
		passed: integer("passed", { mode: "boolean" }),
		createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		uniqueIndex("examAttempt_schedule_user_idx").on(
			table.scheduleId,
			table.userId,
		),
		index("examAttempt_user_status_idx").on(table.userId, table.status),
		index("examAttempt_schedule_status_idx").on(table.scheduleId, table.status),
		index("examAttempt_organization_usage_idx").on(table.startedAt),
	],
);

export const examResponse = sqliteTable(
	"examResponse",
	{
		id: text("id").primaryKey(),
		attemptId: text("attemptId")
			.notNull()
			.references(() => examAttempt.id, { onDelete: "cascade" }),
		examItemId: text("examItemId")
			.notNull()
			.references(() => examItem.id, { onDelete: "restrict" }),
		selectedOptionId: text("selectedOptionId").references(
			() => examItemOption.id,
			{ onDelete: "restrict" },
		),
		updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		uniqueIndex("examResponse_attempt_item_idx").on(
			table.attemptId,
			table.examItemId,
		),
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
	questions: many(question),
	exams: many(exam),
	examSchedules: many(examSchedule),
	academicClasses: many(academicClass),
}));

export const academicClassRelations = relations(
	academicClass,
	({ one, many }) => ({
		organization: one(organization, {
			fields: [academicClass.organizationId],
			references: [organization.id],
		}),
		members: many(academicClassMember),
	}),
);

export const academicClassMemberRelations = relations(
	academicClassMember,
	({ one }) => ({
		academicClass: one(academicClass, {
			fields: [academicClassMember.classId],
			references: [academicClass.id],
		}),
		member: one(member, {
			fields: [academicClassMember.memberId],
			references: [member.id],
		}),
	}),
);

export const questionRelations = relations(question, ({ one, many }) => ({
	organization: one(organization, {
		fields: [question.organizationId],
		references: [organization.id],
	}),
	author: one(user, { fields: [question.authorId], references: [user.id] }),
	options: many(questionOption),
	tags: many(questionTag),
	examItems: many(examItem),
}));

export const questionOptionRelations = relations(questionOption, ({ one }) => ({
	question: one(question, {
		fields: [questionOption.questionId],
		references: [question.id],
	}),
}));

export const questionTagRelations = relations(questionTag, ({ one }) => ({
	question: one(question, {
		fields: [questionTag.questionId],
		references: [question.id],
	}),
}));

export const examRelations = relations(exam, ({ one, many }) => ({
	organization: one(organization, {
		fields: [exam.organizationId],
		references: [organization.id],
	}),
	creator: one(user, { fields: [exam.createdBy], references: [user.id] }),
	items: many(examItem),
	schedules: many(examSchedule),
	attempts: many(examAttempt),
}));

export const examItemRelations = relations(examItem, ({ one, many }) => ({
	exam: one(exam, { fields: [examItem.examId], references: [exam.id] }),
	sourceQuestion: one(question, {
		fields: [examItem.sourceQuestionId],
		references: [question.id],
	}),
	options: many(examItemOption),
	responses: many(examResponse),
}));

export const examItemOptionRelations = relations(examItemOption, ({ one }) => ({
	examItem: one(examItem, {
		fields: [examItemOption.examItemId],
		references: [examItem.id],
	}),
}));

export const examScheduleRelations = relations(
	examSchedule,
	({ one, many }) => ({
		organization: one(organization, {
			fields: [examSchedule.organizationId],
			references: [organization.id],
		}),
		exam: one(exam, {
			fields: [examSchedule.examId],
			references: [exam.id],
		}),
		recipients: many(examScheduleRecipient),
		attempts: many(examAttempt),
		classes: many(examScheduleClass),
	}),
);

export const examScheduleClassRelations = relations(
	examScheduleClass,
	({ one }) => ({
		schedule: one(examSchedule, {
			fields: [examScheduleClass.scheduleId],
			references: [examSchedule.id],
		}),
		academicClass: one(academicClass, {
			fields: [examScheduleClass.classId],
			references: [academicClass.id],
		}),
	}),
);

export const examScheduleRecipientRelations = relations(
	examScheduleRecipient,
	({ one, many }) => ({
		schedule: one(examSchedule, {
			fields: [examScheduleRecipient.scheduleId],
			references: [examSchedule.id],
		}),
		user: one(user, {
			fields: [examScheduleRecipient.userId],
			references: [user.id],
		}),
		classes: many(examScheduleRecipientClass),
	}),
);

export const examScheduleRecipientClassRelations = relations(
	examScheduleRecipientClass,
	({ one }) => ({
		recipient: one(examScheduleRecipient, {
			fields: [examScheduleRecipientClass.recipientId],
			references: [examScheduleRecipient.id],
		}),
		academicClass: one(academicClass, {
			fields: [examScheduleRecipientClass.classId],
			references: [academicClass.id],
		}),
	}),
);

export const examAttemptRelations = relations(examAttempt, ({ one, many }) => ({
	schedule: one(examSchedule, {
		fields: [examAttempt.scheduleId],
		references: [examSchedule.id],
	}),
	exam: one(exam, { fields: [examAttempt.examId], references: [exam.id] }),
	user: one(user, { fields: [examAttempt.userId], references: [user.id] }),
	responses: many(examResponse),
}));

export const examResponseRelations = relations(examResponse, ({ one }) => ({
	attempt: one(examAttempt, {
		fields: [examResponse.attemptId],
		references: [examAttempt.id],
	}),
	item: one(examItem, {
		fields: [examResponse.examItemId],
		references: [examItem.id],
	}),
	selectedOption: one(examItemOption, {
		fields: [examResponse.selectedOptionId],
		references: [examItemOption.id],
	}),
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
