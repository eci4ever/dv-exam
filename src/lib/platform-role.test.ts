import { describe, expect, it } from "vitest";

import { isPlatformAdmin } from "@/lib/platform-role";

describe("platform roles", () => {
	it("recognizes only the dedicated global platform admin role", () => {
		expect(isPlatformAdmin("platform_admin")).toBe(true);
		expect(isPlatformAdmin("user,platform_admin")).toBe(true);
		expect(isPlatformAdmin("admin")).toBe(false);
		expect(isPlatformAdmin("user")).toBe(false);
		expect(isPlatformAdmin(null)).toBe(false);
	});
});
