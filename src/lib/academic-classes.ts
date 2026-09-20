import { createServerFn } from "@tanstack/react-start";
import { and, asc, count, eq, like, notInArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import {
	assertClassAccess,
	validateAcademicClass,
} from "@/lib/academic-class-policy";
import { auth } from "@/lib/auth";
import {
	auditForSession,
	requireAccountSession,
	requireActiveOrganization,
} from "@/lib/platform-core";
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

async function currentClassContext(options?: { writable?: boolean }) {
	const { headers, session } = await requireAccountSession(options);
	const organizations = await auth.api.listOrganizations({ headers });
	const organizationId =
		session.session.activeOrganizationId ?? organizations[0]?.id;
	if (!organizationId) throw new Error("Select a workspace to continue.");
	const [membership] = await db
		.select({ id: schema.member.id, role: schema.member.role })
		.from(schema.member)
		.where(
			and(
				eq(schema.member.organizationId, organizationId),
				eq(schema.member.userId, session.user.id),
			),
		)
		.limit(1);
	if (!membership) throw new Error("Workspace access is required.");
	await requireActiveOrganization(organizationId);
	return { session, organizationId, membership };
}

function isManager(role: string) {
	return role.split(",").some((item) => item === "owner" || item === "admin");
}

async function requireClassAccess(
	classId: string,
	options?: { writable?: boolean; manageTeachers?: boolean },
) {
	const context = await currentClassContext({ writable: options?.writable });
	const [target] = await db
		.select()
		.from(schema.academicClass)
		.where(
			and(
				eq(schema.academicClass.id, classId),
				eq(schema.academicClass.organizationId, context.organizationId),
			),
		)
		.limit(1);
	if (!target) throw new Error("Class not found.");
	const manager = isManager(context.membership.role);
	const [assignment] = manager
		? [null]
		: await db
				.select({ id: schema.academicClassMember.id })
				.from(schema.academicClassMember)
				.where(
					and(
						eq(schema.academicClassMember.classId, classId),
						eq(schema.academicClassMember.memberId, context.membership.id),
						eq(schema.academicClassMember.role, "teacher"),
					),
				)
				.limit(1);
	assertClassAccess(context.membership.role, Boolean(assignment));
	if (options?.manageTeachers && !manager)
		throw new Error("Only workspace managers can assign teachers.");
	return { ...context, target, manager };
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
		const { organizationId, membership } = await currentClassContext();
		const manager = isManager(membership.role);
		if (!manager && !membership.role.split(",").includes("teacher"))
			throw new Error("Class access is required.");
		const conditions = and(
			eq(schema.academicClass.organizationId, organizationId),
			!manager
				? sql`exists (select 1 from ${schema.academicClassMember} acm where acm.classId = ${schema.academicClass.id} and acm.memberId = ${membership.id} and acm.role = 'teacher')`
				: undefined,
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
			canManageClasses: manager,
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
		const { target, manager } = await requireClassAccess(data.classId);
		return { ...target, canManageClass: manager };
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

export const listAcademicClassMembers = createServerFn({ method: "GET" })
	.validator((value: unknown) => {
		const input = objectValue(value);
		return {
			classId: text(input.classId, "Class"),
			role:
				input.role === "teacher" ? ("teacher" as const) : ("student" as const),
			search:
				typeof input.search === "string"
					? input.search.trim().slice(0, 100)
					: "",
			page:
				typeof input.page === "number"
					? Math.max(1, Math.floor(input.page))
					: 1,
		};
	})
	.handler(async ({ data }) => {
		const { manager } = await requireClassAccess(data.classId);
		if (data.role === "teacher" && !manager)
			throw new Error("Only workspace managers can view teacher assignments.");
		const where = and(
			eq(schema.academicClassMember.classId, data.classId),
			eq(schema.academicClassMember.role, data.role),
			data.search
				? or(
						like(schema.user.name, `%${data.search}%`),
						like(schema.user.email, `%${data.search}%`),
					)
				: undefined,
		);
		const [rows, totals] = await Promise.all([
			db
				.select({
					id: schema.academicClassMember.id,
					memberId: schema.member.id,
					userId: schema.user.id,
					name: schema.user.name,
					email: schema.user.email,
					createdAt: schema.academicClassMember.createdAt,
				})
				.from(schema.academicClassMember)
				.innerJoin(
					schema.member,
					eq(schema.member.id, schema.academicClassMember.memberId),
				)
				.innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
				.where(where)
				.orderBy(asc(schema.user.name))
				.limit(25)
				.offset((data.page - 1) * 25),
			db
				.select({ total: count() })
				.from(schema.academicClassMember)
				.innerJoin(
					schema.member,
					eq(schema.member.id, schema.academicClassMember.memberId),
				)
				.innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
				.where(where),
		]);
		const total = totals[0]?.total ?? 0;
		return {
			rows,
			total,
			page: data.page,
			pageCount: Math.max(1, Math.ceil(total / 25)),
		};
	});

export const searchAvailableClassMembers = createServerFn({ method: "GET" })
	.validator((value: unknown) => {
		const input = objectValue(value);
		return {
			classId: text(input.classId, "Class"),
			role:
				input.role === "teacher" ? ("teacher" as const) : ("student" as const),
			search: text(input.search, "Search").slice(0, 100),
		};
	})
	.handler(async ({ data }) => {
		const { organizationId } = await requireClassAccess(data.classId, {
			manageTeachers: data.role === "teacher",
		});
		const assigned = db
			.select({ memberId: schema.academicClassMember.memberId })
			.from(schema.academicClassMember)
			.where(eq(schema.academicClassMember.classId, data.classId));
		return db
			.select({
				memberId: schema.member.id,
				userId: schema.user.id,
				name: schema.user.name,
				email: schema.user.email,
			})
			.from(schema.member)
			.innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
			.where(
				and(
					eq(schema.member.organizationId, organizationId),
					eq(schema.member.role, data.role),
					notInArray(schema.member.id, assigned),
					or(
						like(schema.user.name, `%${data.search}%`),
						like(schema.user.email, `%${data.search}%`),
					),
				),
			)
			.orderBy(asc(schema.user.name))
			.limit(10);
	});

export const addAcademicClassMember = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = objectValue(value);
		return {
			classId: text(input.classId, "Class"),
			memberId: text(input.memberId, "Member"),
			role:
				input.role === "teacher" ? ("teacher" as const) : ("student" as const),
		};
	})
	.handler(async ({ data }) => {
		const { session, organizationId, target } = await requireClassAccess(
			data.classId,
			{ writable: true, manageTeachers: data.role === "teacher" },
		);
		if (target.status !== "active")
			throw new Error("Archived classes cannot be changed.");
		const [member] = await db
			.select({ id: schema.member.id })
			.from(schema.member)
			.where(
				and(
					eq(schema.member.id, data.memberId),
					eq(schema.member.organizationId, organizationId),
					eq(schema.member.role, data.role),
				),
			)
			.limit(1);
		if (!member) throw new Error(`Select an available ${data.role}.`);
		try {
			await db.insert(schema.academicClassMember).values({
				id: crypto.randomUUID(),
				classId: data.classId,
				memberId: member.id,
				role: data.role,
				createdAt: new Date(),
			});
		} catch (error) {
			if (String(error).includes("UNIQUE"))
				throw new Error("This member is already assigned to the class.");
			throw error;
		}
		await auditForSession(session, {
			category: "organization",
			type: `academic_class.${data.role}-added`,
			organizationId,
			targetType: "academicClass",
			targetId: data.classId,
		});
		return { success: true };
	});

export const removeAcademicClassMember = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = objectValue(value);
		return {
			classId: text(input.classId, "Class"),
			assignmentId: text(input.assignmentId, "Assignment"),
		};
	})
	.handler(async ({ data }) => {
		const [assignment] = await db
			.select({ role: schema.academicClassMember.role })
			.from(schema.academicClassMember)
			.where(
				and(
					eq(schema.academicClassMember.id, data.assignmentId),
					eq(schema.academicClassMember.classId, data.classId),
				),
			)
			.limit(1);
		if (!assignment) throw new Error("Class member not found.");
		const { session, organizationId, target } = await requireClassAccess(
			data.classId,
			{ writable: true, manageTeachers: assignment.role === "teacher" },
		);
		if (target.status !== "active")
			throw new Error("Archived classes cannot be changed.");
		await db
			.delete(schema.academicClassMember)
			.where(eq(schema.academicClassMember.id, data.assignmentId));
		await auditForSession(session, {
			category: "organization",
			type: `academic_class.${assignment.role}-removed`,
			organizationId,
			targetType: "academicClass",
			targetId: data.classId,
		});
		return { success: true };
	});
