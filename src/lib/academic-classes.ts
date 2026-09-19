import { createServerFn } from "@tanstack/react-start";
import { and, asc, count, eq, like, or, sql } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { validateAcademicClass } from "@/lib/academic-class-policy";
import { auditForSession } from "@/lib/platform-core";
import { requireWorkspaceManager } from "@/lib/workspace-members";

function objectValue(value: unknown) {
	if (!value || typeof value !== "object") throw new Error("Invalid request.");
	return value as Record<string, unknown>;
}

function text(value: unknown, label: string) {
	if (typeof value !== "string" || !value.trim())
		throw new Error(`${label} is required.`);
	return value.trim();
}

function classInput(value: unknown) {
	const input = objectValue(value);
	return validateAcademicClass({
		name: text(input.name, "Class name"),
		code: text(input.code, "Class code"),
		description:
			typeof input.description === "string" ? input.description : null,
	});
}

export const listAcademicClasses = createServerFn({ method: "GET" })
	.validator((value: unknown) => {
		const input = value && typeof value === "object" ? objectValue(value) : {};
		return {
			search:
				typeof input.search === "string"
					? input.search.trim().slice(0, 100)
					: "",
			status: ["all", "active", "archived"].includes(String(input.status))
				? String(input.status)
				: "active",
			page:
				typeof input.page === "number"
					? Math.max(1, Math.floor(input.page))
					: 1,
		};
	})
	.handler(async ({ data }) => {
		const { organizationId } = await requireWorkspaceManager();
		const conditions = and(
			eq(schema.academicClass.organizationId, organizationId),
			data.status !== "all"
				? eq(schema.academicClass.status, data.status as "active" | "archived")
				: undefined,
			data.search
				? or(
						like(schema.academicClass.name, `%${data.search}%`),
						like(schema.academicClass.code, `%${data.search}%`),
					)
				: undefined,
		);
		const [rows, totals] = await Promise.all([
			db
				.select({
					id: schema.academicClass.id,
					name: schema.academicClass.name,
					code: schema.academicClass.code,
					description: schema.academicClass.description,
					status: schema.academicClass.status,
					createdAt: schema.academicClass.createdAt,
					teacherCount: sql<number>`sum(case when ${schema.academicClassMember.role} = 'teacher' then 1 else 0 end)`,
					studentCount: sql<number>`sum(case when ${schema.academicClassMember.role} = 'student' then 1 else 0 end)`,
				})
				.from(schema.academicClass)
				.leftJoin(
					schema.academicClassMember,
					eq(schema.academicClassMember.classId, schema.academicClass.id),
				)
				.where(conditions)
				.groupBy(schema.academicClass.id)
				.orderBy(asc(schema.academicClass.name))
				.limit(25)
				.offset((data.page - 1) * 25),
			db
				.select({ total: count() })
				.from(schema.academicClass)
				.where(conditions),
		]);
		const total = totals[0]?.total ?? 0;
		return {
			rows,
			total,
			page: data.page,
			pageCount: Math.max(1, Math.ceil(total / 25)),
		};
	});

export const createAcademicClass = createServerFn({ method: "POST" })
	.validator(classInput)
	.handler(async ({ data }) => {
		const { session, organizationId } = await requireWorkspaceManager({
			writable: true,
		});
		const id = crypto.randomUUID();
		const now = new Date();
		try {
			await db.insert(schema.academicClass).values({
				id,
				organizationId,
				...data,
				status: "active",
				createdBy: session.user.id,
				createdAt: now,
				updatedAt: now,
			});
		} catch (error) {
			if (String(error).includes("UNIQUE"))
				throw new Error("Class code is already in use.");
			throw error;
		}
		await auditForSession(session, {
			category: "organization",
			type: "academic_class.created",
			organizationId,
			targetType: "academicClass",
			targetId: id,
		});
		return { id };
	});

export const getAcademicClass = createServerFn({ method: "GET" })
	.validator((value: unknown) => ({
		classId: text(objectValue(value).classId, "Class"),
	}))
	.handler(async ({ data }) => {
		const { organizationId } = await requireWorkspaceManager();
		const [row] = await db
			.select()
			.from(schema.academicClass)
			.where(
				and(
					eq(schema.academicClass.id, data.classId),
					eq(schema.academicClass.organizationId, organizationId),
				),
			)
			.limit(1);
		if (!row) throw new Error("Class not found.");
		return row;
	});

export const updateAcademicClass = createServerFn({ method: "POST" })
	.validator((value: unknown) => ({
		classId: text(objectValue(value).classId, "Class"),
		...classInput(value),
	}))
	.handler(async ({ data }) => {
		const { session, organizationId } = await requireWorkspaceManager({
			writable: true,
		});
		const [target] = await db
			.select({ status: schema.academicClass.status })
			.from(schema.academicClass)
			.where(
				and(
					eq(schema.academicClass.id, data.classId),
					eq(schema.academicClass.organizationId, organizationId),
				),
			)
			.limit(1);
		if (!target) throw new Error("Class not found.");
		if (target.status === "archived")
			throw new Error("Archived classes cannot be changed.");
		try {
			await db
				.update(schema.academicClass)
				.set({
					name: data.name,
					code: data.code,
					description: data.description,
					updatedAt: new Date(),
				})
				.where(eq(schema.academicClass.id, data.classId));
		} catch (error) {
			if (String(error).includes("UNIQUE"))
				throw new Error("Class code is already in use.");
			throw error;
		}
		await auditForSession(session, {
			category: "organization",
			type: "academic_class.updated",
			organizationId,
			targetType: "academicClass",
			targetId: data.classId,
		});
		return { success: true };
	});

export const archiveAcademicClass = createServerFn({ method: "POST" })
	.validator((value: unknown) => ({
		classId: text(objectValue(value).classId, "Class"),
	}))
	.handler(async ({ data }) => {
		const { session, organizationId } = await requireWorkspaceManager({
			writable: true,
		});
		const result = await db
			.update(schema.academicClass)
			.set({ status: "archived", updatedAt: new Date() })
			.where(
				and(
					eq(schema.academicClass.id, data.classId),
					eq(schema.academicClass.organizationId, organizationId),
					eq(schema.academicClass.status, "active"),
				),
			);
		if (!result.meta.changes) throw new Error("Active class not found.");
		await auditForSession(session, {
			category: "organization",
			type: "academic_class.archived",
			organizationId,
			targetType: "academicClass",
			targetId: data.classId,
		});
		return { success: true };
	});
