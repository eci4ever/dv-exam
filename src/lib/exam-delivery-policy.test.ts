import { describe, expect, it } from "vitest";
import {
	assertAttemptCapacity,
	calculateAttemptDeadline,
	calculateExamScore,
	getExamScheduleStatus,
	normalizeScheduleAudience,
} from "@/lib/exam-delivery-policy";

describe("exam delivery policy", () => {
	const opensAt = new Date("2026-09-16T01:00:00Z");
	const closesAt = new Date("2026-09-16T03:00:00Z");

	it("derives schedule status from the server clock", () => {
		expect(
			getExamScheduleStatus({
				opensAt,
				closesAt,
				now: new Date("2026-09-16T00:00:00Z"),
			}),
		).toBe("scheduled");
		expect(
			getExamScheduleStatus({
				opensAt,
				closesAt,
				now: new Date("2026-09-16T02:00:00Z"),
			}),
		).toBe("open");
		expect(getExamScheduleStatus({ opensAt, closesAt, now: closesAt })).toBe(
			"closed",
		);
		expect(
			getExamScheduleStatus({ opensAt, closesAt, cancelledAt: opensAt }),
		).toBe("cancelled");
	});

	it("caps an attempt deadline at the schedule close time", () => {
		expect(
			calculateAttemptDeadline({
				startedAt: new Date("2026-09-16T02:30:00Z"),
				durationMinutes: 60,
				closesAt,
			}),
		).toEqual(closesAt);
	});

	it("scores selected answers and applies the pass mark", () => {
		expect(
			calculateExamScore({
				items: [
					{ id: "one", marks: 2, correctOptionId: "a" },
					{ id: "two", marks: 3, correctOptionId: "b" },
				],
				responses: [
					{ examItemId: "one", selectedOptionId: "a" },
					{ examItemId: "two", selectedOptionId: "x" },
				],
				passingPercentage: 40,
			}),
		).toEqual({ score: 2, maxScore: 5, percentage: 40, passed: true });
	});

	it("blocks attempts at the monthly limit", () => {
		expect(() => assertAttemptCapacity({ used: 10, limit: 10 })).toThrow(
			"monthly attempt limit",
		);
	});

	it("validates and deduplicates schedule classes", () => {
		expect(
			normalizeScheduleAudience({
				audienceMode: "selected_classes",
				classIds: ["a", "a", "b"],
			}),
		).toEqual({ audienceMode: "selected_classes", classIds: ["a", "b"] });
		expect(() =>
			normalizeScheduleAudience({
				audienceMode: "selected_classes",
				classIds: [],
			}),
		).toThrow("at least one class");
	});
});
