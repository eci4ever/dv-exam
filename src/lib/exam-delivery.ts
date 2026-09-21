import { createServerFn } from "@tanstack/react-start";
import { and, asc, count, desc, eq, inArray, like, or, sql } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import {
	calculateAttemptDeadline,
	calculateExamScore,
	type ExamRecipientStatus,
	getExamScheduleStatus,
	normalizeScheduleAudience,
	normalizeScheduleWindow,
} from "@/lib/exam-delivery-policy";
import {
	auditForSession,
	requireAccountSession,
	requireActiveOrganization,
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

function dateValue(value: unknown, label: string) {
	const date = new Date(requiredText(value, label));
	if (Number.isNaN(date.getTime())) throw new Error(`${label} is invalid.`);
	return date;
}

async function currentMembership(options?: { writable?: boolean }) {
	const { headers, session } = await requireAccountSession(options);
	const organizations = await import("@/lib/auth").then(({ auth }) =>
		auth.api.listOrganizations({ headers }),
	);
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
	return {
		headers,
		session,
		organizationId,
		memberId: membership.id,
		role: membership.role,
	};
}

function canManage(role: string) {
	return role
		.split(",")
		.some((item) => ["owner", "admin", "teacher"].includes(item));
}

function isOrganizationManager(role: string) {
	return role.split(",").some((item) => item === "owner" || item === "admin");
}

async function assertTeacherScheduleAccess(input: {
	scheduleId: string;
	createdBy: string;
	userId: string;
	memberId: string;
	role: string;
}) {
	if (isOrganizationManager(input.role)) return;
	const sources = await db
		.select({ classId: schema.examScheduleClass.classId })
		.from(schema.examScheduleClass)
		.where(eq(schema.examScheduleClass.scheduleId, input.scheduleId));
	if (!sources.length) {
		if (input.createdBy !== input.userId)
			throw new Error("You do not have access to this schedule.");
		return;
	}
	const assignments = await db
		.select({ classId: schema.academicClassMember.classId })
		.from(schema.academicClassMember)
		.where(
			and(
				inArray(
					schema.academicClassMember.classId,
					sources.map((source) => source.classId),
				),
				eq(schema.academicClassMember.memberId, input.memberId),
				eq(schema.academicClassMember.role, "teacher"),
			),
		);
	if (assignments.length !== sources.length)
		throw new Error("You do not have access to this schedule.");
}

function recipientStatus(
	attempt: typeof schema.examAttempt.$inferSelect | null,
	closesAt: Date,
): ExamRecipientStatus {
	if (!attempt) return new Date() >= closesAt ? "missed" : "not_started";
	return attempt.status;
}

export const listPublishedExamChoices = createServerFn({
	method: "GET",
}).handler(async () => {
	const { organizationId, organizationRole } =
		await requireOrganizationPermission({
			resource: "exam",
			action: "read",
		});
	if (!canManage(organizationRole))
		throw new Error("You do not have permission to manage exam delivery.");
	return db
		.select({
			id: schema.exam.id,
			title: schema.exam.title,
			version: schema.exam.version,
			durationMinutes: schema.exam.durationMinutes,
			passingPercentage: schema.exam.passingPercentage,
		})
		.from(schema.exam)
		.where(
			and(
				eq(schema.exam.organizationId, organizationId),
				eq(schema.exam.status, "published"),
			),
		)
		.orderBy(asc(schema.exam.title));
});

export const listScheduleClassChoices = createServerFn({
	method: "GET",
}).handler(async () => {
	const { organizationId, memberId, role } = await currentMembership();
	if (!canManage(role))
		throw new Error("You do not have permission to manage exam delivery.");
	const manager = isOrganizationManager(role);
	return db
		.select({
			id: schema.academicClass.id,
			name: schema.academicClass.name,
			code: schema.academicClass.code,
		})
		.from(schema.academicClass)
		.where(
			and(
				eq(schema.academicClass.organizationId, organizationId),
				eq(schema.academicClass.status, "active"),
				manager
					? undefined
					: sql`exists (select 1 from ${schema.academicClassMember} acm where acm.classId = ${schema.academicClass.id} and acm.memberId = ${memberId} and acm.role = 'teacher')`,
			),
		)
		.orderBy(asc(schema.academicClass.name));
});

async function resolveScheduleAudience(input: {
	organizationId: string;
	memberId: string;
	role: string;
	audienceMode: "all_students" | "selected_classes";
	classIds: string[];
}) {
	const manager = isOrganizationManager(input.role);
	if (input.audienceMode === "all_students") {
		if (!manager) throw new Error("Teachers must schedule assigned classes.");
		const students = await db
			.select({ memberId: schema.member.id, userId: schema.member.userId })
			.from(schema.member)
			.where(
				and(
					eq(schema.member.organizationId, input.organizationId),
					or(
						eq(schema.member.role, "student"),
						like(schema.member.role, "%,student,%"),
						like(schema.member.role, "student,%"),
						like(schema.member.role, "%,student"),
					),
				),
			);
		const classMemberships = students.length
			? await db
					.select({
						memberId: schema.academicClassMember.memberId,
						classId: schema.academicClassMember.classId,
					})
					.from(schema.academicClassMember)
					.innerJoin(
						schema.academicClass,
						eq(schema.academicClass.id, schema.academicClassMember.classId),
					)
					.where(
						and(
							inArray(
								schema.academicClassMember.memberId,
								students.map((student) => student.memberId),
							),
							eq(schema.academicClassMember.role, "student"),
							eq(schema.academicClass.status, "active"),
						),
					)
			: [];
		const classesByMember = new Map<string, string[]>();
		for (const membership of classMemberships) {
			const classIds = classesByMember.get(membership.memberId) ?? [];
			classIds.push(membership.classId);
			classesByMember.set(membership.memberId, classIds);
		}
		return {
			students: students.map((student) => ({
				userId: student.userId,
				classIds: classesByMember.get(student.memberId) ?? [],
			})),
			classes: [] as Array<{ id: string }>,
		};
	}
	const classes = await db
		.select({ id: schema.academicClass.id })
		.from(schema.academicClass)
		.where(
			and(
				eq(schema.academicClass.organizationId, input.organizationId),
				eq(schema.academicClass.status, "active"),
				inArray(schema.academicClass.id, input.classIds),
				manager
					? undefined
					: sql`exists (select 1 from ${schema.academicClassMember} acm where acm.classId = ${schema.academicClass.id} and acm.memberId = ${input.memberId} and acm.role = 'teacher')`,
			),
		);
	if (classes.length !== input.classIds.length)
		throw new Error("Select only active classes you are assigned to.");
	const studentMemberships = await db
		.select({
			userId: schema.member.userId,
			classId: schema.academicClassMember.classId,
		})
		.from(schema.academicClassMember)
		.innerJoin(
			schema.member,
			eq(schema.member.id, schema.academicClassMember.memberId),
		)
		.where(
			and(
				inArray(schema.academicClassMember.classId, input.classIds),
				eq(schema.academicClassMember.role, "student"),
				eq(schema.member.organizationId, input.organizationId),
			),
		);
	const studentsByUser = new Map<string, Set<string>>();
	for (const membership of studentMemberships) {
		const classIds = studentsByUser.get(membership.userId) ?? new Set<string>();
		classIds.add(membership.classId);
		studentsByUser.set(membership.userId, classIds);
	}
	return {
		students: [...studentsByUser].map(([userId, classIds]) => ({
			userId,
			classIds: [...classIds],
		})),
		classes,
	};
}

function buildRecipientSnapshot(
	students: Array<{ userId: string; classIds: string[] }>,
	scheduleId: string,
	assignedAt: Date,
) {
	const recipients = students.map((student) => ({
		id: crypto.randomUUID(),
		scheduleId,
		userId: student.userId,
		assignedAt,
		classIds: student.classIds,
	}));
	return {
		recipients,
		classes: recipients.flatMap((recipient) =>
			recipient.classIds.map((classId) => ({
				id: crypto.randomUUID(),
				recipientId: recipient.id,
				classId,
			})),
		),
	};
}

export const listExamSchedules = createServerFn({ method: "GET" }).handler(
	async () => {
		const { session, organizationId, memberId, role } =
			await currentMembership();
		if (!canManage(role))
			throw new Error("You do not have permission to manage exam delivery.");
		const manager = isOrganizationManager(role);
		const rows = await db
			.select({
				schedule: schema.examSchedule,
				examTitle: schema.exam.title,
				examVersion: schema.exam.version,
				durationMinutes: schema.exam.durationMinutes,
				recipientCount: count(schema.examScheduleRecipient.id),
			})
			.from(schema.examSchedule)
			.innerJoin(schema.exam, eq(schema.exam.id, schema.examSchedule.examId))
			.leftJoin(
				schema.examScheduleRecipient,
				eq(schema.examScheduleRecipient.scheduleId, schema.examSchedule.id),
			)
			.where(
				and(
					eq(schema.examSchedule.organizationId, organizationId),
					manager
						? undefined
						: or(
								eq(schema.examSchedule.createdBy, session.user.id),
								sql`exists (select 1 from ${schema.examScheduleClass} esc inner join ${schema.academicClassMember} acm on acm.classId = esc.classId where esc.scheduleId = ${schema.examSchedule.id} and acm.memberId = ${memberId} and acm.role = 'teacher')`,
							),
				),
			)
			.groupBy(schema.examSchedule.id)
			.orderBy(desc(schema.examSchedule.opensAt));
		return rows.map((row) => ({
			...row.schedule,
			examTitle: row.examTitle,
			examVersion: row.examVersion,
			durationMinutes: row.durationMinutes,
			recipientCount: row.recipientCount,
			status: getExamScheduleStatus(row.schedule),
		}));
	},
);

export const createExamSchedule = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = record(value);
		const window = normalizeScheduleWindow({
			opensAt: dateValue(input.opensAt, "Open time"),
			closesAt: dateValue(input.closesAt, "Close time"),
		});
		return {
			examId: requiredText(input.examId, "Exam"),
			...normalizeScheduleAudience({
				audienceMode: input.audienceMode,
				classIds: input.classIds,
			}),
			...window,
		};
	})
	.handler(async ({ data }) => {
		const { session, organizationId, memberId, role } = await currentMembership(
			{ writable: true },
		);
		if (!canManage(role))
			throw new Error("You do not have permission to manage exam delivery.");
		await requireActiveOrganization(organizationId);
		const [exam] = await db
			.select({ id: schema.exam.id })
			.from(schema.exam)
			.where(
				and(
					eq(schema.exam.id, data.examId),
					eq(schema.exam.organizationId, organizationId),
					eq(schema.exam.status, "published"),
				),
			)
			.limit(1);
		if (!exam) throw new Error("Select an available published exam.");
		const audience = await resolveScheduleAudience({
			organizationId,
			memberId,
			role,
			audienceMode: data.audienceMode,
			classIds: data.classIds,
		});
		const students = audience.students;
		if (!students.length)
			throw new Error("Add at least one student before scheduling an exam.");
		const id = crypto.randomUUID();
		const now = new Date();
		const recipientSnapshot = buildRecipientSnapshot(students, id, now);
		await db.batch([
			db.insert(schema.examSchedule).values({
				id,
				organizationId,
				examId: exam.id,
				audienceMode: data.audienceMode,
				classSnapshotCapturedAt: now,
				opensAt: data.opensAt,
				closesAt: data.closesAt,
				createdBy: session.user.id,
				createdAt: now,
				updatedAt: now,
			}),
			...audience.classes.map((item) =>
				db.insert(schema.examScheduleClass).values({
					id: crypto.randomUUID(),
					scheduleId: id,
					classId: item.id,
				}),
			),
			...recipientSnapshot.recipients.map((recipient) =>
				db.insert(schema.examScheduleRecipient).values({
					id: recipient.id,
					scheduleId: recipient.scheduleId,
					userId: recipient.userId,
					assignedAt: recipient.assignedAt,
				}),
			),
			...recipientSnapshot.classes.map((item) =>
				db.insert(schema.examScheduleRecipientClass).values(item),
			),
		]);
		await auditForSession(session, {
			category: "organization",
			type: "exam_schedule.created",
			organizationId,
			targetType: "examSchedule",
			targetId: id,
			metadata: {
				recipientCount: students.length,
				audienceMode: data.audienceMode,
				classCount: audience.classes.length,
			},
		});
		return { id };
	});

