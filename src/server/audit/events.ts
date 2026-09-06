export type AuditEventInput = {
	action: string;
	actorUserId: string;
	metadata?: Record<string, unknown>;
	reason: string;
	targetId: string | null;
	targetType: string;
};

export function buildAuditEvent(
	input: AuditEventInput,
	id: string,
	createdAt: number,
) {
	return {
		id,
		actorUserId: input.actorUserId,
		action: input.action,
		targetType: input.targetType,
		targetId: input.targetId,
		reason: input.reason,
		outcome: "success",
		metadata: JSON.stringify(input.metadata ?? {}),
		createdAt,
	};
}
