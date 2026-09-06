import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Building2, UserCog } from "lucide-react";
import { useState } from "react";
import { DashboardShell } from "#/components/dashboard-shell";
import { ReasonDialog } from "#/components/reason-dialog";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { getSession } from "#/lib/auth.functions";
import {
	getPlatformOrganizations,
	setOrganizationOwner,
	updateOrganizationLifecycle,
	updatePlatformOrganization,
} from "#/lib/super-admin.functions";

export const Route = createFileRoute("/super-admin/organisations")({
	beforeLoad: async () => {
		const session = await getSession();
		if (!session) throw redirect({ to: "/login" });
		if (session.user.role !== "admin") throw redirect({ to: "/dashboard" });
		return { user: session.user };
	},
	loader: () => getPlatformOrganizations(),
	component: OrganisationsPage,
});
function OrganisationsPage() {
	const { user } = Route.useRouteContext();
	const initial = Route.useLoaderData() as {
		organizations: any[];
		hasMore: boolean;
	};
	const router = useRouter();
	const lifecycle = useServerFn(updateOrganizationLifecycle);
	const update = useServerFn(updatePlatformOrganization);
	const owner = useServerFn(setOrganizationOwner);
	const getOrganizations = useServerFn(getPlatformOrganizations);
	const [organizations, setOrganizations] = useState(initial.organizations);
	const [hasMore, setHasMore] = useState(initial.hasMore);
	const [offset, setOffset] = useState(0);
	const [notice, setNotice] = useState("");
	async function loadOrganizations(nextOffset: number) {
		const result = (await getOrganizations({
			data: { offset: nextOffset },
		})) as { organizations: any[]; hasMore: boolean };
		setOrganizations(result.organizations);
		setHasMore(result.hasMore);
		setOffset(nextOffset);
	}
	async function run(action: () => Promise<unknown>, success: string) {
		try {
			await action();
			setNotice(success);
			await router.invalidate({ sync: true });
			await loadOrganizations(offset);
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Action failed.");
		}
	}
	return (
		<DashboardShell user={user} pageTitle="Platform organisations">
			<div className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
				<section>
					<p className="text-sm text-muted-foreground">
						Platform administration
					</p>
					<h1 className="mt-1 text-2xl font-semibold">Organisations</h1>
				</section>
				{notice ? (
					<p className="rounded-md border p-3 text-sm">{notice}</p>
				) : null}
				<Card>
					<CardContent className="divide-y p-0">
						{organizations.map((organization) => (
							<div
								className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center"
								key={organization.id}
							>
								<div className="grid size-10 place-items-center rounded-md bg-muted">
									<Building2 className="size-5" />
								</div>
								<div className="min-w-0 flex-1">
									<p className="font-medium">{organization.name}</p>
									<p className="text-sm text-muted-foreground">
										/{organization.slug} · {organization.memberCount} members ·
										Owner: {organization.ownerName ?? "Unassigned"}
									</p>
								</div>
								<Badge
									variant={
										organization.status === "active"
											? "outline"
											: organization.status === "suspended"
												? "destructive"
												: "secondary"
									}
								>
									{organization.status}
								</Badge>
								<div className="flex flex-wrap gap-2">
									<ReasonDialog
										confirmLabel="Save name"
										description="Rename this organisation and record the reason."
										onConfirm={(reason) => {
											const name = window.prompt(
												"Organisation name",
												organization.name,
											);
											return name
												? run(
														() =>
															update({
																data: {
																	organizationId: organization.id,
																	name,
																	reason,
																},
															}),
														"Organisation updated. Audit record created.",
													)
												: Promise.resolve();
										}}
										title="Rename organisation"
										trigger={
											<Button size="sm" variant="outline">
												Edit
											</Button>
										}
									/>
									<ReasonDialog
										confirmLabel="Set owner"
										description="The user must already have a registered account."
										onConfirm={(reason) => {
											const email = window.prompt("Registered user email");
											return email
												? run(
														() =>
															owner({
																data: {
																	organizationId: organization.id,
																	email,
																	reason,
																},
															}),
														"Owner assigned. Audit record created.",
													)
												: Promise.resolve();
										}}
										title="Transfer ownership"
										trigger={
											<Button size="sm" variant="outline">
												<UserCog /> Owner
											</Button>
										}
									/>
									{organization.status === "active" ? (
										<ReasonDialog
											confirmLabel="Suspend"
											description="Suspended organisations cannot operate examinations."
											onConfirm={(reason) =>
												run(
													() =>
														lifecycle({
															data: {
																organizationId: organization.id,
																action: "suspend",
																reason,
															},
														}),
													"Organisation suspended. Audit record created.",
												)
											}
											title="Suspend organisation"
											trigger={
												<Button size="sm" variant="destructive">
													Suspend
												</Button>
											}
										/>
									) : (
										<ReasonDialog
											confirmLabel="Reactivate"
											description="This restores operational access."
											onConfirm={(reason) =>
												run(
													() =>
														lifecycle({
															data: {
																organizationId: organization.id,
																action: "reactivate",
																reason,
															},
														}),
													"Organisation reactivated. Audit record created.",
												)
											}
											title="Reactivate organisation"
											trigger={<Button size="sm">Reactivate</Button>}
										/>
									)}
									{organization.status === "archived" ? (
										<ReasonDialog
											confirmLabel="Restore"
											description="This restores the archived organisation."
											onConfirm={(reason) =>
												run(
													() =>
														lifecycle({
															data: {
																organizationId: organization.id,
																action: "restore",
																reason,
															},
														}),
													"Organisation restored. Audit record created.",
												)
											}
											title="Restore organisation"
											trigger={
												<Button size="sm" variant="outline">
													Restore
												</Button>
											}
										/>
									) : (
										<ReasonDialog
											confirmLabel="Archive"
											description="Archive preserves all organisation and membership history."
											onConfirm={(reason) =>
												run(
													() =>
														lifecycle({
															data: {
																organizationId: organization.id,
																action: "archive",
																reason,
															},
														}),
													"Organisation archived. Audit record created.",
												)
											}
											title="Archive organisation"
											trigger={
												<Button size="sm" variant="outline">
													Archive
												</Button>
											}
										/>
									)}
								</div>
							</div>
						))}
					</CardContent>
				</Card>
				<div className="flex items-center justify-between gap-3">
					<Button
						disabled={offset === 0}
						onClick={() => void loadOrganizations(Math.max(0, offset - 50))}
						type="button"
						variant="outline"
					>
						Previous
					</Button>
					<Button
						disabled={!hasMore}
						onClick={() => void loadOrganizations(offset + 50)}
						type="button"
						variant="outline"
					>
						Next
					</Button>
				</div>
			</div>
		</DashboardShell>
	);
}
