export type ReportPeriod = "30d" | "90d" | "12m" | "all";
export type ScheduleReportStatus = "live" | "final";
export type ItemDifficulty = "easy" | "moderate" | "difficult";

export interface ReportAttemptValue {
	status: "in_progress" | "submitted" | "timed_out" | null;
	percentage: number | null;
	passed: boolean | null;
}

export interface ReportSummary {
	recipients: number;
	started: number;
	completed: number;
	completionRate: number;
	averagePercentage: number;
	passRate: number;
}

export function isCompletedAttempt(status: ReportAttemptValue["status"]) {
	return status === "submitted" || status === "timed_out";
}

export function calculateReportSummary(
	rows: Array<{ recipientId: string; attempt: ReportAttemptValue }>,
): ReportSummary {
	const recipients = new Map<string, ReportAttemptValue>();
	for (const row of rows) recipients.set(row.recipientId, row.attempt);
	const attempts = [...recipients.values()];
	const started = attempts.filter((attempt) => attempt.status !== null).length;
	const completed = attempts.filter((attempt) =>
		isCompletedAttempt(attempt.status),
	);
	const percentages = completed
		.map((attempt) => attempt.percentage)
		.filter((value): value is number => value !== null);
	const passed = completed.filter((attempt) => attempt.passed === true).length;
	return {
		recipients: attempts.length,
		started,
		completed: completed.length,
		completionRate: attempts.length
			? Math.round((completed.length / attempts.length) * 100)
			: 0,
		averagePercentage: percentages.length
			? Math.round(
					percentages.reduce((total, value) => total + value, 0) /
						percentages.length,
				)
			: 0,
		passRate: completed.length
			? Math.round((passed / completed.length) * 100)
			: 0,
	};
}

export function reportPeriodStart(period: ReportPeriod, now = new Date()) {
	if (period === "all") return null;
	const start = new Date(now);
	if (period === "30d") start.setUTCDate(start.getUTCDate() - 30);
	if (period === "90d") start.setUTCDate(start.getUTCDate() - 90);
	if (period === "12m") start.setUTCMonth(start.getUTCMonth() - 12);
	return start;
}

export function reportTrendKey(value: Date, period: ReportPeriod) {
	const date = new Date(value);
	if (period === "30d") return date.toISOString().slice(0, 10);
	if (period === "90d") {
		const day = date.getUTCDay();
		date.setUTCDate(date.getUTCDate() - ((day + 6) % 7));
		return date.toISOString().slice(0, 10);
	}
	return date.toISOString().slice(0, 7);
}

export function itemDifficulty(correctRate: number): ItemDifficulty {
	if (correctRate >= 80) return "easy";
	if (correctRate >= 50) return "moderate";
	return "difficult";
}

export function scoreDistribution(percentages: number[]) {
	const buckets = [
		{ label: "0–19", min: 0, max: 19, count: 0 },
		{ label: "20–39", min: 20, max: 39, count: 0 },
		{ label: "40–59", min: 40, max: 59, count: 0 },
		{ label: "60–79", min: 60, max: 79, count: 0 },
		{ label: "80–100", min: 80, max: 100, count: 0 },
	];
	for (const percentage of percentages) {
		const normalized = Math.max(0, Math.min(100, percentage));
		const bucket = buckets.find(
			(item) => normalized >= item.min && normalized <= item.max,
		);
		if (bucket) bucket.count += 1;
	}
	return buckets;
}