export const updateExamSchedule = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = record(value);
		return {
			scheduleId: requiredText(input.scheduleId, "Schedule"),
			opensAt: dateValue(input.opensAt, "Open time"),
			closesAt: dateValue(input.closesAt, "Close time"),
			...normalizeScheduleAudience({
				audienceMode: input.audienceMode,
				classIds: input.classIds,
			}),
		};
	})
	.handler(async ({ data }) => {
		const { session, organizationId, memberId, role } = await currentMembership(
			{ writable: true },
		);
		if (!canManage(role))
			throw new Error("You do not have permission to manage exam delivery.");
		await requireActiveOrganization(organizationId);
		const [target] = await db
			.select()
			.from(schema.examSchedule)
			.where(
				and(
					eq(schema.examSchedule.id, data.scheduleId),
					eq(schema.examSchedule.organizationId, organizationId),
				),
			)
			.limit(1);
		if (!target || target.cancelledAt) throw new Error("Schedule not found.");
		await assertTeacherScheduleAccess({
			scheduleId: target.id,
			createdBy: target.createdBy,
			userId: session.user.id,
			memberId,
			role,
		});
		const [attempts] = await db
			.select({ total: count() })
			.from(schema.examAttempt)
			.where(eq(schema.examAttempt.scheduleId, target.id));
		const started = target.opensAt <= new Date() || (attempts?.total ?? 0) > 0;
		if (started) {
			const sources = await db
				.select({ classId: schema.examScheduleClass.classId })
				.from(schema.examScheduleClass)
				.where(eq(schema.examScheduleClass.scheduleId, target.id));
			const currentClassIds = sources.map((source) => source.classId).sort();
			const requestedClassIds = [...data.classIds].sort();
			if (
				data.audienceMode !== target.audienceMode ||
				currentClassIds.join(",") !== requestedClassIds.join(",")
			)
				throw new Error(
					"Audience cannot be changed after a schedule opens or an attempt exists.",
				);
			if (data.closesAt <= target.closesAt)
				throw new Error("An active schedule can only be extended.");
			await db
				.update(schema.examSchedule)
				.set({ closesAt: data.closesAt, updatedAt: new Date() })
				.where(eq(schema.examSchedule.id, target.id));
		} else {
			normalizeScheduleWindow(data);
			const audience = await resolveScheduleAudience({
				organizationId,
				memberId,
				role,
				audienceMode: data.audienceMode,
				classIds: data.classIds,
			});
			if (!audience.students.length)
				throw new Error("The selected audience has no students.");
			const now = new Date();
			const recipientSnapshot = buildRecipientSnapshot(
				audience.students,
				target.id,
				now,
			);
			await db.batch([
				db
					.update(schema.examSchedule)
					.set({
						opensAt: data.opensAt,
						closesAt: data.closesAt,
						audienceMode: data.audienceMode,
						classSnapshotCapturedAt: now,
						updatedAt: now,
					})
					.where(eq(schema.examSchedule.id, target.id)),
				db
					.delete(schema.examScheduleClass)
					.where(eq(schema.examScheduleClass.scheduleId, target.id)),
				db
					.delete(schema.examScheduleRecipient)
					.where(eq(schema.examScheduleRecipient.scheduleId, target.id)),
				...audience.classes.map((item) =>
					db.insert(schema.examScheduleClass).values({
						id: crypto.randomUUID(),
						scheduleId: target.id,
						classId: item.id,
					}),
				),
				...recipientSnapshot.recipients.map((recipient) =>
					db.insert(schema.examScheduleRecipient).values({
						id: recipient.id,
						scheduleId: recipient.scheduleId,
						userId: recipient.userId,
						assignedAt: recipient.assignedAt,
					}),
				),
				...recipientSnapshot.classes.map((item) =>
					db.insert(schema.examScheduleRecipientClass).values(item),
				),
			]);
		}
		await auditForSession(session, {
			category: "organization",
			type: "exam_schedule.updated",
			organizationId,
			targetType: "examSchedule",
			targetId: target.id,
		});
		return { id: target.id };
	});

