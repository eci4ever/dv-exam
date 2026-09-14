import { describe, expect, it } from "vitest";

import {
	assertLastActiveAdminSafe,
	assertOrganizationAccessible,
	assertPlanLimitReductionSafe,
	assertPublicSignupEnabled,
	assertUserHasNoOwnedOrganizations,
	assertWritableSession,
	getUsageState,
	mapAuditIdentity,
	sanitizeAuditMetadata,
} from "@/lib/platform-policy";

describe("platform policy", () => {
	it("protects the last active platform admin from demotion, ban, or deletion", () => {
		for (const action of ["demote", "ban", "delete"] as const) {
			expect(() =>
				assertLastActiveAdminSafe({
					action,
					targetIsActiveAdmin: true,
					activeAdminCount: 1,
				}),
			).toThrow("The last active platform admin cannot be changed.");
		}
	});

	it("blocks user deletion while the user owns an organization", () => {
		expect(() => assertUserHasNoOwnedOrganizations(1)).toThrow(
			"Transfer organization ownership before deleting this user.",
		);
		expect(() => assertUserHasNoOwnedOrganizations(0)).not.toThrow();
	});

	it("makes impersonation a read-only support mode", () => {
		expect(() => assertWritableSession("admin-user-id")).toThrow(
			"Return to admin to make changes.",
		);
		expect(() => assertWritableSession(null)).not.toThrow();
	});

	it("blocks product access to a suspended organization", () => {
		expect(() => assertOrganizationAccessible("suspended")).toThrow(
			"This workspace is suspended. Contact platform support.",
		);
		expect(() => assertOrganizationAccessible("active")).not.toThrow();
	});

	it("enforces member limits and warns from eighty percent", () => {
		expect(getUsageState(7, 10)).toBe("ok");
		expect(getUsageState(8, 10)).toBe("warning");
		expect(getUsageState(10, 10)).toBe("limit");
		expect(() => assertPlanLimitReductionSafe(9, 10, "members")).toThrow(
			"Members limit cannot be lower than current usage (10).",
		);
		expect(() => assertPlanLimitReductionSafe(10, 10, "members")).not.toThrow();
	});

	it("closes public signup without blocking admin-created users", () => {
		expect(() => assertPublicSignupEnabled(false, false)).toThrow(
			"Sign-ups are currently closed.",
		);
		expect(() => assertPublicSignupEnabled(false, true)).not.toThrow();
	});

	it("removes secrets and raw identity data from audit metadata", () => {
		expect(
			sanitizeAuditMetadata({
				action: "sign-in",
				password: "secret",
				token: "session-token",
				ipAddress: "203.0.113.1",
				email: "student@example.com",
				reason: "invalid credentials",
			}),
		).toEqual({ action: "sign-in", reason: "invalid credentials" });
	});

	it("records original and effective users during impersonation", () => {
		expect(
			mapAuditIdentity({ userId: "student", impersonatedBy: "admin" }),
		).toEqual({ actorUserId: "admin", effectiveUserId: "student" });
		expect(mapAuditIdentity({ userId: "admin", impersonatedBy: null })).toEqual(
			{
				actorUserId: "admin",
				effectiveUserId: "admin",
			},
		);
	});
});
