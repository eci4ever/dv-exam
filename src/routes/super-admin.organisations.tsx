import { createFileRoute, redirect } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { DashboardShell } from "#/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { getSession } from "#/lib/auth.functions";
import { getSuperAdminOverview } from "#/lib/super-admin.functions";

export const Route = createFileRoute("/super-admin/organisations")({
	beforeLoad: async () => {
		const session = await getSession();
		if (!session) throw redirect({ to: "/login" });
		if (session.user.role !== "admin") throw redirect({ to: "/dashboard" });
		return { user: session.user };
	},
	loader: () => getSuperAdminOverview(),
	component: OrganisationsPage,
});

function OrganisationsPage() {
	const { user } = Route.useRouteContext();
	const { organizations } = Route.useLoaderData();
	return (
		<DashboardShell pageTitle="Platform organisations" user={user}>
			<div className="mx-auto w-full max-w-7xl p-6">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Building2 className="size-5" /> Organisations
						</CardTitle>
					</CardHeader>
					<CardContent className="divide-y">
						{organizations.map((organization) => (
							<div
								className="flex justify-between py-3 text-sm"
								key={organization.id}
							>
								<span>
									{organization.name}
									<span className="ml-2 text-muted-foreground">
										{organization.slug}
									</span>
								</span>
								<span>
									{organization.memberCount} members ·{" "}
									{organization.ownerName ?? "No owner"}
								</span>
							</div>
						))}
					</CardContent>
				</Card>
			</div>
		</DashboardShell>
	);
}
