import { describe, expect, it } from "vitest";
import {
	platformAuditLogQuerySchema,
	platformUsersQuerySchema,
	updateOrganizationLifecycleSchema,
	updateUserAccessSchema,
} from "./super-admin";

describe("super admin input", () => {
	it("normalizes and validates a privileged user action", () => {
		expect(
			updateUserAccessSchema.parse({
				userId: " user_123 ",
				action: "ban",
				reason: "  Repeated policy violations.  ",
			}),
		).toEqual({
			userId: "user_123",
			action: "ban",
			reason: "Repeated policy violations.",
		});
	});

	it("rejects an unsupported organisation lifecycle action", () => {
		expect(() =>
			updateOrganizationLifecycleSchema.parse({
				organizationId: "org_123",
				action: "delete",
				reason: "No longer needed",
			}),
		).toThrow();
	});

	it("rejects inverted audit date ranges", () => {
		expect(() =>
			platformAuditLogQuerySchema.parse({ from: 200, to: 100 }),
		).toThrow();
	});

	it("applies safe defaults for audit pagination", () => {
		expect(platformAuditLogQuerySchema.parse({})).toMatchObject({
			limit: 50,
			offset: 0,
		});
	});

	it("rejects an oversized audit page", () => {
		expect(() => platformAuditLogQuerySchema.parse({ limit: 101 })).toThrow();
	});

	it("applies safe defaults for user pagination", () => {
		expect(platformUsersQuerySchema.parse({})).toMatchObject({
			limit: 50,
			offset: 0,
		});
	});
});