export const cancelExamSchedule = createServerFn({ method: "POST" })
	.validator((value: unknown) => ({
		scheduleId: requiredText(record(value).scheduleId, "Schedule"),
	}))
	.handler(async ({ data }) => {
		const { session, organizationId } = await requireOrganizationPermission({
			resource: "exam",
			action: "delete",
			writable: true,
		});
		const [target] = await db
			.select()
			.from(schema.examSchedule)
			.where(
				and(
					eq(schema.examSchedule.id, data.scheduleId),
					eq(schema.examSchedule.organizationId, organizationId),
				),
			)
			.limit(1);
		if (!target || target.cancelledAt) throw new Error("Schedule not found.");
		const [attempts] = await db
			.select({ total: count() })
			.from(schema.examAttempt)
			.where(eq(schema.examAttempt.scheduleId, target.id));
		if (target.opensAt <= new Date() || (attempts?.total ?? 0) > 0)
			throw new Error(
				"Only a future schedule without attempts can be cancelled.",
			);
		await db
			.update(schema.examSchedule)
			.set({
				cancelledAt: new Date(),
				cancelledBy: session.user.id,
				updatedAt: new Date(),
			})
			.where(eq(schema.examSchedule.id, target.id));
		await auditForSession(session, {
			category: "organization",
			type: "exam_schedule.cancelled",
			organizationId,
			targetType: "examSchedule",
			targetId: target.id,
		});
		return { id: target.id };
	});

