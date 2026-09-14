import { createServerFn } from "@tanstack/react-start";
import {
	validateAccountDeletion,
	validateDisplayName,
	validatePasswordChange,
} from "@/lib/account-policy";
import { auth } from "@/lib/auth";
import { auditForSession, requireAccountSession } from "@/lib/platform-core";

function objectInput(value: unknown) {
	if (!value || typeof value !== "object") throw new Error("Invalid request.");
	return value as Record<string, unknown>;
}

function stringInput(value: unknown, message: string) {
	if (typeof value !== "string") throw new Error(message);
	return value;
}

export const getAccountSessions = createServerFn({ method: "GET" }).handler(
	async () => {
		const { headers, session } = await requireAccountSession();
		const sessions = await auth.api.listSessions({ headers });
		return {
			currentSessionId: session.session.id,
			sessions: sessions.map((item) => ({
				id: item.id,
				token: item.token,
				createdAt: item.createdAt,
				expiresAt: item.expiresAt,
				userAgent: item.userAgent ?? null,
			})),
		};
	},
);

export const updateAccountProfile = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = objectInput(value);
		return {
			name: validateDisplayName(stringInput(input.name, "Name is required.")),
		};
	})
	.handler(async ({ data }) => {
		const { headers, session } = await requireAccountSession({
			writable: true,
		});
		await auth.api.updateUser({ headers, body: { name: data.name } });
		await auditForSession(session, {
			category: "user",
			type: "account.profile-updated",
			targetType: "user",
			targetId: session.user.id,
		});
		return { name: data.name };
	});

export const changeAccountPassword = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = objectInput(value);
		if (typeof input.currentPassword !== "string")
			throw new Error("Enter your current password.");
		return {
			currentPassword: input.currentPassword,
			newPassword: validatePasswordChange({
				password: stringInput(input.newPassword, "Enter a new password."),
				confirmation: stringInput(
					input.confirmPassword,
					"Confirm your new password.",
				),
			}),
		};
	})
	.handler(async ({ data }) => {
		const { headers, session } = await requireAccountSession({
			writable: true,
		});
		await auth.api.changePassword({
			headers,
			body: {
				currentPassword: data.currentPassword,
				newPassword: data.newPassword,
				revokeOtherSessions: true,
			},
		});
		await auditForSession(session, {
			category: "security",
			type: "account.password-changed",
			targetType: "user",
			targetId: session.user.id,
		});
		return { success: true };
	});

export const revokeAccountSession = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = objectInput(value);
		if (typeof input.token !== "string" || !input.token)
			throw new Error("Session not found.");
		return { token: input.token };
	})
	.handler(async ({ data }) => {
		const { headers, session } = await requireAccountSession({
			writable: true,
		});
		if (data.token === session.session.token)
			throw new Error("The current session cannot be revoked here.");
		await auth.api.revokeSession({ headers, body: { token: data.token } });
		await auditForSession(session, {
			category: "security",
			type: "account.session-revoked",
			targetType: "session",
		});
		return { success: true };
	});

export const revokeOtherAccountSessions = createServerFn({
	method: "POST",
}).handler(async () => {
	const { headers, session } = await requireAccountSession({ writable: true });
	await auth.api.revokeOtherSessions({ headers });
	await auditForSession(session, {
		category: "security",
		type: "account.other-sessions-revoked",
		targetType: "user",
		targetId: session.user.id,
	});
	return { success: true };
});

export const deleteOwnAccount = createServerFn({ method: "POST" })
	.validator((value: unknown) => {
		const input = objectInput(value);
		return validateAccountDeletion({
			confirmation: stringInput(
				input.confirmation,
				'Type "DELETE" to confirm account deletion.',
			),
			password: stringInput(input.password, "Enter your current password."),
		});
	})
	.handler(async ({ data }) => {
		const { headers, session } = await requireAccountSession({
			writable: true,
		});
		await auth.api.deleteUser({ headers, body: { password: data.password } });
		await auditForSession(session, {
			category: "security",
			type: "account.deleted",
			targetType: "user",
			targetId: session.user.id,
		});
		return { success: true };
	});
