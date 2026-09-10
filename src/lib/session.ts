import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { auth } from "@/lib/auth";

export const getSession = createServerFn({ method: "GET" }).handler(async () =>
	auth.api.getSession({ headers: getRequestHeaders() }),
);

export const getDashboardSession = createServerFn({ method: "GET" }).handler(
	async () => {
		const headers = getRequestHeaders();
		const session = await auth.api.getSession({ headers });

		if (!session) {
			return null;
		}

		const organizations = await auth.api.listOrganizations({ headers });

		const organization = session.session.activeOrganizationId
			? await auth.api.getFullOrganization({
					headers,
					query: { organizationId: session.session.activeOrganizationId },
				})
			: null;

		return { session, organization, organizations };
	},
);
