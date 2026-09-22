import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { getExamScheduleStatus } from "@/lib/exam-delivery-policy";
import {
	calculateReportSummary,
	isCompletedAttempt,
	itemDifficulty,
	type ReportPeriod,
	reportPeriodStart,
	reportTrendKey,
	scoreDistribution,
} from "@/lib/exam-report-policy";
import {
	requireAccountSession,
	requireActiveOrganization,
} from "@/lib/platform-core";

type ReportStatus =
	| "active"
	| "all"
	| "scheduled"
	| "open"
	| "closed"
	| "cancelled";
type ReportSort = "opensAt" | "examTitle" | "completionRate" | "passRate";
type SortDirection = "asc" | "desc";

function record(value: unknown) {
	if (!value || typeof value !== "object") throw new Error("Invalid request.");
	return value as Record<string, unknown>;
}

function optionalText(value: unknown) {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

function reportPeriod(value: unknown): ReportPeriod {
	return value === "30d" || value === "12m" || value === "all" ? value : "90d";
}

function reportStatus(value: unknown): ReportStatus {
	return value === "all" ||
		value === "scheduled" ||
		value === "open" ||
		value === "closed" ||
		value === "cancelled"
		? value
		: "active";
}

function positiveInteger(value: unknown, fallback: number) {
	const parsed = typeof value === "number" ? value : Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function reportSort(value: unknown): ReportSort {
	return value === "examTitle" ||
		value === "completionRate" ||
		value === "passRate"
		? value
		: "opensAt";
}

function sortDirection(value: unknown): SortDirection {
	return value === "asc" ? "asc" : "desc";
}

async function reportingContext() {
	const { headers, session } = await requireAccountSession();
	const { auth } = await import("@/lib/auth");
	const organizations = await auth.api.listOrganizations({ headers });
	const organizationId =
		session.session.activeOrganizationId ?? organizations[0]?.id;
	if (!organizationId) throw new Error("Select a workspace to continue.");
	await requireActiveOrganization(organizationId);
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
	const roles = membership.role.split(",");
	const manager = roles.some((role) => role === "owner" || role === "admin");
	const teacher = roles.includes("teacher");
	if (!manager && !teacher)
		throw new Error("You do not have permission to view reports.");
	const assignedClassIds = teacher
		? (
				await db
					.select({ classId: schema.academicClassMember.classId })
					.from(schema.academicClassMember)
					.where(
						and(
							eq(schema.academicClassMember.memberId, membership.id),
							eq(schema.academicClassMember.role, "teacher"),
						),
					)
			).map((item) => item.classId)
		: [];
	return {
		organizationId,
		manager,
		memberId: membership.id,
		assignedClassIds,
	};
}

interface NormalizedFilters {
	period: ReportPeriod;
	examId: string | null;
	classId: string | null;
	status: ReportStatus;
}

function normalizeFilters(input: Record<string, unknown>): NormalizedFilters {
	return {
		period: reportPeriod(input.period),
		examId: optionalText(input.examId),
		classId: optionalText(input.classId),
		status: reportStatus(input.status),
	};
}

function matchesStatus(
	schedule: {
		opensAt: Date;
		closesAt: Date;
		cancelledAt: Date | null;
	},
	status: ReportStatus,
) {
	const current = getExamScheduleStatus(schedule);
	if (status === "all") return true;
	if (status === "active") return current !== "cancelled";
	return current === status;
}

function recipientScopeCondition(
	context: Awaited<ReturnType<typeof reportingContext>>,
	classId: string | null,
) {
	if (
		!context.manager &&
		classId &&
		!context.assignedClassIds.includes(classId)
	)
		throw new Error("You do not have access to this class report.");
	const allowedClassIds = classId
		? [classId]
		: context.manager
			? null
			: context.assignedClassIds;
	if (allowedClassIds?.length === 0) return sql`0 = 1`;
	if (!allowedClassIds) return undefined;
	return sql`exists (
		select 1 from ${schema.examScheduleRecipientClass} esrc
		where esrc.recipientId = ${schema.examScheduleRecipient.id}
		and esrc.classId in (${sql.join(
			allowedClassIds.map((id) => sql`${id}`),
			sql`, `,
		)})
	)`;
}

async function reportRows(
	context: Awaited<ReturnType<typeof reportingContext>>,
	filters: NormalizedFilters,
) {
	const start = reportPeriodStart(filters.period);
	const rows = await db
		.select({
			schedule: schema.examSchedule,
			examTitle: schema.exam.title,
			examVersion: schema.exam.version,
			recipientId: schema.examScheduleRecipient.id,
			attemptStatus: schema.examAttempt.status,
			percentage: schema.examAttempt.percentage,
			passed: schema.examAttempt.passed,
		})
		.from(schema.examSchedule)
		.innerJoin(schema.exam, eq(schema.exam.id, schema.examSchedule.examId))
		.innerJoin(
			schema.examScheduleRecipient,
			eq(schema.examScheduleRecipient.scheduleId, schema.examSchedule.id),
		)
		.leftJoin(
			schema.examAttempt,
			and(
				eq(schema.examAttempt.scheduleId, schema.examSchedule.id),
				eq(schema.examAttempt.userId, schema.examScheduleRecipient.userId),
			),
		)
		.where(
			and(
				eq(schema.examSchedule.organizationId, context.organizationId),
				filters.examId
					? eq(schema.examSchedule.examId, filters.examId)
					: undefined,
				start ? gte(schema.examSchedule.opensAt, start) : undefined,
				recipientScopeCondition(context, filters.classId),
			),
		)
		.orderBy(asc(schema.examSchedule.opensAt));
	return rows.filter((row) => matchesStatus(row.schedule, filters.status));
}

export const getReportFilterOptions = createServerFn({ method: "GET" }).handler(
	async () => {
		const context = await reportingContext();
		const exams = await db
			.selectDistinct({ id: schema.exam.id, title: schema.exam.title })
			.from(schema.exam)
			.where(eq(schema.exam.organizationId, context.organizationId))
			.orderBy(asc(schema.exam.title));
		const classes = await db
			.select({
				id: schema.academicClass.id,
				name: schema.academicClass.name,
				code: schema.academicClass.code,
			})
			.from(schema.academicClass)
			.where(
				and(
					eq(schema.academicClass.organizationId, context.organizationId),
					context.manager
						? undefined
						: context.assignedClassIds.length
							? inArray(schema.academicClass.id, context.assignedClassIds)
							: sql`0 = 1`,
				),
			)
			.orderBy(asc(schema.academicClass.name));
		return { exams, classes };
	},
);

export const getReportsOverview = createServerFn({ method: "GET" })
	.validator((value: unknown) => normalizeFilters(record(value)))
	.handler(async ({ data }) => {
		const context = await reportingContext();
		const rows = await reportRows(context, data);
		const comparisonStart = reportPeriodStart(data.period);
		const summary = calculateReportSummary(
			rows.map((row) => ({
				recipientId: row.recipientId,
				attempt: {
					status: row.attemptStatus,
					percentage: row.percentage,
					passed: row.passed,
				},
			})),
		);
		const trendGroups = new Map<string, typeof rows>();
		for (const row of rows) {
			const key = reportTrendKey(row.schedule.opensAt, data.period);
			const group = trendGroups.get(key) ?? [];
			group.push(row);
			trendGroups.set(key, group);
		}
		const trend = [...trendGroups]
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([period, group]) => ({
				period,
				...calculateReportSummary(
					group.map((row) => ({
						recipientId: row.recipientId,
						attempt: {
							status: row.attemptStatus,
							percentage: row.percentage,
							passed: row.passed,
						},
					})),
				),
			}));

		const comparisonRows = await db
			.select({
				classId: schema.academicClass.id,
				className: schema.academicClass.name,
				classCode: schema.academicClass.code,
				recipientId: schema.examScheduleRecipient.id,
				attemptStatus: schema.examAttempt.status,
				percentage: schema.examAttempt.percentage,
				passed: schema.examAttempt.passed,
				schedule: schema.examSchedule,
			})
			.from(schema.examScheduleRecipientClass)
			.innerJoin(
				schema.examScheduleRecipient,
				eq(
					schema.examScheduleRecipient.id,
					schema.examScheduleRecipientClass.recipientId,
				),
			)
			.innerJoin(
				schema.examSchedule,
				eq(schema.examSchedule.id, schema.examScheduleRecipient.scheduleId),
			)
			.innerJoin(
				schema.academicClass,
				eq(schema.academicClass.id, schema.examScheduleRecipientClass.classId),
			)
			.leftJoin(
				schema.examAttempt,
				and(
					eq(schema.examAttempt.scheduleId, schema.examSchedule.id),
					eq(schema.examAttempt.userId, schema.examScheduleRecipient.userId),
				),
			)
			.where(
				and(
					eq(schema.examSchedule.organizationId, context.organizationId),
					data.examId ? eq(schema.examSchedule.examId, data.examId) : undefined,
					data.classId ? eq(schema.academicClass.id, data.classId) : undefined,
					!context.manager
						? context.assignedClassIds.length
							? inArray(schema.academicClass.id, context.assignedClassIds)
							: sql`0 = 1`
						: undefined,
					comparisonStart
						? gte(schema.examSchedule.opensAt, comparisonStart)
						: undefined,
				),
			);
		const classGroups = new Map<
			string,
			{ name: string; code: string; rows: typeof comparisonRows }
		>();
		for (const row of comparisonRows.filter((item) =>
			matchesStatus(item.schedule, data.status),
		)) {
			const group = classGroups.get(row.classId) ?? {
				name: row.className,
				code: row.classCode,
				rows: [],
			};
			group.rows.push(row);
			classGroups.set(row.classId, group);
		}
		const classes = [...classGroups].map(([id, group]) => ({
			id,
			name: group.name,
			code: group.code,
			...calculateReportSummary(
				group.rows.map((row) => ({
					recipientId: row.recipientId,
					attempt: {
						status: row.attemptStatus,
						percentage: row.percentage,
						passed: row.passed,
					},
				})),
			),
		}));
		return { summary, trend, classes };
	});

export const listReportSchedules = createServerFn({ method: "GET" })
	.validator((value: unknown) => {
		const input = record(value);
		return {
			...normalizeFilters(input),
			search: optionalText(input.search)?.toLowerCase() ?? "",
			page: positiveInteger(input.page, 1),
			pageSize: Math.min(100, positiveInteger(input.pageSize, 25)),
			sortBy: reportSort(input.sortBy),
			sortDirection: sortDirection(input.sortDirection),
		};
	})
	.handler(async ({ data }) => {
		const context = await reportingContext();
		const rows = await reportRows(context, data);
		const groups = new Map<
			string,
			{
				id: string;
				examTitle: string;
				examVersion: number;
				opensAt: Date;
				closesAt: Date;
				status: ReturnType<typeof getExamScheduleStatus>;
				rows: typeof rows;
			}
		>();
		for (const row of rows) {
			const group = groups.get(row.schedule.id) ?? {
				id: row.schedule.id,
				examTitle: row.examTitle,
				examVersion: row.examVersion,
				opensAt: row.schedule.opensAt,
				closesAt: row.schedule.closesAt,
				status: getExamScheduleStatus(row.schedule),
				rows: [],
			};
			group.rows.push(row);
			groups.set(row.schedule.id, group);
		}
		let schedules = [...groups.values()]
			.map(({ rows: groupRows, ...group }) => ({
				...group,
				...calculateReportSummary(
					groupRows.map((row) => ({
						recipientId: row.recipientId,
						attempt: {
							status: row.attemptStatus,
							percentage: row.percentage,
							passed: row.passed,
						},
					})),
				),
			}))
			.filter((item) => item.examTitle.toLowerCase().includes(data.search));
		const direction = data.sortDirection === "asc" ? 1 : -1;
		schedules.sort((left, right) => {
			if (data.sortBy === "examTitle")
				return left.examTitle.localeCompare(right.examTitle) * direction;
			if (data.sortBy === "completionRate")
				return (left.completionRate - right.completionRate) * direction;
			if (data.sortBy === "passRate")
				return (left.passRate - right.passRate) * direction;
			return (left.opensAt.getTime() - right.opensAt.getTime()) * direction;
		});
		const total = schedules.length;
		const pageCount = Math.max(1, Math.ceil(total / data.pageSize));
		const page = Math.min(data.page, pageCount);
		schedules = schedules.slice(
			(page - 1) * data.pageSize,
			page * data.pageSize,
		);
		return { rows: schedules, total, page, pageCount };
	});

async function scheduleTarget(
	context: Awaited<ReturnType<typeof reportingContext>>,
	scheduleId: string,
) {
	const [target] = await db
		.select({
			schedule: schema.examSchedule,
			examTitle: schema.exam.title,
			examVersion: schema.exam.version,
			durationMinutes: schema.exam.durationMinutes,
			passingPercentage: schema.exam.passingPercentage,
		})
		.from(schema.examSchedule)
		.innerJoin(schema.exam, eq(schema.exam.id, schema.examSchedule.examId))
		.where(
			and(
				eq(schema.examSchedule.id, scheduleId),
				eq(schema.examSchedule.organizationId, context.organizationId),
			),
		)
		.limit(1);
	if (!target) throw new Error("Schedule report not found.");
	if (!context.manager && !target.schedule.classSnapshotCapturedAt)
		throw new Error(
			"Class-level reporting is unavailable for this legacy schedule.",
		);
	return target;
}

function detailClassIds(
	context: Awaited<ReturnType<typeof reportingContext>>,
	classId: string | null,
) {
	if (classId) {
		if (!context.manager && !context.assignedClassIds.includes(classId))
			throw new Error("You do not have access to this class report.");
		return [classId];
	}
	return context.manager ? null : context.assignedClassIds;
}

async function scopedScheduleRecipients(
	context: Awaited<ReturnType<typeof reportingContext>>,
	scheduleId: string,
	classId: string | null,
) {
	const allowedClassIds = detailClassIds(context, classId);
	if (allowedClassIds?.length === 0) return [];
	if (classId) {
		const [mapping] = await db
			.select({ id: schema.examScheduleRecipientClass.id })
			.from(schema.examScheduleRecipientClass)
			.innerJoin(
				schema.examScheduleRecipient,
				eq(
					schema.examScheduleRecipient.id,
					schema.examScheduleRecipientClass.recipientId,
				),
			)
			.where(
				and(
					eq(schema.examScheduleRecipient.scheduleId, scheduleId),
					eq(schema.examScheduleRecipientClass.classId, classId),
				),
			)
			.limit(1);
		if (!mapping) throw new Error("Class is not part of this schedule report.");
	}
	return db
		.select({
			recipientId: schema.examScheduleRecipient.id,
			userId: schema.examScheduleRecipient.userId,
			name: schema.user.name,
			email: schema.user.email,
			attemptId: schema.examAttempt.id,
			attemptStatus: schema.examAttempt.status,
			startedAt: schema.examAttempt.startedAt,
			submittedAt: schema.examAttempt.submittedAt,
			percentage: schema.examAttempt.percentage,
			score: schema.examAttempt.score,
			maxScore: schema.examAttempt.maxScore,
			passed: schema.examAttempt.passed,
		})
		.from(schema.examScheduleRecipient)
		.innerJoin(
			schema.user,
			eq(schema.user.id, schema.examScheduleRecipient.userId),
		)
		.leftJoin(
			schema.examAttempt,
			and(
				eq(schema.examAttempt.scheduleId, scheduleId),
				eq(schema.examAttempt.userId, schema.examScheduleRecipient.userId),
			),
		)
		.where(
			and(
				eq(schema.examScheduleRecipient.scheduleId, scheduleId),
				allowedClassIds
					? sql`exists (
						select 1 from ${schema.examScheduleRecipientClass} esrc
						where esrc.recipientId = ${schema.examScheduleRecipient.id}
						and esrc.classId in (${sql.join(
							allowedClassIds.map((id) => sql`${id}`),
							sql`, `,
						)})
					)`
					: undefined,
			),
		);
}

async function scheduleReportClasses(
	context: Awaited<ReturnType<typeof reportingContext>>,
	scheduleId: string,
	snapshotAvailable: boolean,
) {
	if (!snapshotAvailable) {
		if (!context.manager) return [];
		return db
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
			.where(eq(schema.examScheduleClass.scheduleId, scheduleId))
			.orderBy(asc(schema.academicClass.name));
	}
	return db
		.selectDistinct({
			id: schema.academicClass.id,
			name: schema.academicClass.name,
			code: schema.academicClass.code,
		})
		.from(schema.examScheduleRecipientClass)
		.innerJoin(
			schema.examScheduleRecipient,
			eq(
				schema.examScheduleRecipient.id,
				schema.examScheduleRecipientClass.recipientId,
			),
		)
		.innerJoin(
			schema.academicClass,
			eq(schema.academicClass.id, schema.examScheduleRecipientClass.classId),
		)
		.where(
			and(
				eq(schema.examScheduleRecipient.scheduleId, scheduleId),
				!context.manager
					? context.assignedClassIds.length
						? inArray(schema.academicClass.id, context.assignedClassIds)
						: sql`0 = 1`
					: undefined,
			),
		)
		.orderBy(asc(schema.academicClass.name));
}

export const getScheduleReport = createServerFn({ method: "GET" })
	.validator((value: unknown) => {
		const input = record(value);
		return {
			scheduleId: optionalText(input.scheduleId) ?? "",
			classId: optionalText(input.classId),
		};
	})
	.handler(async ({ data }) => {
		if (!data.scheduleId) throw new Error("Schedule is required.");
		const context = await reportingContext();
		const target = await scheduleTarget(context, data.scheduleId);
		if (data.classId && !target.schedule.classSnapshotCapturedAt)
			throw new Error(
				"Class breakdown is unavailable for this legacy schedule.",
			);
		const recipients = await scopedScheduleRecipients(
			context,
			target.schedule.id,
			data.classId,
		);
		if (!context.manager && !recipients.length)
			throw new Error("You do not have access to this schedule report.");
		const summary = calculateReportSummary(
			recipients.map((row) => ({
				recipientId: row.recipientId,
				attempt: {
					status: row.attemptStatus,
					percentage: row.percentage,
					passed: row.passed,
				},
			})),
		);
		const scheduleStatus = getExamScheduleStatus(target.schedule);
		const classes = await scheduleReportClasses(
			context,
			target.schedule.id,
			Boolean(target.schedule.classSnapshotCapturedAt),
		);
		return {
			...target.schedule,
			examTitle: target.examTitle,
			examVersion: target.examVersion,
			durationMinutes: target.durationMinutes,
			passingPercentage: target.passingPercentage,
			scheduleStatus,
			reportStatus:
				scheduleStatus === "closed" || scheduleStatus === "cancelled"
					? ("final" as const)
					: ("live" as const),
			classSnapshotAvailable: Boolean(target.schedule.classSnapshotCapturedAt),
			isPartial: !context.manager,
			classes,
			summary,
			missedCount:
				scheduleStatus === "closed"
					? recipients.filter((row) => row.attemptStatus === null).length
					: 0,
			timedOutCount: recipients.filter(
				(row) => row.attemptStatus === "timed_out",
			).length,
			distribution: scoreDistribution(
				recipients
					.filter((row) => isCompletedAttempt(row.attemptStatus))
					.map((row) => row.percentage)
					.filter((value): value is number => value !== null),
			),
		};
	});

export const listScheduleReportRecipients = createServerFn({ method: "GET" })
	.validator((value: unknown) => {
		const input = record(value);
		const sortBy =
			input.sortBy === "status" ||
			input.sortBy === "percentage" ||
			input.sortBy === "submittedAt"
				? input.sortBy
				: "name";
		return {
			scheduleId: optionalText(input.scheduleId) ?? "",
			classId: optionalText(input.classId),
			search: optionalText(input.search)?.toLowerCase() ?? "",
			status: optionalText(input.status) ?? "all",
			page: positiveInteger(input.page, 1),
			pageSize: Math.min(100, positiveInteger(input.pageSize, 25)),
			sortBy,
			sortDirection: sortDirection(input.sortDirection),
		};
	})
	.handler(async ({ data }) => {
		if (!data.scheduleId) throw new Error("Schedule is required.");
		const context = await reportingContext();
		const target = await scheduleTarget(context, data.scheduleId);
		if (data.classId && !target.schedule.classSnapshotCapturedAt)
			throw new Error(
				"Class breakdown is unavailable for this legacy schedule.",
			);
		const rows = await scopedScheduleRecipients(
			context,
			target.schedule.id,
			data.classId,
		);
		if (!context.manager && !rows.length)
			throw new Error("You do not have access to this schedule report.");
		const scheduleStatus = getExamScheduleStatus(target.schedule);
		let recipients = rows
			.map((row) => ({
				...row,
				status:
					row.attemptStatus ??
					(scheduleStatus === "closed" ? "missed" : "not_started"),
			}))
			.filter(
				(row) =>
					`${row.name} ${row.email}`.toLowerCase().includes(data.search) &&
					(data.status === "all" || row.status === data.status),
			);
		const direction = data.sortDirection === "asc" ? 1 : -1;
		recipients.sort((left, right) => {
			if (data.sortBy === "status")
				return left.status.localeCompare(right.status) * direction;
			if (data.sortBy === "percentage")
				return ((left.percentage ?? -1) - (right.percentage ?? -1)) * direction;
			if (data.sortBy === "submittedAt")
				return (
					((left.submittedAt?.getTime() ?? 0) -
						(right.submittedAt?.getTime() ?? 0)) *
					direction
				);
			return left.name.localeCompare(right.name) * direction;
		});
		const total = recipients.length;
		const pageCount = Math.max(1, Math.ceil(total / data.pageSize));
		const page = Math.min(data.page, pageCount);
		recipients = recipients.slice(
			(page - 1) * data.pageSize,
			page * data.pageSize,
		);
		return { rows: recipients, total, page, pageCount };
	});

export const getScheduleItemAnalysis = createServerFn({ method: "GET" })
	.validator((value: unknown) => {
		const input = record(value);
		return {
			scheduleId: optionalText(input.scheduleId) ?? "",
			classId: optionalText(input.classId),
		};
	})
	.handler(async ({ data }) => {
		if (!data.scheduleId) throw new Error("Schedule is required.");
		const context = await reportingContext();
		const target = await scheduleTarget(context, data.scheduleId);
		if (data.classId && !target.schedule.classSnapshotCapturedAt)
			throw new Error(
				"Class breakdown is unavailable for this legacy schedule.",
			);
		const recipients = await scopedScheduleRecipients(
			context,
			target.schedule.id,
			data.classId,
		);
		if (!context.manager && !recipients.length)
			throw new Error("You do not have access to this schedule report.");
		const completedAttemptIds = recipients
			.filter((row) => row.attemptId && isCompletedAttempt(row.attemptStatus))
			.map((row) => row.attemptId as string);
		const items = await db
			.select()
			.from(schema.examItem)
			.where(eq(schema.examItem.examId, target.schedule.examId))
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
		const responses = completedAttemptIds.length
			? await db
					.select({
						attemptId: schema.examResponse.attemptId,
						examItemId: schema.examResponse.examItemId,
						selectedOptionId: schema.examResponse.selectedOptionId,
					})
					.from(schema.examResponse)
					.where(inArray(schema.examResponse.attemptId, completedAttemptIds))
			: [];
		return items.map((item) => {
			const itemOptions = options.filter(
				(option) => option.examItemId === item.id,
			);
			const itemResponses = responses.filter(
				(response) => response.examItemId === item.id,
			);
			const selectedIds = itemResponses
				.map((response) => response.selectedOptionId)
				.filter((id): id is string => id !== null);
			const correctIds = new Set(
				itemOptions
					.filter((option) => option.isCorrect)
					.map((option) => option.id),
			);
			const correctCount = selectedIds.filter((id) =>
				correctIds.has(id),
			).length;
			const blankCount = completedAttemptIds.length - selectedIds.length;
			const correctRate = completedAttemptIds.length
				? Math.round((correctCount / completedAttemptIds.length) * 100)
				: 0;
			return {
				id: item.id,
				position: item.position,
				prompt: item.prompt,
				type: item.type,
				marks: item.marks,
				explanation: item.explanation,
				completedAttempts: completedAttemptIds.length,
				correctRate,
				blankRate: completedAttemptIds.length
					? Math.round((blankCount / completedAttemptIds.length) * 100)
					: 0,
				difficulty: itemDifficulty(correctRate),
				options: itemOptions.map((option) => ({
					id: option.id,
					text: option.text,
					isCorrect: option.isCorrect,
					selectedCount: selectedIds.filter((id) => id === option.id).length,
				})),
			};
		});
	});
