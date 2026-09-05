export type OrganizationPermission =
	| "organization:manage"
	| "examination:manage";

export function hasOrganizationPermission(
	role: string,
	permission: OrganizationPermission,
) {
	const managementRoles = ["owner", "admin"];
	if (permission === "organization:manage")
		return managementRoles.includes(role);
	if (permission === "examination:manage")
		return managementRoles.includes(role);
	return false;
}
