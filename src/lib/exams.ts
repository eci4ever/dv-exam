import { createServerFn } from "@tanstack/react-start";
import { and, asc, count, desc, eq, inArray, like } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import {
	normalizeExamSettings,
	validatePublishableExam,
} from "@/lib/exam-policy";
import {
	auditForSession,
	requireOrganizationPermission,
} from "@/lib/platform-core";

function record(value: unknown) {
	if (!value || typeof value !== "object") throw new Error("Invalid request.");
	return value as Record<string, unknown>;
}

function requiredText(value: unknown, label: string) {
	if (typeof value !== "string" || !value.trim())
		throw new Error(`${label} is required.`);
	return value.trim();
}

function settings(value: unknown) {
	const input = record(value);
	return normalizeExamSettings({
		title: requiredText(input.title, "Title"),
		description:
			typeof input.description === "string" ? input.description : null,
		durationMinutes: Number(input.durationMinutes),
		passingPercentage: Number(input.passingPercentage),
		shuffleQuestions: input.shuffleQuestions === true,
	});
}

function selectedItems(value: unknown) {
	if (!Array.isArray(value)) throw new Error("Exam questions are required.");
	const items = value.map((raw) => {
		const item = record(raw);
		return {
			questionId: requiredText(item.questionId, "Question"),
			marks: Number(item.marks),
		};
	});
	validatePublishableExam(items);
	if (new Set(items.map((item) => item.questionId)).size !== items.length)
		throw new Error("Each question can only be added once.");
	return items;
}

export const listExams = createServerFn({ method: "GET" })
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
			status:
				input.status === "draft" || input.status === "archived"
					? input.status
					: "published",
			page:
				typeof input.page === "number"
					? Math.max(1, Math.floor(input.page))
					: 1,
		} as const;
	})
	.handler(async ({ data }) => {
		const { organizationId } = await requireOrganizationPermission({
			resource: "exam",
			action: "read",
		});
		const where = and(
			eq(schema.exam.organizationId, organizationId),
			eq(schema.exam.status, data.status),
			data.search ? like(schema.exam.title, `%${data.search}%`) : undefined,
		);
		const pageSize = 25;
		const [rows, totals] = await Promise.all([
			db
				.select({ exam: schema.exam, questionCount: count(schema.examItem.id) })
				.from(schema.exam)
				.leftJoin(schema.examItem, eq(schema.examItem.examId, schema.exam.id))
				.where(where)
				.groupBy(schema.exam.id)
				.orderBy(desc(schema.exam.updatedAt))
				.limit(pageSize)
				.offset((data.page - 1) * pageSize),
			db.select({ total: count() }).from(schema.exam).where(where),
		]);
		const total = totals[0]?.total ?? 0;
		return {
			rows: rows.map((row) => ({
				...row.exam,
				questionCount: row.questionCount,
			})),
			total,
			page: data.page,
			pageCount: Math.max(1, Math.ceil(total / pageSize)),
		};
	});

export const listExamQuestionChoices = createServerFn({
	method: "GET",
}).handler(async () => {
	const { organizationId } = await requireOrganizationPermission({
		resource: "question",
		action: "read",
	});
	return db
		.select({
			id: schema.question.id,
			prompt: schema.question.prompt,
			type: schema.question.type,
			difficulty: schema.question.difficulty,
			defaultMarks: schema.question.defaultMarks,
		})
		.from(schema.question)
		.where(
			and(
				eq(schema.question.organizationId, organizationId),
				eq(schema.question.status, "active"),
			),
		)
		.orderBy(asc(schema.question.prompt));
});

export const getExam = createServerFn({ method: "GET" })
	.validator((value: unknown) => ({
		examId: requiredText(record(value).examId, "Exam"),
	}))
	.handler(async ({ data }) => {
		const { organizationId } = await requireOrganizationPermission({
			resource: "exam",
			action: "read",
		});
		const [exam] = await db
			.select()
			.from(schema.exam)
			.where(
				and(
					eq(schema.exam.id, data.examId),
					eq(schema.exam.organizationId, organizationId),
				),
			)
			.limit(1);
		if (!exam) throw new Error("Exam not found.");
		const items = await db
			.select()
			.from(schema.examItem)
			.where(eq(schema.examItem.examId, exam.id))
			.orderBy(asc(schema.examItem.position));
		const options = items.length
			? await db
					.select()
					.from(schema.examItemOption)
					.where(
						inArray(
							schema.examItemOption.examItemId,
							items.map((item) => item.id),
						),
					)
					.orderBy(asc(schema.examItemOption.position))
			: [];
		return {
			...exam,
			items: items.map((item) => ({
				...item,
				options: options.filter((option) => option.examItemId === item.id),
			})),
		};
	});

