import { describe, expect, it } from "vitest";
import {
	inviteOrganizationMemberSchema,
	respondToOrganizationInvitationSchema,
} from "./organization";

describe("organization input", () => {
	it("normalizes a valid member invitation", () => {
		expect(
			inviteOrganizationMemberSchema.parse({
				organizationId: "org_123",
				email: "  Candidate@Example.com ",
				role: "member",
			}),
		).toEqual({
			organizationId: "org_123",
			email: "candidate@example.com",
			role: "member",
		});
	});

	it("rejects an owner invitation", () => {
		expect(() =>
			inviteOrganizationMemberSchema.parse({
				organizationId: "org_123",
				email: "candidate@example.com",
				role: "owner",
			}),
		).toThrow();
	});

	it("accepts only a valid invitation response", () => {
		expect(
			respondToOrganizationInvitationSchema.parse({
				invitationId: "invite_123",
				response: "accept",
			}),
		).toEqual({ invitationId: "invite_123", response: "accept" });
	});
});
