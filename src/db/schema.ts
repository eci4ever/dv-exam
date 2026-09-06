import { sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

/** A configured examination period, such as a mid-year or final examination. */
export const examSessions = sqliteTable("exam_sessions", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	startsAt: text("starts_at").notNull(),
	endsAt: text("ends_at").notNull(),
	status: text("status").notNull().default("draft"),
	createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Better Auth owns user, session, member, organization and invitation tables.
// Application tables use integer Unix-millisecond timestamps to match those tables.
export const platformOrganizations = sqliteTable("platform_organization", {
	organizationId: text("organizationId").primaryKey(),
	status: text("status").notNull().default("active"),
	archivedAt: integer("archivedAt"),
	updatedAt: integer("updatedAt").notNull(),
});

export const platformAuditLog = sqliteTable(
	"platform_audit_log",
	{
		id: text("id").primaryKey(),
		actorUserId: text("actorUserId").notNull(),
		action: text("action").notNull(),
		targetType: text("targetType").notNull(),
		targetId: text("targetId"),
		reason: text("reason").notNull(),
		outcome: text("outcome").notNull(),
		metadata: text("metadata"),
		createdAt: integer("createdAt").notNull(),
	},
	(table) => [
		index("platform_audit_log_created_at_idx").on(table.createdAt),
		index("platform_audit_log_actor_idx").on(table.actorUserId),
		index("platform_audit_log_action_created_at_idx").on(
			table.action,
			table.createdAt,
		),
		index("platform_audit_log_actor_created_at_idx").on(
			table.actorUserId,
			table.createdAt,
		),
		index("platform_audit_log_target_created_at_idx").on(
			table.targetId,
			table.createdAt,
		),
	],
);

export const platformSettings = sqliteTable("platform_setting", {
	key: text("key").primaryKey(),
	value: text("value").notNull(),
	updatedByUserId: text("updatedByUserId").notNull(),
	updatedAt: integer("updatedAt").notNull(),
});

export const examinations = sqliteTable(
	"examination",
	{
		id: text("id").primaryKey(),
		organizationId: text("organizationId").notNull(),
		title: text("title").notNull(),
		description: text("description"),
		durationMinutes: integer("durationMinutes").notNull().default(60),
		status: text("status").notNull().default("draft"),
		startsAt: integer("startsAt"),
		endsAt: integer("endsAt"),
		resultsPublishedAt: integer("resultsPublishedAt"),
		createdByUserId: text("createdByUserId").notNull(),
		createdAt: integer("createdAt").notNull(),
		updatedAt: integer("updatedAt").notNull(),
	},
	(table) => [
		index("examination_organization_idx").on(
			table.organizationId,
			table.status,
		),
	],
);

export const examinationQuestions = sqliteTable(
	"examination_question",
	{
		id: text("id").primaryKey(),
		examinationId: text("examinationId").notNull(),
		prompt: text("prompt").notNull(),
		points: integer("points").notNull().default(1),
		position: integer("position").notNull(),
	},
	(table) => [
		index("examination_question_exam_idx").on(
			table.examinationId,
			table.position,
		),
	],
);

export const examinationOptions = sqliteTable("examination_option", {
	id: text("id").primaryKey(),
	questionId: text("questionId").notNull(),
	label: text("label").notNull(),
	isCorrect: integer("isCorrect").notNull().default(0),
	position: integer("position").notNull(),
});

export const examinationAssignments = sqliteTable(
	"examination_assignment",
	{
		id: text("id").primaryKey(),
		examinationId: text("examinationId").notNull(),
		userId: text("userId").notNull(),
		assignedByUserId: text("assignedByUserId").notNull(),
		createdAt: integer("createdAt").notNull(),
	},
	(table) => [
		uniqueIndex("examination_assignment_exam_user_unique").on(
			table.examinationId,
			table.userId,
		),
		index("examination_assignment_user_idx").on(
			table.userId,
			table.examinationId,
		),
	],
);

export const examinationAttempts = sqliteTable("examination_attempt", {
	id: text("id").primaryKey(),
	assignmentId: text("assignmentId").notNull().unique(),
	status: text("status").notNull().default("in_progress"),
	startedAt: integer("startedAt").notNull(),
	submittedAt: integer("submittedAt"),
	score: integer("score"),
	maxScore: integer("maxScore"),
});

export const examinationAnswers = sqliteTable(
	"examination_answer",
	{
		id: text("id").primaryKey(),
		attemptId: text("attemptId").notNull(),
		questionId: text("questionId").notNull(),
		optionId: text("optionId"),
		updatedAt: integer("updatedAt").notNull(),
	},
	(table) => [
		uniqueIndex("examination_answer_attempt_question_unique").on(
			table.attemptId,
			table.questionId,
		),
	],
);
