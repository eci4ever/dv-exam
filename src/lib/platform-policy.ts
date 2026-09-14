export type ProtectedAdminAction = "demote" | "ban" | "delete";

export function assertLastActiveAdminSafe(input: {
	action: ProtectedAdminAction;
	targetIsActiveAdmin: boolean;
	activeAdminCount: number;
}) {
	if (input.targetIsActiveAdmin && input.activeAdminCount <= 1) {
		throw new Error("The last active platform admin cannot be changed.");
	}
}

export function assertUserHasNoOwnedOrganizations(
	ownedOrganizationCount: number,
) {
	if (ownedOrganizationCount > 0) {
		throw new Error(
			"Transfer organization ownership before deleting this user.",
		);
	}
}

export function assertWritableSession(impersonatedBy?: string | null) {
	if (impersonatedBy) {
		throw new Error("Return to admin to make changes.");
	}
}

export type OrganizationStatus = "active" | "suspended";

export function assertOrganizationAccessible(status: OrganizationStatus) {
	if (status === "suspended") {
		throw new Error("This workspace is suspended. Contact platform support.");
	}
}

export type UsageState = "ok" | "warning" | "limit";

export function getUsageState(usage: number, limit: number): UsageState {
	if (usage >= limit) return "limit";
	if (usage / limit >= 0.8) return "warning";
	return "ok";
}

export function assertPlanLimitReductionSafe(
	nextLimit: number,
	currentUsage: number,
	label: string,
) {
	if (nextLimit < currentUsage) {
		throw new Error(
			`${label.charAt(0).toUpperCase()}${label.slice(1)} limit cannot be lower than current usage (${currentUsage}).`,
		);
	}
}

export function assertPublicSignupEnabled(
	isEnabled: boolean,
	isAdminCreate: boolean,
) {
	if (!isEnabled && !isAdminCreate) {
		throw new Error("Sign-ups are currently closed.");
	}
}

const sensitiveAuditKeys = new Set([
	"password",
	"token",
	"ip",
	"ipAddress",
	"email",
	"rawBody",
]);

export function sanitizeAuditMetadata(
	metadata: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
	const result: Record<string, string | number | boolean | null> = {};
	for (const [key, value] of Object.entries(metadata)) {
		if (sensitiveAuditKeys.has(key)) continue;
		if (
			value === null ||
			typeof value === "string" ||
			typeof value === "number" ||
			typeof value === "boolean"
		) {
			result[key] = value;
		}
	}
	return result;
}

export function mapAuditIdentity(input: {
	userId: string;
	impersonatedBy?: string | null;
}) {
	return {
		actorUserId: input.impersonatedBy ?? input.userId,
		effectiveUserId: input.userId,
	};
}