export const createExamDraft = createServerFn({ method: "POST" })
	.validator(settings)
	.handler(async ({ data }) => {
		const { session, organizationId } = await requireOrganizationPermission({
			resource: "exam",
			action: "create",
			writable: true,
		});
		const id = crypto.randomUUID();
		const now = new Date();
		await db.insert(schema.exam).values({
			id,
			organizationId,
			seriesId: id,
			version: 1,
			...data,
			status: "draft",
			createdBy: session.user.id,
			createdAt: now,
			updatedAt: now,
		});
		await auditForSession(session, {
			category: "organization",
			type: "exam.draft_created",
			organizationId,
			targetType: "exam",
			targetId: id,
		});
		return { id };
	});

export const saveExamDraft = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = record(value);
		return {
			examId: requiredText(input.examId, "Exam"),
			settings: settings(input.settings),
			items: selectedItems(input.items),
		};
	})
	.handler(async ({ data }) => {
		const { session, organizationId } = await requireOrganizationPermission({
			resource: "exam",
			action: "update",
			writable: true,
		});
		const questionIds = data.items.map((item) => item.questionId);
		const questions = await db
			.select()
			.from(schema.question)
			.where(
				and(
					eq(schema.question.organizationId, organizationId),
					eq(schema.question.status, "active"),
					inArray(schema.question.id, questionIds),
				),
			);
		if (questions.length !== data.items.length)
			throw new Error("One or more questions are unavailable.");
		const sourceOptions = await db
			.select()
			.from(schema.questionOption)
			.where(inArray(schema.questionOption.questionId, questionIds));
		const changed = await db
			.update(schema.exam)
			.set({ ...data.settings, updatedAt: new Date() })
			.where(
				and(
					eq(schema.exam.id, data.examId),
					eq(schema.exam.organizationId, organizationId),
					eq(schema.exam.status, "draft"),
				),
			)
			.returning({ id: schema.exam.id });
		if (!changed.length) throw new Error("Editable draft not found.");
		await db
			.delete(schema.examItem)
			.where(eq(schema.examItem.examId, data.examId));
		for (const [position, selected] of data.items.entries()) {
			const source = questions.find(
				(question) => question.id === selected.questionId,
			);
			if (!source) throw new Error("Question is unavailable.");
			const itemId = crypto.randomUUID();
			await db.insert(schema.examItem).values({
				id: itemId,
				examId: data.examId,
				sourceQuestionId: source.id,
				type: source.type,
				prompt: source.prompt,
				explanation: source.explanation,
				difficulty: source.difficulty,
				marks: selected.marks,
				position,
			});
			const options = sourceOptions
				.filter((option) => option.questionId === source.id)
				.sort((a, b) => a.position - b.position);
			if (options.length)
				await db.insert(schema.examItemOption).values(
					options.map((option) => ({
						id: crypto.randomUUID(),
						examItemId: itemId,
						text: option.text,
						isCorrect: option.isCorrect,
						position: option.position,
					})),
				);
		}
		await auditForSession(session, {
			category: "organization",
			type: "exam.draft_saved",
			organizationId,
			targetType: "exam",
			targetId: data.examId,
		});
		return { id: data.examId };
	});

