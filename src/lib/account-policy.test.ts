import { describe, expect, it } from "vitest";

import {
	validateAccountDeletion,
	validateDisplayName,
	validatePasswordChange,
} from "@/lib/account-policy";

describe("account policy", () => {
	it("accepts matching passwords within Better Auth limits", () => {
		expect(
			validatePasswordChange({
				password: "correct-horse-battery-staple",
				confirmation: "correct-horse-battery-staple",
			}),
		).toBe("correct-horse-battery-staple");
	});

	it("rejects short, long, and mismatched passwords", () => {
		expect(() =>
			validatePasswordChange({ password: "short", confirmation: "short" }),
		).toThrow("Password must be between 8 and 128 characters.");
		expect(() =>
			validatePasswordChange({
				password: "a".repeat(129),
				confirmation: "a".repeat(129),
			}),
		).toThrow("Password must be between 8 and 128 characters.");
		expect(() =>
			validatePasswordChange({
				password: "password-one",
				confirmation: "password-two",
			}),
		).toThrow("Passwords do not match.");
	});

	it("normalizes a valid display name and rejects invalid lengths", () => {
		expect(validateDisplayName("  DV-EXAM Learner  ")).toBe("DV-EXAM Learner");
		expect(() => validateDisplayName("A")).toThrow(
			"Name must be between 2 and 80 characters.",
		);
		expect(() => validateDisplayName("A".repeat(81))).toThrow(
			"Name must be between 2 and 80 characters.",
		);
	});

	it("requires the exact delete confirmation and current password", () => {
		expect(() =>
			validateAccountDeletion({
				confirmation: "delete",
				password: "validpass",
			}),
		).toThrow('Type "DELETE" to confirm account deletion.');
		expect(() =>
			validateAccountDeletion({ confirmation: "DELETE", password: "" }),
		).toThrow("Enter your current password.");
		expect(
			validateAccountDeletion({
				confirmation: "DELETE",
				password: "validpass",
			}),
		).toEqual({ password: "validpass" });
	});
});
