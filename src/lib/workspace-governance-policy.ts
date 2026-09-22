export type UsageHealth = "healthy" | "near_limit" | "at_limit" | "suspended";

export function getUsageHealth(input: {
	status?: "active" | "suspended";
	usage: Array<{ used: number; limit: number }>;
}): UsageHealth {
	if (input.status === "suspended") return "suspended";
	if (input.usage.some(({ used, limit }) => used >= limit)) return "at_limit";
	if (input.usage.some(({ used, limit }) => limit > 0 && used / limit >= 0.8))
		return "near_limit";
	return "healthy";
}

export function canManageWorkspace(role?: string | null) {
	return Boolean(
		role?.split(",").some((item) => item === "owner" || item === "admin"),
	);
}

export function canDeleteWorkspace(role?: string | null) {
	return Boolean(role?.split(",").includes("owner"));
}

export function workspaceAudience(role?: string | null) {
	const roles = role?.split(",") ?? [];
	if (roles.some((item) => item === "owner" || item === "admin"))
		return "manager" as const;
	if (roles.includes("teacher")) return "teacher" as const;
	return "student" as const;
}

export function assertWorkspaceDeletionAllowed(input: {
	scheduledOrOpenSchedules: number;
	inProgressAttempts: number;
}) {
	if (input.scheduledOrOpenSchedules > 0)
		throw new Error(
			"Cancel future schedules and wait for open schedules to close before deleting this workspace.",
		);
	if (input.inProgressAttempts > 0)
		throw new Error(
			"Wait for in-progress attempts to finish before deleting this workspace.",
		);
}
