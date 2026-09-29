import { describe, expect, it } from "vitest";

import { isPlatformAdmin, shouldGrantPlatformAdmin } from "@/lib/platform-role";

describe("platform roles", () => {
	it("recognizes only the dedicated global platform admin role", () => {
		expect(isPlatformAdmin("platform_admin")).toBe(true);
		expect(isPlatformAdmin("user,platform_admin")).toBe(true);
		expect(isPlatformAdmin("admin")).toBe(false);
		expect(isPlatformAdmin("user")).toBe(false);
		expect(isPlatformAdmin(null)).toBe(false);
	});

	it("grants platform admin to the first registered user", () => {
		expect(
			shouldGrantPlatformAdmin({
				userCount: 1,
				userEmail: "first@example.com",
			}),
		).toBe(true);
		expect(
			shouldGrantPlatformAdmin({
				userCount: 2,
				userEmail: "second@example.com",
			}),
		).toBe(false);
	});

	it("keeps the explicit bootstrap email as a recovery path", () => {
		expect(
			shouldGrantPlatformAdmin({
				userCount: 4,
				userEmail: "OWNER@example.com",
				bootstrapEmail: "owner@example.com",
			}),
		).toBe(true);
	});
});
