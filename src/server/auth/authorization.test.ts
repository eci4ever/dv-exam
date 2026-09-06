import { describe, expect, it } from "vitest";
import {
	hasOrganizationPermission,
	canUpdateOrganizationMemberRole,
	isOrganizationMemberRole,
	type OrganizationPermission,
} from "./authorization-policy";
import { DomainError, forbidden, unauthorized } from "#/server/errors";

describe("domain errors", () => {
	it("keeps safe authorization failures machine-readable", () => {
		expect(forbidden("Access denied")).toMatchObject({
			code: "forbidden",
			message: "Access denied",
		});
		expect(unauthorized("Sign in")).toBeInstanceOf(DomainError);
	});
});

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

	it("protects an organisation owner from role changes", () => {
		expect(canUpdateOrganizationMemberRole("owner")).toBe(false);
		expect(canUpdateOrganizationMemberRole("admin")).toBe(true);
	});
});
