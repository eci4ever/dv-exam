import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";

export function getAuth() {
	return betterAuth({
		database: env.DB,
		secret: env.BETTER_AUTH_SECRET,
		emailAndPassword: { enabled: true },
		plugins: [tanstackStartCookies()],
	});
}