export const getExamScheduleMonitoring = createServerFn({ method: "GET" })
	.validator((value: unknown) => ({
		scheduleId: requiredText(record(value).scheduleId, "Schedule"),
	}))
	.handler(async ({ data }) => {
		const { session, organizationId, memberId, role } =
			await currentMembership();
		if (!canManage(role))
			throw new Error("You do not have permission to monitor exam delivery.");
		const [target] = await db
			.select({
				schedule: schema.examSchedule,
				examTitle: schema.exam.title,
				version: schema.exam.version,
				durationMinutes: schema.exam.durationMinutes,
				passingPercentage: schema.exam.passingPercentage,
			})
			.from(schema.examSchedule)
			.innerJoin(schema.exam, eq(schema.exam.id, schema.examSchedule.examId))
			.where(
				and(
					eq(schema.examSchedule.id, data.scheduleId),
					eq(schema.examSchedule.organizationId, organizationId),
				),
			)
			.limit(1);
		if (!target) throw new Error("Schedule not found.");
		await assertTeacherScheduleAccess({
			scheduleId: target.schedule.id,
			createdBy: target.schedule.createdBy,
			userId: session.user.id,
			memberId,
			role,
		});
		const rows = await db
			.select({
				recipient: schema.examScheduleRecipient,
				user: {
					id: schema.user.id,
					name: schema.user.name,
					email: schema.user.email,
				},
				attempt: schema.examAttempt,
			})
			.from(schema.examScheduleRecipient)
			.innerJoin(
				schema.user,
				eq(schema.user.id, schema.examScheduleRecipient.userId),
			)
			.leftJoin(
				schema.examAttempt,
				and(
					eq(schema.examAttempt.scheduleId, target.schedule.id),
					eq(schema.examAttempt.userId, schema.examScheduleRecipient.userId),
				),
			)
			.where(eq(schema.examScheduleRecipient.scheduleId, target.schedule.id))
			.orderBy(asc(schema.user.name));
		const recipients = rows.map((row) => ({
			...row.user,
			attempt: row.attempt,
			status: recipientStatus(row.attempt, target.schedule.closesAt),
		}));
		const classNames = await db
			.select({
				id: schema.academicClass.id,
				name: schema.academicClass.name,
				code: schema.academicClass.code,
			})
			.from(schema.examScheduleClass)
			.innerJoin(
				schema.academicClass,
				eq(schema.academicClass.id, schema.examScheduleClass.classId),
			)
			.where(eq(schema.examScheduleClass.scheduleId, target.schedule.id))
			.orderBy(asc(schema.academicClass.name));
		return {
			...target.schedule,
			examTitle: target.examTitle,
			version: target.version,
			durationMinutes: target.durationMinutes,
			passingPercentage: target.passingPercentage,
			status: getExamScheduleStatus(target.schedule),
			classes: classNames,
			recipients,
			summary: recipients.reduce<Record<ExamRecipientStatus, number>>(
				(totals, recipient) => {
					totals[recipient.status] += 1;
					return totals;
				},
				{
					not_started: 0,
					in_progress: 0,
					submitted: 0,
					timed_out: 0,
					missed: 0,
				},
			),
		};
	});

