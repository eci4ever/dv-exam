import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { auth } from "@/lib/auth";

function hasAdminRole(role?: string | null) {
	return role?.split(",").includes("admin") ?? false;
}

export const getAdminUsers = createServerFn({ method: "GET" }).handler(
	async () => {
		const headers = getRequestHeaders();
		const session = await auth.api.getSession({ headers });

		if (!session || !hasAdminRole(session.user.role)) {
			throw new Error("Administrator access is required.");
		}

		return auth.api.listUsers({
			headers,
			query: {
				limit: 50,
				sortBy: "createdAt",
				sortDirection: "desc",
			},
		});
	},
);
