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
		const activeOrganizationId =
			session.session.activeOrganizationId ?? organizations[0]?.id;

		const organization = activeOrganizationId
			? await auth.api.getFullOrganization({
					headers,
					query: { organizationId: activeOrganizationId },
				})
			: null;
		const isOrganizationOwner =
			organization?.members.some(
				(member) =>
					member.userId === session.user.id &&
					member.role.split(",").includes("owner"),
			) ?? false;
		const organizationRole = organization?.members.find(
			(member) => member.userId === session.user.id,
		)?.role;

		return {
			session,
			organization,
			organizations,
			activeOrganizationId,
			isOrganizationOwner,
			organizationRole,
		};
	},
);