export const listMyExamDeliveries = createServerFn({ method: "GET" }).handler(
	async () => {
		const { session, organizationId } = await currentMembership();
		const rows = await db
			.select({
				schedule: schema.examSchedule,
				exam: {
					title: schema.exam.title,
					version: schema.exam.version,
					durationMinutes: schema.exam.durationMinutes,
				},
				attempt: schema.examAttempt,
			})
			.from(schema.examScheduleRecipient)
			.innerJoin(
				schema.examSchedule,
				eq(schema.examSchedule.id, schema.examScheduleRecipient.scheduleId),
			)
			.innerJoin(schema.exam, eq(schema.exam.id, schema.examSchedule.examId))
			.leftJoin(
				schema.examAttempt,
				and(
					eq(schema.examAttempt.scheduleId, schema.examSchedule.id),
					eq(schema.examAttempt.userId, session.user.id),
				),
			)
			.where(
				and(
					eq(schema.examSchedule.organizationId, organizationId),
					eq(schema.examScheduleRecipient.userId, session.user.id),
				),
			)
			.orderBy(desc(schema.examSchedule.opensAt));
		return rows.map((row) => ({
			...row.schedule,
			...row.exam,
			attempt: row.attempt,
			scheduleStatus: getExamScheduleStatus(row.schedule),
			recipientStatus: recipientStatus(row.attempt, row.schedule.closesAt),
		}));
	},
);

