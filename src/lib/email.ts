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

async function deliverWorkspaceInvitation(input: {
	email: string;
	invitationId: string;
	inviterName: string;
	organizationName: string;
	role: string;
}) {
	const runtimeEnv = env as Cloudflare.Env & { RESEND_FROM_EMAIL?: string };
	const from = runtimeEnv.RESEND_FROM_EMAIL ?? runtimeEnv.EMAIL_FROM;
	if (!env.RESEND_API_KEY || !from)
		throw new Error("Invitation email delivery is not configured.");
	const resend = new Resend(env.RESEND_API_KEY);
	const url = `${env.BETTER_AUTH_URL.replace(/\/$/, "")}/invitations/${encodeURIComponent(input.invitationId)}`;
	const safeUrl = escapeHtml(url);
	const safeInviter = escapeHtml(input.inviterName);
	const safeOrganization = escapeHtml(input.organizationName);
	const safeRole = escapeHtml(input.role);
	const result = await resend.emails.send(
		{
			from,
			to: input.email,
			subject: `You're invited to ${input.organizationName} on DV-EXAM`,
			html: `<p>${safeInviter} invited you to join <strong>${safeOrganization}</strong> as ${safeRole}.</p><p><a href="${safeUrl}">Review invitation</a></p><p>This invitation expires in seven days.</p>`,
			text: `${input.inviterName} invited you to join ${input.organizationName} as ${input.role}.\n\nReview invitation: ${url}\n\nThis invitation expires in seven days.`,
		},
		{
			idempotencyKey: `workspace-invitation/${await digestToken(input.invitationId)}`,
		},
	);
	if (result.error) throw new Error(result.error.name);
}

export function queueWorkspaceInvitationEmail(input: {
	email: string;
	invitationId: string;
	inviterName: string;
	organizationName: string;
	role: string;
	organizationId: string;
	inviterId: string;
}) {
	waitUntil(
		deliverWorkspaceInvitation(input).catch(async (error) => {
			await writeAuditEvent({
				category: "organization",
				type: "workspace.invitation-delivery",
				result: "failure",
				actorUserId: input.inviterId,
				effectiveUserId: input.inviterId,
				targetType: "organization",
				targetId: input.organizationId,
				organizationId: input.organizationId,
				metadata: {
					provider: "resend",
					error: error instanceof Error ? error.name : "UnknownError",
				},
			});
		}),
	);
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
