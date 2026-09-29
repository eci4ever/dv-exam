import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { MailPlusIcon, UsersRoundIcon } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getDashboardSession } from "@/lib/session";
import { InvitationsContent } from "@/routes/workspace/invitations";
import { MembersContent } from "@/routes/workspace/members";

type PeopleTab = "members" | "invitations";

export const Route = createFileRoute("/workspace/people")({
	validateSearch: (search: Record<string, unknown>): { tab: PeopleTab } => ({
		tab: search.tab === "invitations" ? "invitations" : "members",
	}),
	beforeLoad: async () => {
		const data = await getDashboardSession();
		if (!data) throw redirect({ to: "/login" });
		if (
			!data.organizationRole
				?.split(",")
				.some((role) => role === "owner" || role === "admin") ||
			data.entitlement?.status === "suspended"
		)
			throw redirect({ to: "/dashboard" });
		return data;
	},
	component: PeoplePage,
});

function PeoplePage() {
	const data = Route.useRouteContext();
	const { tab } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });

	return (
		<WorkspaceShell data={data} activeItem="workspace-people" title="People">
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight">People</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							Manage workspace members and invitations.
						</p>
					</div>
					<Tabs
						value={tab}
						onValueChange={(value) =>
							void navigate({ search: { tab: value as PeopleTab } })
						}
						className="gap-5"
					>
						<TabsList variant="line" className="w-full justify-start">
							<TabsTrigger value="members">
								<UsersRoundIcon /> Members
							</TabsTrigger>
							<TabsTrigger value="invitations">
								<MailPlusIcon /> Invitations
							</TabsTrigger>
						</TabsList>
						<TabsContent value="members">
							<MembersContent embedded />
						</TabsContent>
						<TabsContent value="invitations">
							<InvitationsContent embedded />
						</TabsContent>
					</Tabs>
				</div>
			</main>
		</WorkspaceShell>
	);
}