async function finalizeAttempt(
	attemptId: string,
	reason: "manual" | "timeout",
) {
	const [attempt] = await db
		.select()
		.from(schema.examAttempt)
		.where(eq(schema.examAttempt.id, attemptId))
		.limit(1);
	if (!attempt) throw new Error("Attempt not found.");
	if (attempt.status !== "in_progress") return attempt;
	const examItems = await db
		.select({ id: schema.examItem.id, marks: schema.examItem.marks })
		.from(schema.examItem)
		.where(eq(schema.examItem.examId, attempt.examId));
	const options = examItems.length
		? await db
				.select({
					id: schema.examItemOption.id,
					examItemId: schema.examItemOption.examItemId,
				})
				.from(schema.examItemOption)
				.where(
					and(
						inArray(
							schema.examItemOption.examItemId,
							examItems.map((item) => item.id),
						),
						eq(schema.examItemOption.isCorrect, true),
					),
				)
		: [];
	const responses = await db
		.select({
			examItemId: schema.examResponse.examItemId,
			selectedOptionId: schema.examResponse.selectedOptionId,
		})
		.from(schema.examResponse)
		.where(eq(schema.examResponse.attemptId, attempt.id));
	const [exam] = await db
		.select({ passingPercentage: schema.exam.passingPercentage })
		.from(schema.exam)
		.where(eq(schema.exam.id, attempt.examId))
		.limit(1);
	if (!exam) throw new Error("Exam not found.");
	const result = calculateExamScore({
		items: examItems.map((item) => ({
			...item,
			correctOptionId:
				options.find((option) => option.examItemId === item.id)?.id ?? "",
		})),
		responses,
		passingPercentage: exam.passingPercentage,
	});
	const now = new Date();
	const [updated] = await db
		.update(schema.examAttempt)
		.set({
			status: reason === "timeout" ? "timed_out" : "submitted",
			submissionReason: reason,
			submittedAt: now,
			...result,
			updatedAt: now,
		})
		.where(
			and(
				eq(schema.examAttempt.id, attempt.id),
				eq(schema.examAttempt.status, "in_progress"),
			),
		)
		.returning();
	return (
		updated ??
		(
			await db
				.select()
				.from(schema.examAttempt)
				.where(eq(schema.examAttempt.id, attempt.id))
				.limit(1)
		)[0]
	);
}

export const startExamAttempt = createServerFn({ method: "POST" })
	.validator((value: unknown) => ({
		scheduleId: requiredText(record(value).scheduleId, "Schedule"),
	}))
	.handler(async ({ data }) => {
		const { session, organizationId } = await currentMembership({
			writable: true,
		});
		await requireActiveOrganization(organizationId);
		const [delivery] = await db
			.select({ schedule: schema.examSchedule, exam: schema.exam })
			.from(schema.examScheduleRecipient)
			.innerJoin(
				schema.examSchedule,
				eq(schema.examSchedule.id, schema.examScheduleRecipient.scheduleId),
			)
			.innerJoin(schema.exam, eq(schema.exam.id, schema.examSchedule.examId))
			.where(
				and(
					eq(schema.examSchedule.id, data.scheduleId),
					eq(schema.examSchedule.organizationId, organizationId),
					eq(schema.examScheduleRecipient.userId, session.user.id),
				),
			)
			.limit(1);
		if (!delivery || getExamScheduleStatus(delivery.schedule) !== "open")
			throw new Error("This exam is not available.");
		const [existing] = await db
			.select()
			.from(schema.examAttempt)
			.where(
				and(
					eq(schema.examAttempt.scheduleId, data.scheduleId),
					eq(schema.examAttempt.userId, session.user.id),
				),
			)
			.limit(1);
		if (existing) return { id: existing.id };
		const [entitlement] = await db
			.select({ limit: schema.platformPlan.monthlyAttemptLimit })
			.from(schema.organizationEntitlement)
			.innerJoin(
				schema.platformPlan,
				eq(schema.platformPlan.id, schema.organizationEntitlement.planId),
			)
			.where(eq(schema.organizationEntitlement.organizationId, organizationId))
			.limit(1);
		if (!entitlement) throw new Error("Workspace plan is unavailable.");
		const now = new Date();
		const monthStart = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
		);
		const monthEnd = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
		);
		const id = crypto.randomUUID();
		const deadlineAt = calculateAttemptDeadline({
			startedAt: now,
			durationMinutes: delivery.exam.durationMinutes,
			closesAt: delivery.schedule.closesAt,
		});
		await db.run(sql`INSERT INTO examAttempt (id, scheduleId, examId, userId, status, startedAt, deadlineAt, createdAt, updatedAt)
			SELECT ${id}, ${delivery.schedule.id}, ${delivery.exam.id}, ${session.user.id}, 'in_progress', ${now.getTime()}, ${deadlineAt.getTime()}, ${now.getTime()}, ${now.getTime()}
			WHERE (SELECT count(*) FROM examAttempt usage INNER JOIN examSchedule scheduled ON scheduled.id = usage.scheduleId WHERE scheduled.organizationId = ${organizationId} AND usage.startedAt >= ${monthStart.getTime()} AND usage.startedAt < ${monthEnd.getTime()}) < ${entitlement.limit}`);
		const [created] = await db
			.select({ id: schema.examAttempt.id })
			.from(schema.examAttempt)
			.where(eq(schema.examAttempt.id, id))
			.limit(1);
		if (!created)
			throw new Error("Your workspace has reached its monthly attempt limit.");
		await auditForSession(session, {
			category: "organization",
			type: "exam_attempt.started",
			organizationId,
			targetType: "examAttempt",
			targetId: id,
			metadata: { scheduleId: delivery.schedule.id },
		});
		return { id };
	});

