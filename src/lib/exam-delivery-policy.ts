export type ExamScheduleStatus = "scheduled" | "open" | "closed" | "cancelled";
export type ExamRecipientStatus =
	| "not_started"
	| "in_progress"
	| "submitted"
	| "timed_out"
	| "missed";
export type ExamAttemptStatus = "in_progress" | "submitted" | "timed_out";
export type ExamSubmissionReason = "manual" | "timeout";
export type ExamScheduleAudienceMode = "all_students" | "selected_classes";

export function normalizeScheduleAudience(input: {
	audienceMode: unknown;
	classIds: unknown;
}) {
	const audienceMode: ExamScheduleAudienceMode =
		input.audienceMode === "selected_classes"
			? "selected_classes"
			: "all_students";
	const classIds = Array.isArray(input.classIds)
		? [
				...new Set(
					input.classIds
						.filter(
							(id): id is string =>
								typeof id === "string" && Boolean(id.trim()),
						)
						.map((id) => id.trim()),
				),
			]
		: [];
	if (audienceMode === "selected_classes" && !classIds.length)
		throw new Error("Select at least one class.");
	return {
		audienceMode,
		classIds: audienceMode === "selected_classes" ? classIds : [],
	};
}

export function getExamScheduleStatus(input: {
	opensAt: Date;
	closesAt: Date;
	cancelledAt?: Date | null;
	now?: Date;
}): ExamScheduleStatus {
	if (input.cancelledAt) return "cancelled";
	const now = input.now ?? new Date();
	if (now < input.opensAt) return "scheduled";
	if (now >= input.closesAt) return "closed";
	return "open";
}

export function normalizeScheduleWindow(input: {
	opensAt: Date;
	closesAt: Date;
}) {
	if (
		Number.isNaN(input.opensAt.getTime()) ||
		Number.isNaN(input.closesAt.getTime())
	)
		throw new Error("Enter a valid schedule window.");
	if (input.closesAt <= input.opensAt)
		throw new Error("Close time must be after open time.");
	return input;
}

export function calculateAttemptDeadline(input: {
	startedAt: Date;
	durationMinutes: number;
	closesAt: Date;
}) {
	const durationDeadline = new Date(
		input.startedAt.getTime() + input.durationMinutes * 60_000,
	);
	return durationDeadline < input.closesAt ? durationDeadline : input.closesAt;
}

export function calculateExamScore(input: {
	items: Array<{ id: string; marks: number; correctOptionId: string }>;
	responses: Array<{ examItemId: string; selectedOptionId: string | null }>;
	passingPercentage: number;
}) {
	const selected = new Map(
		input.responses.map((response) => [
			response.examItemId,
			response.selectedOptionId,
		]),
	);
	const maxScore = input.items.reduce((total, item) => total + item.marks, 0);
	const score = input.items.reduce(
		(total, item) =>
			total + (selected.get(item.id) === item.correctOptionId ? item.marks : 0),
		0,
	);
	const percentage = maxScore ? Math.round((score / maxScore) * 100) : 0;
	return {
		score,
		maxScore,
		percentage,
		passed: percentage >= input.passingPercentage,
	};
}

export function assertAttemptCapacity(input: { used: number; limit: number }) {
	if (input.used >= input.limit)
		throw new Error("Your workspace has reached its monthly attempt limit.");
}
