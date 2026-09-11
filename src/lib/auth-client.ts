import { adminClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import {
	organizationAccessControl,
	organizationRoles,
} from "@/lib/organization-permissions";

export const authClient = createAuthClient({
	baseURL:
		typeof window === "undefined"
			? "http://localhost:3003/api/auth"
			: new URL("/api/auth", window.location.origin).toString(),
	plugins: [
		adminClient(),
		organizationClient({
			ac: organizationAccessControl,
			roles: organizationRoles,
		}),
	],
});