async function ownedAttempt(attemptId: string, writable = false) {
	const context = await currentMembership({ writable });
	const [row] = await db
		.select({
			attempt: schema.examAttempt,
			schedule: schema.examSchedule,
			exam: schema.exam,
		})
		.from(schema.examAttempt)
		.innerJoin(
			schema.examSchedule,
			eq(schema.examSchedule.id, schema.examAttempt.scheduleId),
		)
		.innerJoin(schema.exam, eq(schema.exam.id, schema.examAttempt.examId))
		.where(
			and(
				eq(schema.examAttempt.id, attemptId),
				eq(schema.examAttempt.userId, context.session.user.id),
				eq(schema.examSchedule.organizationId, context.organizationId),
			),
		)
		.limit(1);
	if (!row) throw new Error("Attempt not found.");
	return { ...context, ...row };
}

export const getLearnerAttempt = createServerFn({ method: "GET" })
	.validator((value: unknown) => ({
		attemptId: requiredText(record(value).attemptId, "Attempt"),
	}))
	.handler(async ({ data }) => {
		const context = await ownedAttempt(data.attemptId);
		const attempt = context.attempt;
		const items = await db
			.select({
				id: schema.examItem.id,
				type: schema.examItem.type,
				prompt: schema.examItem.prompt,
				marks: schema.examItem.marks,
				position: schema.examItem.position,
			})
			.from(schema.examItem)
			.where(eq(schema.examItem.examId, attempt.examId))
			.orderBy(asc(schema.examItem.position));
		const options = items.length
			? await db
					.select({
						id: schema.examItemOption.id,
						examItemId: schema.examItemOption.examItemId,
						text: schema.examItemOption.text,
						position: schema.examItemOption.position,
					})
					.from(schema.examItemOption)
					.where(
						inArray(
							schema.examItemOption.examItemId,
							items.map((item) => item.id),
						),
					)
					.orderBy(asc(schema.examItemOption.position))
			: [];
		const responses = await db
			.select({
				examItemId: schema.examResponse.examItemId,
				selectedOptionId: schema.examResponse.selectedOptionId,
			})
			.from(schema.examResponse)
			.where(eq(schema.examResponse.attemptId, attempt.id));
		return {
			attempt,
			title: context.exam.title,
			durationMinutes: context.exam.durationMinutes,
			items: items.map((item) => ({
				...item,
				options: options.filter((option) => option.examItemId === item.id),
				selectedOptionId:
					responses.find((response) => response.examItemId === item.id)
						?.selectedOptionId ?? null,
			})),
		};
	});

