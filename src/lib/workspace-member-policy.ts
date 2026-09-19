export type WorkspaceMemberRole = "admin" | "teacher" | "student";

export function parseWorkspaceRoles(role: string) {
	return role
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);
}

export function assertWorkspaceManager(role: string) {
	if (
		!parseWorkspaceRoles(role).some(
			(value) => value === "owner" || value === "admin",
		)
	)
		throw new Error("Workspace manager access is required.");
}

export function assertMemberRole(
	value: string,
): asserts value is WorkspaceMemberRole {
	if (!(value === "admin" || value === "teacher" || value === "student"))
		throw new Error("Select a valid workspace role.");
}

export function assertMemberCanBeManaged(input: {
	actorUserId: string;
	actorRole: string;
	targetUserId: string;
	targetRole: string;
	action: "update" | "remove" | "transfer";
}) {
	const actorRoles = parseWorkspaceRoles(input.actorRole);
	const targetRoles = parseWorkspaceRoles(input.targetRole);
	if (input.action !== "transfer" && targetRoles.includes("owner"))
		throw new Error("Transfer ownership before managing the owner.");
	if (input.action === "remove" && input.actorUserId === input.targetUserId)
		throw new Error("You cannot remove yourself from member management.");
	if (input.action === "transfer") {
		if (!actorRoles.includes("owner"))
			throw new Error("Only the workspace owner can transfer ownership.");
		if (targetRoles.includes("owner"))
			throw new Error("This member already owns the workspace.");
	}
}

export function assertSeatAvailable(input: {
	members: number;
	pendingInvitations: number;
	limit: number;
}) {
	if (input.members + input.pendingInvitations >= input.limit)
		throw new Error("This workspace has reached its member limit.");
}
