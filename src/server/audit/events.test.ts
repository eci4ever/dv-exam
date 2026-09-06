import { describe, expect, it } from "vitest";
import { buildAuditEvent } from "./events";

describe("audit event", () => {
	it("builds an immutable examination event with context", () => {
		expect(
			buildAuditEvent(
				{
					actorUserId: "user_123",
					action: "examination.publish",
					targetType: "examination",
					targetId: "exam_123",
					reason: "Examination lifecycle action",
					metadata: { organizationId: "org_123" },
				},
				"audit_123",
				1_000,
			),
		).toEqual({
			id: "audit_123",
			actorUserId: "user_123",
			action: "examination.publish",
			targetType: "examination",
			targetId: "exam_123",
			reason: "Examination lifecycle action",
			outcome: "success",
			metadata: '{"organizationId":"org_123"}',
			createdAt: 1_000,
		});
	});
});
