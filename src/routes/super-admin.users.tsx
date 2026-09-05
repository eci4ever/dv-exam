import { createFileRoute, redirect } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { DashboardShell } from "#/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { getSession } from "#/lib/auth.functions";
import { getSuperAdminOverview } from "#/lib/super-admin.functions";

export const Route = createFileRoute("/super-admin/users")({
	beforeLoad: async () => {
		const session = await getSession();
		if (!session) throw redirect({ to: "/login" });
		if (session.user.role !== "admin") throw redirect({ to: "/dashboard" });
		return { user: session.user };
	},
	loader: () => getSuperAdminOverview(),
	component: UsersPage,
});

function UsersPage() {
	const { user } = Route.useRouteContext();
	const { users } = Route.useLoaderData();
	return (
		<DashboardShell pageTitle="Platform users" user={user}>
			<div className="mx-auto w-full max-w-7xl p-6">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Users className="size-5" /> Users
						</CardTitle>
					</CardHeader>
					<CardContent className="divide-y">
						{users.map((listedUser) => (
							<div
								className="flex justify-between py-3 text-sm"
								key={listedUser.id}
							>
								<span>
									{listedUser.name}
									<span className="ml-2 text-muted-foreground">
										{listedUser.email}
									</span>
								</span>
								<span>
									{listedUser.role === "admin"
										? "Platform admin"
										: listedUser.banned
											? "Suspended"
											: "Active"}
								</span>
							</div>
						))}
					</CardContent>
				</Card>
			</div>
		</DashboardShell>
	);
}
