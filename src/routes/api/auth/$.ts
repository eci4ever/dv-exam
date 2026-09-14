import { createFileRoute } from "@tanstack/react-router";

import { auth } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/platform-data";

async function fingerprint(value: string) {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(value.trim().toLowerCase()),
	);
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

async function handleAuth(request: Request) {
	const path = new URL(request.url).pathname.replace(/^\/api\/auth/, "");
	const auditedSessionPaths = new Set([
		"/sign-out",
		"/admin/stop-impersonating",
	]);
	const beforeSession = auditedSessionPaths.has(path)
		? await auth.api.getSession({ headers: request.headers })
		: null;
	let signInEmail: string | null = null;
	if (path === "/sign-in/email" || path === "/request-password-reset") {
		try {
			const body = await request.clone().json<{ email?: unknown }>();
			signInEmail = typeof body.email === "string" ? body.email : null;
		} catch {
			signInEmail = null;
		}
	}
	const response = await auth.handler(request);
	try {
		if (path === "/sign-in/email" && !response.ok) {
			await writeAuditEvent({
				category: "auth",
				type: "auth.sign-in",
				result: "failure",
				userAgent: request.headers.get("user-agent"),
				metadata: signInEmail
					? { emailFingerprint: await fingerprint(signInEmail) }
					: {},
			});
		}
		if (path === "/request-password-reset") {
			await writeAuditEvent({
				category: "auth",
				type: "auth.password-reset-requested",
				result: response.ok ? "success" : "failure",
				userAgent: request.headers.get("user-agent"),
				metadata: signInEmail
					? { emailFingerprint: await fingerprint(signInEmail) }
					: {},
			});
		}
		if (path === "/reset-password") {
			await writeAuditEvent({
				category: "auth",
				type: "auth.password-reset",
				result: response.ok ? "success" : "failure",
				userAgent: request.headers.get("user-agent"),
			});
		}
		if (response.ok && beforeSession && path === "/sign-out") {
			await writeAuditEvent({
				category: "auth",
				type: "auth.sign-out",
				actorUserId: beforeSession.user.id,
				effectiveUserId: beforeSession.user.id,
				sessionId: beforeSession.session.id,
				userAgent: request.headers.get("user-agent"),
			});
		}
		if (response.ok && beforeSession && path === "/admin/stop-impersonating") {
			await writeAuditEvent({
				category: "security",
				type: "user.impersonation-stopped",
				actorUserId:
					beforeSession.session.impersonatedBy ?? beforeSession.user.id,
				effectiveUserId: beforeSession.user.id,
				sessionId: beforeSession.session.id,
				userAgent: request.headers.get("user-agent"),
			});
		}
	} catch (error) {
		console.error(
			JSON.stringify({
				message: "auth audit failed",
				error: error instanceof Error ? error.message : String(error),
			}),
		);
	}
	return response;
}

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: ({ request }) => handleAuth(request),
			POST: ({ request }) => handleAuth(request),
		},
	},
});
