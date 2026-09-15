import { createServerFn } from "@tanstack/react-start";
import { and, asc, count, desc, eq, inArray, like, or, sql } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import {
	normalizeQuestionInput,
	type QuestionDifficulty,
	type QuestionInput,
	type QuestionStatus,
	type QuestionType,
} from "@/lib/exam-policy";
import {
	auditForSession,
	requireOrganizationPermission,
} from "@/lib/platform-core";

function objectInput(value: unknown) {
	if (!value || typeof value !== "object") throw new Error("Invalid request.");
	return value as Record<string, unknown>;
}

function text(value: unknown, field: string) {
	if (typeof value !== "string" || !value.trim())
		throw new Error(`${field} is required.`);
	return value.trim();
}

function questionInput(value: unknown): QuestionInput {
	const input = objectInput(value);
	if (!Array.isArray(input.options) || !Array.isArray(input.tags))
		throw new Error("Question options and tags are required.");
	return normalizeQuestionInput({
		type: input.type as QuestionType,
		prompt: text(input.prompt, "Prompt"),
		explanation:
			typeof input.explanation === "string" ? input.explanation : null,
		difficulty: input.difficulty as QuestionDifficulty,
		defaultMarks: Number(input.defaultMarks),
		tags: input.tags.map((tag) => text(tag, "Tag")),
		options: input.options.map((raw) => {
			const option = objectInput(raw);
			return {
				text: text(option.text, "Option"),
				isCorrect: option.isCorrect === true,
			};
		}),
	});
}

const listValidator = (value: unknown) => {
	const input =
		value && typeof value === "object"
			? (value as Record<string, unknown>)
			: {};
	return {
		search:
			typeof input.search === "string" ? input.search.trim().slice(0, 100) : "",
		type: (input.type === "single_choice" || input.type === "true_false"
			? input.type
			: "all") as QuestionType | "all",
		difficulty: (input.difficulty === "easy" ||
		input.difficulty === "medium" ||
		input.difficulty === "hard"
			? input.difficulty
			: "all") as QuestionDifficulty | "all",
		status: input.status === "archived" ? "archived" : "active",
		tag:
			typeof input.tag === "string"
				? input.tag.trim().toLowerCase().slice(0, 30)
				: "",
		page:
			typeof input.page === "number" && Number.isInteger(input.page)
				? Math.max(1, input.page)
				: 1,
		sortBy:
			input.sortBy === "prompt" || input.sortBy === "difficulty"
				? input.sortBy
				: "updatedAt",
		sortDirection: input.sortDirection === "asc" ? "asc" : "desc",
	};
};

export const listQuestions = createServerFn({ method: "GET" })
	.validator(listValidator)
	.handler(async ({ data }) => {
		const { organizationId } = await requireOrganizationPermission({
			resource: "question",
			action: "read",
		});
		const conditions = [
			eq(schema.question.organizationId, organizationId),
			eq(schema.question.status, data.status as QuestionStatus),
			data.type !== "all" ? eq(schema.question.type, data.type) : undefined,
			data.difficulty !== "all"
				? eq(schema.question.difficulty, data.difficulty)
				: undefined,
			data.search
				? or(
						like(schema.question.prompt, `%${data.search}%`),
						sql`exists (select 1 from ${schema.questionTag} where ${schema.questionTag.questionId} = ${schema.question.id} and ${schema.questionTag.tag} like ${`%${data.search.toLowerCase()}%`})`,
					)
				: undefined,
			data.tag
				? sql`exists (select 1 from ${schema.questionTag} where ${schema.questionTag.questionId} = ${schema.question.id} and ${schema.questionTag.tag} = ${data.tag})`
				: undefined,
		].filter(Boolean);
		const where = and(...conditions);
		const orderColumn =
			data.sortBy === "prompt"
				? schema.question.prompt
				: data.sortBy === "difficulty"
					? schema.question.difficulty
					: schema.question.updatedAt;
		const pageSize = 25;
		const [rows, totals] = await Promise.all([
			db
				.select()
				.from(schema.question)
				.where(where)
				.orderBy(
					data.sortDirection === "asc" ? asc(orderColumn) : desc(orderColumn),
				)
				.limit(pageSize)
				.offset((data.page - 1) * pageSize),
			db.select({ total: count() }).from(schema.question).where(where),
		]);
		const ids = rows.map((row) => row.id);
		const tags = ids.length
			? await db
					.select()
					.from(schema.questionTag)
					.where(inArray(schema.questionTag.questionId, ids))
			: [];
		return {
			rows: rows.map((row) => ({
				...row,
				tags: tags
					.filter((tag) => tag.questionId === row.id)
					.map((tag) => tag.tag),
			})),
			total: totals[0]?.total ?? 0,
			page: data.page,
			pageCount: Math.max(1, Math.ceil((totals[0]?.total ?? 0) / pageSize)),
		};
	});