export const publishExam = createServerFn({ method: "POST" })
	.validator((value: unknown) => ({
		examId: requiredText(record(value).examId, "Exam"),
	}))
	.handler(async ({ data }) => {
		const { session, organizationId } = await requireOrganizationPermission({
			resource: "exam",
			action: "publish",
			writable: true,
		});
		const [draft] = await db
			.select()
			.from(schema.exam)
			.where(
				and(
					eq(schema.exam.id, data.examId),
					eq(schema.exam.organizationId, organizationId),
					eq(schema.exam.status, "draft"),
				),
			)
			.limit(1);
		if (!draft) throw new Error("Editable draft not found.");
		const items = await db
			.select({ marks: schema.examItem.marks })
			.from(schema.examItem)
			.where(eq(schema.examItem.examId, draft.id));
		validatePublishableExam(items);
		const [entitlement] = await db
			.select({ limit: schema.platformPlan.activeExamLimit })
			.from(schema.organizationEntitlement)
			.innerJoin(
				schema.platformPlan,
				eq(schema.platformPlan.id, schema.organizationEntitlement.planId),
			)
			.where(eq(schema.organizationEntitlement.organizationId, organizationId))
			.limit(1);
		if (!entitlement) throw new Error("Workspace plan is unavailable.");
		const [usage] = await db
			.select({ total: count() })
			.from(schema.exam)
			.where(
				and(
					eq(schema.exam.organizationId, organizationId),
					eq(schema.exam.status, "published"),
				),
			);
		const existing = await db
			.select({ id: schema.exam.id })
			.from(schema.exam)
			.where(
				and(
					eq(schema.exam.seriesId, draft.seriesId),
					eq(schema.exam.status, "published"),
				),
			)
			.limit(1);
		if (!existing.length && (usage?.total ?? 0) >= entitlement.limit)
			throw new Error("Your workspace has reached its active exam limit.");
		const now = new Date();
		const [, changed] = await db.batch([
			db
				.update(schema.exam)
				.set({ status: "archived", updatedAt: now })
				.where(
					and(
						eq(schema.exam.seriesId, draft.seriesId),
						eq(schema.exam.status, "published"),
					),
				),
			db
				.update(schema.exam)
				.set({ status: "published", publishedAt: now, updatedAt: now })
				.where(
					and(eq(schema.exam.id, draft.id), eq(schema.exam.status, "draft")),
				)
				.returning({ id: schema.exam.id }),
		]);
		if (!changed.length)
			throw new Error("Exam was changed. Refresh and try again.");
		await auditForSession(session, {
			category: "organization",
			type: "exam.published",
			organizationId,
			targetType: "exam",
			targetId: draft.id,
		});
		return { id: draft.id };
	});

export const createExamVersion = createServerFn({ method: "POST" })
	.validator((value: unknown) => ({
		examId: requiredText(record(value).examId, "Exam"),
	}))
	.handler(async ({ data }) => {
		const { session, organizationId } = await requireOrganizationPermission({
			resource: "exam",
			action: "create",
			writable: true,
		});
		const source = await getExam({ data: { examId: data.examId } });
		if (source.status !== "published")
			throw new Error("Only a published exam can start a new version.");
		const id = crypto.randomUUID();
		const now = new Date();
		await db.insert(schema.exam).values({
			id,
			organizationId,
			seriesId: source.seriesId,
			version: source.version + 1,
			title: source.title,
			description: source.description,
			durationMinutes: source.durationMinutes,
			passingPercentage: source.passingPercentage,
			shuffleQuestions: source.shuffleQuestions,
			status: "draft",
			createdBy: session.user.id,
			createdAt: now,
			updatedAt: now,
		});
		for (const item of source.items) {
			const itemId = crypto.randomUUID();
			await db.insert(schema.examItem).values({
				id: itemId,
				examId: id,
				sourceQuestionId: item.sourceQuestionId,
				type: item.type,
				prompt: item.prompt,
				explanation: item.explanation,
				difficulty: item.difficulty,
				marks: item.marks,
				position: item.position,
			});
			if (item.options.length)
				await db.insert(schema.examItemOption).values(
					item.options.map((option) => ({
						id: crypto.randomUUID(),
						examItemId: itemId,
						text: option.text,
						isCorrect: option.isCorrect,
						position: option.position,
					})),
				);
		}
		await auditForSession(session, {
			category: "organization",
			type: "exam.version_created",
			organizationId,
			targetType: "exam",
			targetId: id,
		});
		return { id };
	});

export const archiveExam = createServerFn({ method: "POST" })
	.validator((value: unknown) => ({
		examId: requiredText(record(value).examId, "Exam"),
	}))
	.handler(async ({ data }) => {
		const { session, organizationId } = await requireOrganizationPermission({
			resource: "exam",
			action: "delete",
			writable: true,
		});
		const [target] = await db
			.select()
			.from(schema.exam)
			.where(
				and(
					eq(schema.exam.id, data.examId),
					eq(schema.exam.organizationId, organizationId),
				),
			)
			.limit(1);
		if (!target) throw new Error("Exam not found.");
		if (target.status === "draft")
			await db.delete(schema.exam).where(eq(schema.exam.id, target.id));
		else
			await db
				.update(schema.exam)
				.set({ status: "archived", updatedAt: new Date() })
				.where(eq(schema.exam.id, target.id));
		await auditForSession(session, {
			category: "organization",
			type: target.status === "draft" ? "exam.deleted" : "exam.archived",
			organizationId,
			targetType: "exam",
			targetId: target.id,
		});
		return { status: target.status === "draft" ? "deleted" : "archived" };
	});
