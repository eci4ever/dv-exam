import { describe, expect, it } from "vitest";

import {
	assertWorkspaceDeletionAllowed,
	canDeleteWorkspace,
	canManageWorkspace,
	getUsageHealth,
	workspaceAudience,
} from "./workspace-governance-policy";

describe("workspace governance policy", () => {
	it("classifies usage health at 80 and 100 percent", () => {
		expect(getUsageHealth({ usage: [{ used: 7, limit: 10 }] })).toBe("healthy");
		expect(getUsageHealth({ usage: [{ used: 8, limit: 10 }] })).toBe(
			"near_limit",
		);
		expect(getUsageHealth({ usage: [{ used: 10, limit: 10 }] })).toBe(
			"at_limit",
		);
		expect(
			getUsageHealth({ status: "suspended", usage: [{ used: 0, limit: 10 }] }),
		).toBe("suspended");
	});

	it("maps workspace roles to their audience and permissions", () => {
		expect(workspaceAudience("owner")).toBe("manager");
		expect(workspaceAudience("admin")).toBe("manager");
		expect(workspaceAudience("teacher")).toBe("teacher");
		expect(workspaceAudience("student")).toBe("student");
		expect(canManageWorkspace("admin")).toBe(true);
		expect(canManageWorkspace("teacher")).toBe(false);
		expect(canDeleteWorkspace("owner")).toBe(true);
		expect(canDeleteWorkspace("admin")).toBe(false);
	});

	it("blocks deletion while delivery work is active", () => {
		expect(() =>
			assertWorkspaceDeletionAllowed({
				scheduledOrOpenSchedules: 1,
				inProgressAttempts: 0,
			}),
		).toThrow(/schedules/i);
		expect(() =>
			assertWorkspaceDeletionAllowed({
				scheduledOrOpenSchedules: 0,
				inProgressAttempts: 1,
			}),
		).toThrow(/attempts/i);
	});
});