export const getQuestion = createServerFn({ method: "GET" })
	.validator((value: unknown) => ({
		questionId: text(objectInput(value).questionId, "Question"),
	}))
	.handler(async ({ data }) => {
		const { organizationId } = await requireOrganizationPermission({
			resource: "question",
			action: "read",
		});
		const [question] = await db
			.select()
			.from(schema.question)
			.where(
				and(
					eq(schema.question.id, data.questionId),
					eq(schema.question.organizationId, organizationId),
				),
			)
			.limit(1);
		if (!question) throw new Error("Question not found.");
		const [options, tags] = await Promise.all([
			db
				.select()
				.from(schema.questionOption)
				.where(eq(schema.questionOption.questionId, question.id))
				.orderBy(asc(schema.questionOption.position)),
			db
				.select()
				.from(schema.questionTag)
				.where(eq(schema.questionTag.questionId, question.id))
				.orderBy(asc(schema.questionTag.tag)),
		]);
		return { ...question, options, tags: tags.map((tag) => tag.tag) };
	});

async function replaceQuestionDetails(
	questionId: string,
	input: QuestionInput,
) {
	await db
		.delete(schema.questionOption)
		.where(eq(schema.questionOption.questionId, questionId));
	await db
		.delete(schema.questionTag)
		.where(eq(schema.questionTag.questionId, questionId));
	await db.insert(schema.questionOption).values(
		input.options.map((option, position) => ({
			id: crypto.randomUUID(),
			questionId,
			text: option.text,
			isCorrect: option.isCorrect,
			position,
		})),
	);
	if (input.tags.length)
		await db
			.insert(schema.questionTag)
			.values(
				input.tags.map((tag) => ({ id: crypto.randomUUID(), questionId, tag })),
			);
}

export const createQuestion = createServerFn({ method: "POST" })
	.validator(questionInput)
	.handler(async ({ data }) => {
		const { session, organizationId } = await requireOrganizationPermission({
			resource: "question",
			action: "create",
			writable: true,
		});
		const id = crypto.randomUUID();
		const now = new Date();
		await db.insert(schema.question).values({
			id,
			organizationId,
			authorId: session.user.id,
			type: data.type,
			prompt: data.prompt,
			explanation: data.explanation,
			difficulty: data.difficulty,
			defaultMarks: data.defaultMarks,
			status: "active",
			createdAt: now,
			updatedAt: now,
		});
		await replaceQuestionDetails(id, data);
		await auditForSession(session, {
			category: "organization",
			type: "question.created",
			organizationId,
			targetType: "question",
			targetId: id,
		});
		return { id };
	});

export const updateQuestion = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = objectInput(value);
		return {
			questionId: text(input.questionId, "Question"),
			question: questionInput(input.question),
		};
	})
	.handler(async ({ data }) => {
		const { session, organizationId } = await requireOrganizationPermission({
			resource: "question",
			action: "update",
			writable: true,
		});
		const updated = await db
			.update(schema.question)
			.set({
				type: data.question.type,
				prompt: data.question.prompt,
				explanation: data.question.explanation,
				difficulty: data.question.difficulty,
				defaultMarks: data.question.defaultMarks,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(schema.question.id, data.questionId),
					eq(schema.question.organizationId, organizationId),
					eq(schema.question.status, "active"),
				),
			)
			.returning({ id: schema.question.id });
		if (!updated.length) throw new Error("Active question not found.");
		await replaceQuestionDetails(data.questionId, data.question);
		await auditForSession(session, {
			category: "organization",
			type: "question.updated",
			organizationId,
			targetType: "question",
			targetId: data.questionId,
		});
		return { id: data.questionId };
	});

export const archiveQuestion = createServerFn({ method: "POST" })
	.validator((value: unknown) => ({
		questionId: text(objectInput(value).questionId, "Question"),
	}))
	.handler(async ({ data }) => {
		const { session, organizationId } = await requireOrganizationPermission({
			resource: "question",
			action: "delete",
			writable: true,
		});
		const [usage] = await db
			.select({ count: count() })
			.from(schema.examItem)
			.innerJoin(schema.exam, eq(schema.exam.id, schema.examItem.examId))
			.where(
				and(
					eq(schema.examItem.sourceQuestionId, data.questionId),
					eq(schema.exam.organizationId, organizationId),
				),
			);
		if ((usage?.count ?? 0) > 0) {
			await db
				.update(schema.question)
				.set({ status: "archived", updatedAt: new Date() })
				.where(
					and(
						eq(schema.question.id, data.questionId),
						eq(schema.question.organizationId, organizationId),
					),
				);
		} else {
			await db
				.delete(schema.question)
				.where(
					and(
						eq(schema.question.id, data.questionId),
						eq(schema.question.organizationId, organizationId),
					),
				);
		}
		await auditForSession(session, {
			category: "organization",
			type: (usage?.count ?? 0) > 0 ? "question.archived" : "question.deleted",
			organizationId,
			targetType: "question",
			targetId: data.questionId,
		});
		return { status: (usage?.count ?? 0) > 0 ? "archived" : "deleted" };
	});
