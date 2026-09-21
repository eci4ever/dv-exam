import { describe, expect, it } from "vitest";
import {
	calculateReportSummary,
	itemDifficulty,
	reportTrendKey,
	scoreDistribution,
} from "./exam-report-policy";

describe("exam reporting policy", () => {
	it("deduplicates recipients and excludes in-progress attempts from scores", () => {
		const summary = calculateReportSummary([
			{
				recipientId: "one",
				attempt: { status: "submitted", percentage: 80, passed: true },
			},
			{
				recipientId: "one",
				attempt: { status: "submitted", percentage: 80, passed: true },
			},
			{
				recipientId: "two",
				attempt: { status: "timed_out", percentage: 40, passed: false },
			},
			{
				recipientId: "three",
				attempt: { status: "in_progress", percentage: null, passed: null },
			},
			{
				recipientId: "four",
				attempt: { status: null, percentage: null, passed: null },
			},
		]);
		expect(summary).toEqual({
			recipients: 4,
			started: 3,
			completed: 2,
			completionRate: 50,
			averagePercentage: 60,
			passRate: 50,
		});
	});

	it("groups trend points by day, Monday week, or month", () => {
		const date = new Date("2026-09-20T12:00:00Z");
		expect(reportTrendKey(date, "30d")).toBe("2026-09-20");
		expect(reportTrendKey(date, "90d")).toBe("2026-09-14");
		expect(reportTrendKey(date, "12m")).toBe("2026-09");
	});

	it("assigns fixed score buckets and item difficulty", () => {
		expect(scoreDistribution([0, 19, 20, 59, 60, 99, 100])).toEqual([
			{ label: "0–19", min: 0, max: 19, count: 2 },
			{ label: "20–39", min: 20, max: 39, count: 1 },
			{ label: "40–59", min: 40, max: 59, count: 1 },
			{ label: "60–79", min: 60, max: 79, count: 1 },
			{ label: "80–100", min: 80, max: 100, count: 2 },
		]);
		expect(itemDifficulty(80)).toBe("easy");
		expect(itemDifficulty(50)).toBe("moderate");
		expect(itemDifficulty(49)).toBe("difficult");
	});
});