export const saveAttemptResponse = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = record(value);
		return {
			attemptId: requiredText(input.attemptId, "Attempt"),
			examItemId: requiredText(input.examItemId, "Question"),
			selectedOptionId: requiredText(input.selectedOptionId, "Answer"),
		};
	})
	.handler(async ({ data }) => {
		const context = await ownedAttempt(data.attemptId, true);
		if (context.attempt.status !== "in_progress")
			throw new Error("This attempt has already been submitted.");
		if (new Date() >= context.attempt.deadlineAt) {
			throw new Error("Time is up. Submit your saved answers to continue.");
		}
		const [valid] = await db
			.select({ id: schema.examItemOption.id })
			.from(schema.examItemOption)
			.innerJoin(
				schema.examItem,
				eq(schema.examItem.id, schema.examItemOption.examItemId),
			)
			.where(
				and(
					eq(schema.examItem.id, data.examItemId),
					eq(schema.examItem.examId, context.attempt.examId),
					eq(schema.examItemOption.id, data.selectedOptionId),
				),
			)
			.limit(1);
		if (!valid) throw new Error("Select an available answer.");
		await db
			.insert(schema.examResponse)
			.values({
				id: crypto.randomUUID(),
				attemptId: context.attempt.id,
				examItemId: data.examItemId,
				selectedOptionId: data.selectedOptionId,
				updatedAt: new Date(),
			})
			.onConflictDoUpdate({
				target: [schema.examResponse.attemptId, schema.examResponse.examItemId],
				set: { selectedOptionId: data.selectedOptionId, updatedAt: new Date() },
			});
		return { savedAt: new Date() };
	});

export const submitExamAttempt = createServerFn({ method: "POST" })
	.validator((value: unknown) => ({
		attemptId: requiredText(record(value).attemptId, "Attempt"),
	}))
	.handler(async ({ data }) => {
		const context = await ownedAttempt(data.attemptId, true);
		const reason =
			new Date() >= context.attempt.deadlineAt ? "timeout" : "manual";
		const attempt = await finalizeAttempt(context.attempt.id, reason);
		if (context.attempt.status === "in_progress") {
			await auditForSession(context.session, {
				category: "organization",
				type:
					reason === "timeout"
						? "exam_attempt.timed_out"
						: "exam_attempt.submitted",
				organizationId: context.organizationId,
				targetType: "examAttempt",
				targetId: context.attempt.id,
			});
		}
		return { id: context.attempt.id, status: attempt?.status };
	});

export const getMyExamResult = createServerFn({ method: "GET" })
	.validator((value: unknown) => ({
		attemptId: requiredText(record(value).attemptId, "Attempt"),
	}))
	.handler(async ({ data }) => {
		const context = await ownedAttempt(data.attemptId);
		const attempt = context.attempt;
		if (attempt.status === "in_progress")
			throw new Error("Submit the exam before viewing results.");
		const reviewAvailable = new Date() >= context.schedule.closesAt;
		if (!reviewAvailable)
			return {
				attempt,
				title: context.exam.title,
				closesAt: context.schedule.closesAt,
				reviewAvailable,
				items: [],
			};
		const items = await db
			.select()
			.from(schema.examItem)
			.where(eq(schema.examItem.examId, attempt.examId))
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
		const responses = await db
			.select()
			.from(schema.examResponse)
			.where(eq(schema.examResponse.attemptId, attempt.id));
		return {
			attempt,
			title: context.exam.title,
			closesAt: context.schedule.closesAt,
			reviewAvailable,
			items: items.map((item) => {
				const itemOptions = options.filter(
					(option) => option.examItemId === item.id,
				);
				const selectedOptionId =
					responses.find((response) => response.examItemId === item.id)
						?.selectedOptionId ?? null;
				const correctOptionId =
					itemOptions.find((option) => option.isCorrect)?.id ?? null;
				return {
					id: item.id,
					prompt: item.prompt,
					explanation: item.explanation,
					marks: item.marks,
					selectedOptionId,
					correctOptionId,
					earnedMarks: selectedOptionId === correctOptionId ? item.marks : 0,
					options: itemOptions.map(({ id, text, position }) => ({
						id,
						text,
						position,
					})),
				};
			}),
		};
	});

export const listMyResults = createServerFn({ method: "GET" }).handler(
	async () => {
		const { session, organizationId } = await currentMembership();
		return db
			.select({
				attempt: schema.examAttempt,
				title: schema.exam.title,
				closesAt: schema.examSchedule.closesAt,
			})
			.from(schema.examAttempt)
			.innerJoin(
				schema.examSchedule,
				eq(schema.examSchedule.id, schema.examAttempt.scheduleId),
			)
			.innerJoin(schema.exam, eq(schema.exam.id, schema.examAttempt.examId))
			.where(
				and(
					eq(schema.examAttempt.userId, session.user.id),
					eq(schema.examSchedule.organizationId, organizationId),
					or(
						eq(schema.examAttempt.status, "submitted"),
						eq(schema.examAttempt.status, "timed_out"),
					),
				),
			)
			.orderBy(desc(schema.examAttempt.submittedAt));
	},
);

export function userCanManageDelivery(role?: string | null) {
	return role ? canManage(role) : false;
}
