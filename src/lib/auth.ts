import { env } from "cloudflare:workers";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { admin, organization } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
	baseURL: env.BETTER_AUTH_URL,
	database: drizzleAdapter(db, {
		camelCase: true,
		provider: "sqlite",
		schema,
	}),
	secret: env.BETTER_AUTH_SECRET,
	emailAndPassword: {
		enabled: true,
	},
	databaseHooks: {
		user: {
			create: {
				after: async (createdUser) => {
					const firstUser = db
						.select({ id: schema.user.id })
						.from(schema.user)
						.orderBy(sql`rowid`)
						.limit(1);

					await db
						.update(schema.user)
						.set({ role: "admin" })
						.where(
							and(
								eq(schema.user.id, createdUser.id),
								inArray(schema.user.id, firstUser),
							),
						);
				},
			},
		},
	},
	plugins: [
		admin(),
		organization({
			organizationLimit: 1,
		}),
		tanstackStartCookies(),
	],
});
