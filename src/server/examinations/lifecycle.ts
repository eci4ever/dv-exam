export type ExaminationStatus = "draft" | "published" | "closed" | "archived";
export type ExaminationAction =
	| "publish"
	| "close"
	| "archive"
	| "publish-results";

const allowedActions: Record<ExaminationStatus, ExaminationAction[]> = {
	draft: ["publish", "archive"],
	published: ["close", "archive"],
	closed: ["publish-results", "archive"],
	archived: [],
};

export function canTransitionExamination(
	status: string,
	action: ExaminationAction,
) {
	return allowedActions[status as ExaminationStatus]?.includes(action) ?? false;
}

export function canSaveCandidateAnswer(endsAt: number | null, now: number) {
	return endsAt === null || endsAt > now;
}

export function canUseOrganizationOperationally(status: string | null) {
	return status === null || status === "active";
}

export function canViewCandidateResult(resultsPublishedAt: number | null) {
	return resultsPublishedAt !== null;
}
