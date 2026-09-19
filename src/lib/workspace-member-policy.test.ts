import { describe, expect, it } from "vitest";
import {
	assertMemberCanBeManaged,
	assertSeatAvailable,
	assertWorkspaceManager,
} from "@/lib/workspace-member-policy";

describe("workspace member policy", () => {
	it("allows owners and admins to manage members", () => {
		expect(() => assertWorkspaceManager("owner")).not.toThrow();
		expect(() => assertWorkspaceManager("admin")).not.toThrow();
		expect(() => assertWorkspaceManager("teacher")).toThrow("manager access");
	});

	it("protects the owner and self-removal", () => {
		expect(() =>
			assertMemberCanBeManaged({
				actorUserId: "admin",
				actorRole: "admin",
				targetUserId: "owner",
				targetRole: "owner",
				action: "update",
			}),
		).toThrow("Transfer ownership");
		expect(() =>
			assertMemberCanBeManaged({
				actorUserId: "admin",
				actorRole: "admin",
				targetUserId: "admin",
				targetRole: "admin",
				action: "remove",
			}),
		).toThrow("cannot remove yourself");
	});

	it("allows only the owner to transfer ownership", () => {
		expect(() =>
			assertMemberCanBeManaged({
				actorUserId: "admin",
				actorRole: "admin",
				targetUserId: "teacher",
				targetRole: "teacher",
				action: "transfer",
			}),
		).toThrow("Only the workspace owner");
	});

	it("counts pending invitations as reserved seats", () => {
		expect(() =>
			assertSeatAvailable({ members: 8, pendingInvitations: 2, limit: 10 }),
		).toThrow("member limit");
		expect(() =>
			assertSeatAvailable({ members: 8, pendingInvitations: 1, limit: 10 }),
		).not.toThrow();
	});
});
