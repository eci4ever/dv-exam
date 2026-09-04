import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSession } from "#/lib/auth.functions";

export const Route = createFileRoute("/invitations")({
	validateSearch: (search: Record<string, unknown>) => ({
		id: typeof search.id === "string" ? search.id : "",
	}),
	beforeLoad: async ({ location }) => {
		const session = await getSession();
		if (!session) {
			throw redirect({
				to: "/login",
				search: { redirect: location.href },
			});
		}
		throw redirect({ to: "/organizations" });
	},
});
