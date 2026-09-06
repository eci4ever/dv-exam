import { env } from "cloudflare:workers";
import { buildAuditEvent, type AuditEventInput } from "./events";

export async function writeAuditEvent(input: AuditEventInput) {
	const event = buildAuditEvent(input, crypto.randomUUID(), Date.now());
	await env.DB.prepare(
		"INSERT INTO platform_audit_log (id, actorUserId, action, targetType, targetId, reason, outcome, metadata, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
	)
		.bind(
			event.id,
			event.actorUserId,
			event.action,
			event.targetType,
			event.targetId,
			event.reason,
			event.outcome,
			event.metadata,
			event.createdAt,
		)
		.run();
	return event;
}
