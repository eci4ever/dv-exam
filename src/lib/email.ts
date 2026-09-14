import { env, waitUntil } from "cloudflare:workers";
import { Resend } from "resend";

import { writeAuditEvent } from "@/lib/platform-data";

function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

async function digestToken(token: string) {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(token),
	);
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

async function deliverPasswordReset(input: {
	email: string;
	name: string;
	url: string;
	token: string;
	userId: string;
}) {
	const runtimeEnv = env as Cloudflare.Env & { RESEND_FROM_EMAIL?: string };
	const from = runtimeEnv.RESEND_FROM_EMAIL ?? runtimeEnv.EMAIL_FROM;
	if (!env.RESEND_API_KEY || !from) {
		throw new Error("Password email delivery is not configured.");
	}
	const resend = new Resend(env.RESEND_API_KEY);
	const safeName = escapeHtml(input.name);
	const safeUrl = escapeHtml(input.url);
	const result = await resend.emails.send(
		{
			from,
			to: input.email,
			subject: "Reset your DV-EXAM password",
			html: `<p>Hello ${safeName},</p><p>We received a request to reset your DV-EXAM password.</p><p><a href="${safeUrl}">Reset your password</a></p><p>This link expires in one hour. If you did not request this, you can ignore this email.</p>`,
			text: `Hello ${input.name},\n\nWe received a request to reset your DV-EXAM password.\n\nReset your password: ${input.url}\n\nThis link expires in one hour. If you did not request this, you can ignore this email.`,
		},
		{ idempotencyKey: `password-reset/${await digestToken(input.token)}` },
	);
	if (result.error) throw new Error(result.error.name);
}

export function queuePasswordResetEmail(input: {
	email: string;
	name: string;
	url: string;
	token: string;
	userId: string;
}) {
	waitUntil(
		deliverPasswordReset(input).catch(async (error) => {
			await writeAuditEvent({
				category: "auth",
				type: "auth.password-reset-delivery",
				result: "failure",
				targetType: "user",
				targetId: input.userId,
				metadata: {
					provider: "resend",
					error: error instanceof Error ? error.name : "UnknownError",
				},
			});
		}),
	);
}
