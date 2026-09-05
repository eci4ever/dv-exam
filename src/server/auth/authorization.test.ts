import { describe, expect, it } from "vitest";
import {
	hasOrganizationPermission,
	isOrganizationMemberRole,
	type OrganizationPermission,
} from "./authorization-policy";

describe("organization authorization policy", () => {
	const managementPermissions: OrganizationPermission[] = [
		"organization:manage",
		"examination:manage",
	];

	it.each(managementPermissions)("allows an owner to %s", (permission) => {
		expect(hasOrganizationPermission("owner", permission)).toBe(true);
	});

	it.each(managementPermissions)("allows an admin to %s", (permission) => {
		expect(hasOrganizationPermission("admin", permission)).toBe(true);
	});

	it.each(managementPermissions)("denies a member from %s", (permission) => {
		expect(hasOrganizationPermission("member", permission)).toBe(false);
	});

	it.each([
		"owner",
		"admin",
		"member",
	])("recognises %s as an organisation member role", (role) => {
		expect(isOrganizationMemberRole(role)).toBe(true);
	});

	it("rejects unknown organisation roles", () => {
		expect(isOrganizationMemberRole("viewer")).toBe(false);
	});
});
