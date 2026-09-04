import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { admin, organization } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";

export function getAuth() {
	return betterAuth({
		baseURL: env.BETTER_AUTH_URL,
		database: env.DB,
		secret: env.BETTER_AUTH_SECRET,
		emailAndPassword: { enabled: true },
		user: { changeEmail: { enabled: true } },
		emailVerification: {
			sendOnSignUp: true,
			async sendVerificationEmail({ user, url }) {
				const response = await fetch("https://api.resend.com/emails", {
					method: "POST",
					headers: {
						Authorization: `Bearer ${env.RESEND_API_KEY}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						from: env.EMAIL_FROM,
						to: [user.email],
						reply_to: env.EMAIL_REPLY_TO,
						subject: `Sahkan e-mel anda untuk ${env.EMAIL_BRAND_NAME}`,
						html: `<p>Hai ${escapeHtml(user.name)},</p><p>Sahkan alamat e-mel anda untuk meneruskan penggunaan ${escapeHtml(env.EMAIL_BRAND_NAME)}.</p><p><a href="${url}">Sahkan e-mel saya</a></p><p>Pautan ini tamat dalam satu jam.</p>`,
						text: `Hai ${user.name}, sahkan e-mel anda: ${url}`,
					}),
				});
				if (!response.ok)
					throw new Error("E-mel verifikasi tidak dapat dihantar.");
			},
		},
		plugins: [
			admin(),
			organization({
				allowUserToCreateOrganization: false,
				requireEmailVerificationOnInvitation: true,
				async sendInvitationEmail(data) {
					const invitationUrl = new URL("/invitations", env.BETTER_AUTH_URL);
					invitationUrl.searchParams.set("id", data.id);
					await sendEmail({
						to: data.email,
						subject: `Jemputan menyertai ${data.organization.name}`,
						html: `<p>Hai,</p><p>${escapeHtml(data.inviter.user.name)} menjemput anda menyertai <strong>${escapeHtml(data.organization.name)}</strong> sebagai ${roleLabel(data.role)}.</p><p><a href="${invitationUrl.toString()}">Lihat dan terima jemputan</a></p><p>Jemputan ini sah selama 48 jam.</p>`,
						text: `${data.inviter.user.name} menjemput anda menyertai ${data.organization.name}. Terima jemputan: ${invitationUrl.toString()}`,
					});
				},
			}),
			tanstackStartCookies(),
		],
	});
}

async function sendEmail({
	to,
	subject,
	html,
	text,
}: {
	to: string;
	subject: string;
	html: string;
	text: string;
}) {
	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${env.RESEND_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from: env.EMAIL_FROM,
			to: [to],
			reply_to: env.EMAIL_REPLY_TO,
			subject,
			html,
			text,
		}),
	});
	if (!response.ok) throw new Error("E-mel tidak dapat dihantar.");
}

function roleLabel(role: string) {
	if (role === "owner") return "pemilik organisasi";
	if (role === "admin") return "pentadbir organisasi";
	return "ahli organisasi";
}

function escapeHtml(value: string) {
	return value.replace(
		/[&<>'"]/g,
		(character) =>
			({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				"'": "&#39;",
				'"': "&quot;",
			})[character] ?? character,
	);
}
