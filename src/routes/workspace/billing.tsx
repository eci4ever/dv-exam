import { createFileRoute, redirect } from "@tanstack/react-router";

import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/workspace/billing")({
	beforeLoad: async () => {
		const dashboard = await getDashboardSession();
		if (!dashboard) throw redirect({ to: "/login" });
		if (!dashboard.organizationRole?.split(",").includes("owner")) {
			throw redirect({ to: "/workspace" });
		}
		throw redirect({ to: "/workspace/settings", search: { tab: "plan" } });
	},
});
