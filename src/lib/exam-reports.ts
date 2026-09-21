import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { getExamScheduleStatus } from "@/lib/exam-delivery-policy";
import {
	calculateReportSummary,
	type ReportPeriod,
	reportPeriodStart,
	reportTrendKey,
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
				start ? sql`${schema.examSchedule.opensAt} >= ${start}` : undefined,
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
					reportPeriodStart(data.period)
						? sql`${schema.examSchedule.opensAt} >= ${reportPeriodStart(data.period)}`
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
