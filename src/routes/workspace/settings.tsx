import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import {
	ActivityIcon,
	CreditCardIcon,
	Settings2Icon,
	ShieldCheckIcon,
	Trash2Icon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspaceShell } from "@/components/workspace-shell";
import { authClient } from "@/lib/auth-client";
import { getDashboardSession } from "@/lib/session";
import {
	deleteWorkspace,
	getWorkspaceSettings,
	listWorkspaceActivity,
	updateWorkspaceIdentity,
} from "@/lib/workspace-governance";
import { canManageWorkspace } from "@/lib/workspace-governance-policy";

export const Route = createFileRoute("/workspace/settings")({
	beforeLoad: async () => {
		const dashboard = await getDashboardSession();
		if (!dashboard) throw redirect({ to: "/login" });
		if (!canManageWorkspace(dashboard.organizationRole))
			throw redirect({ to: "/dashboard" });
		return dashboard;
	},
	loader: () => getWorkspaceSettings(),
	component: WorkspaceSettings,
});

const roles = [
	["Owner", "Full access, ownership transfer, and workspace deletion."],
	["Admin", "Manage identity, members, classes, exams, and activity."],
	["Teacher", "Manage assigned classes, exams, schedules, and reports."],
	["Student", "Take assigned exams and view personal results."],
] as const;

function message(error: unknown) {
	return error instanceof Error
		? error.message
		: "Unable to complete this action.";
}

function WorkspaceSettings() {
	const shell = Route.useRouteContext();
	const initial = Route.useLoaderData();
	const router = useRouter();
	const [name, setName] = useState(initial.organization.name);
	const [slug, setSlug] = useState(initial.organization.slug);
	const [feedback, setFeedback] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const [search, setSearch] = useState("");
	const [category, setCategory] = useState("all");
	const [resultFilter, setResultFilter] = useState("all");
	const [page, setPage] = useState(1);
	const [activity, setActivity] = useState<Awaited<
		ReturnType<typeof listWorkspaceActivity>
	> | null>(null);
	const [confirmation, setConfirmation] = useState("");
	const [password, setPassword] = useState("");
	const impersonating = Boolean(shell.session.session.impersonatedBy);
	const readOnly = initial.status === "suspended" || impersonating;

	const loadActivity = useCallback(async () => {
		try {
			setActivity(
				await listWorkspaceActivity({
					data: { search, category, result: resultFilter, page },
				}),
			);
		} catch (error) {
			setFeedback(message(error));
		}
	}, [search, category, resultFilter, page]);

	useEffect(() => {
		const timer = window.setTimeout(() => void loadActivity(), 300);
		return () => window.clearTimeout(timer);
	}, [loadActivity]);

	async function saveIdentity() {
		setPending(true);
		setFeedback(null);
		try {
			await updateWorkspaceIdentity({ data: { name, slug } });
			setFeedback("Workspace identity updated.");
			await router.invalidate();
		} catch (error) {
			setFeedback(message(error));
		} finally {
			setPending(false);
		}
	}

	async function removeWorkspace() {
		setPending(true);
		setFeedback(null);
		try {
			const deleted = await deleteWorkspace({
				data: { confirmationName: confirmation, password },
			});
			if (deleted.nextOrganizationId) {
				await authClient.organization.setActive({
					organizationId: deleted.nextOrganizationId,
				});
				window.location.assign("/dashboard");
			} else window.location.assign("/");
		} catch (error) {
			setFeedback(message(error));
			setPending(false);
		}
	}

	return (
		<WorkspaceShell
			data={shell}
			activeItem="settings"
			title="Workspace settings"
		>
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
					<div className="flex items-start gap-3">
						<div className="flex size-10 items-center justify-center rounded-lg border bg-card">
							<Settings2Icon className="size-5" />
						</div>
						<div>
							<h1 className="text-2xl font-semibold tracking-tight">
								Workspace settings
							</h1>
							<p className="mt-1 text-sm text-muted-foreground">
								Manage identity, access policy, usage, and lifecycle.
							</p>
						</div>
					</div>
					{readOnly ? (
						<div className="rounded-xl border bg-muted p-4 text-sm">
							{impersonating
								? "Return to admin to make changes."
								: "This suspended workspace is available in read-only mode."}
						</div>
					) : null}
					{feedback ? <output className="text-sm">{feedback}</output> : null}

					<Tabs defaultValue="general" className="gap-5">
						<TabsList
							variant="line"
							className="w-full justify-start overflow-x-auto"
						>
							<TabsTrigger value="general">General</TabsTrigger>
							<TabsTrigger value="roles">
								<ShieldCheckIcon /> Roles &amp; Permissions
							</TabsTrigger>
							<TabsTrigger value="usage">
								<CreditCardIcon /> Plan &amp; Usage
							</TabsTrigger>
							<TabsTrigger value="activity">
								<ActivityIcon /> Activity
							</TabsTrigger>
							{initial.canDelete ? (
								<TabsTrigger value="danger">
									<Trash2Icon /> Danger Zone
								</TabsTrigger>
							) : null}
						</TabsList>

						<TabsContent value="general">
							<section className="space-y-5 rounded-xl border bg-card p-5 sm:p-6">
								<div>
									<h2 className="font-medium">Workspace identity</h2>
									<p className="text-sm text-muted-foreground">
										Shown to every member of this workspace.
									</p>
								</div>
								<div className="grid gap-4 sm:grid-cols-2">
									<label className="space-y-2 text-sm" htmlFor="workspace-name">
										<span className="font-medium">Name</span>
										<Input
											id="workspace-name"
											value={name}
											onValueChange={setName}
											disabled={readOnly}
										/>
									</label>
									<label className="space-y-2 text-sm" htmlFor="workspace-slug">
										<span className="font-medium">Slug</span>
										<Input
											id="workspace-slug"
											value={slug}
											onValueChange={setSlug}
											disabled={readOnly}
										/>
									</label>
								</div>
								<Button
									disabled={readOnly || pending}
									onClick={() => void saveIdentity()}
								>
									Save changes
								</Button>
							</section>
						</TabsContent>

						<TabsContent value="roles">
							<section className="divide-y overflow-hidden rounded-xl border bg-card">
								{roles.map(([role, description]) => (
									<div className="p-5" key={role}>
										<p className="font-medium">{role}</p>
										<p className="mt-1 text-sm text-muted-foreground">
											{description}
										</p>
									</div>
								))}
							</section>
						</TabsContent>

						<TabsContent value="usage">
							<section className="rounded-xl border bg-card p-5 sm:p-6">
								<div className="flex items-start justify-between gap-4">
									<div>
										<h2 className="font-medium">{initial.plan.name} plan</h2>
										<p className="text-sm text-muted-foreground">
											{initial.plan.description}
										</p>
									</div>
									<Badge
										variant={
											initial.usage.health === "at_limit"
												? "destructive"
												: "secondary"
										}
									>
										{initial.usage.health.replace("_", " ")}
									</Badge>
								</div>
								<div className="mt-6 grid gap-4 sm:grid-cols-3">
									{[
										["Members", initial.usage.members],
										["Active exams", initial.usage.activeExams],
										["Monthly attempts", initial.usage.monthlyAttempts],
									].map(([label, raw]) => {
										const usage = raw as { used: number; limit: number };
										return (
											<div
												className="rounded-lg border p-4"
												key={label as string}
											>
												<p className="text-sm text-muted-foreground">
													{label as string}
												</p>
												<p className="mt-2 text-2xl font-semibold">
													{usage.used}{" "}
													<span className="text-sm font-normal text-muted-foreground">
														/ {usage.limit}
													</span>
												</p>
											</div>
										);
									})}
								</div>
							</section>
						</TabsContent>

						<TabsContent value="activity">
							<section className="overflow-hidden rounded-xl border bg-card">
								<div className="grid gap-3 border-b p-4 sm:grid-cols-3">
									<Input
										placeholder="Search activity"
										value={search}
										onValueChange={(value) => {
											setSearch(value);
											setPage(1);
										}}
									/>
									<select
										className="h-8 rounded-lg border bg-transparent px-2 text-sm"
										value={category}
										onChange={(event) => {
											setCategory(event.target.value);
											setPage(1);
										}}
									>
										<option value="all">All categories</option>
										<option value="organization">Organization</option>
										<option value="security">Security</option>
										<option value="plan">Plan</option>
										<option value="user">User</option>
									</select>
									<select
										className="h-8 rounded-lg border bg-transparent px-2 text-sm"
										value={resultFilter}
										onChange={(event) => {
											setResultFilter(event.target.value);
											setPage(1);
										}}
									>
										<option value="all">All results</option>
										<option value="success">Success</option>
										<option value="failure">Failure</option>
									</select>
								</div>
								{activity?.rows.length ? (
									<div className="divide-y">
										{activity.rows.map((event) => (
											<div
												className="flex items-center justify-between gap-4 p-4 text-sm"
												key={event.id}
											>
												<div>
													<p className="font-medium">
														{event.type.replaceAll(".", " ")}
													</p>
													<p className="text-xs text-muted-foreground">
														{event.actorName ?? "System"} ·{" "}
														{new Date(event.createdAt).toLocaleString()}
													</p>
												</div>
												<Badge
													variant={
														event.result === "failure"
															? "destructive"
															: "secondary"
													}
												>
													{event.result}
												</Badge>
											</div>
										))}
									</div>
								) : (
									<p className="p-8 text-center text-sm text-muted-foreground">
										No workspace activity found.
									</p>
								)}
								<div className="flex items-center justify-between border-t p-4">
									<span className="text-sm text-muted-foreground">
										{activity?.total ?? 0} events
									</span>
									<div className="flex gap-2">
										<Button
											size="sm"
											variant="outline"
											disabled={page <= 1}
											onClick={() => setPage((value) => value - 1)}
										>
											Previous
										</Button>
										<Button
											size="sm"
											variant="outline"
											disabled={!activity || page >= activity.pageCount}
											onClick={() => setPage((value) => value + 1)}
										>
											Next
										</Button>
									</div>
								</div>
							</section>
						</TabsContent>

						{initial.canDelete ? (
							<TabsContent value="danger">
								<section className="rounded-xl border border-destructive/40 bg-card p-5 sm:p-6">
									<h2 className="font-medium">Delete workspace</h2>
									<p className="mt-1 text-sm text-muted-foreground">
										Permanently delete this workspace after all active delivery
										work has ended.
									</p>
									<AlertDialog>
										<AlertDialogTrigger
											render={
												<Button
													className="mt-5"
													variant="destructive"
													disabled={readOnly}
												/>
											}
										>
											<Trash2Icon /> Delete workspace
										</AlertDialogTrigger>
										<AlertDialogContent>
											<AlertDialogHeader>
												<AlertDialogTitle>
													Delete {initial.organization.name}?
												</AlertDialogTitle>
												<AlertDialogDescription>
													This permanently removes workspace data and cannot be
													undone.
												</AlertDialogDescription>
											</AlertDialogHeader>
											<div className="space-y-3">
												<label
													className="space-y-2 text-sm"
													htmlFor="delete-workspace-name"
												>
													<span>Type the workspace name</span>
													<Input
														id="delete-workspace-name"
														value={confirmation}
														onValueChange={setConfirmation}
													/>
												</label>
												<label
													className="space-y-2 text-sm"
													htmlFor="delete-workspace-password"
												>
													<span>Current password</span>
													<Input
														id="delete-workspace-password"
														type="password"
														value={password}
														onValueChange={setPassword}
													/>
												</label>
											</div>
											<AlertDialogFooter>
												<AlertDialogCancel disabled={pending}>
													Cancel
												</AlertDialogCancel>
												<AlertDialogAction
													variant="destructive"
													disabled={
														pending ||
														confirmation !== initial.organization.name ||
														!password
													}
													onClick={() => void removeWorkspace()}
												>
													Delete permanently
												</AlertDialogAction>
											</AlertDialogFooter>
										</AlertDialogContent>
									</AlertDialog>
								</section>
							</TabsContent>
						) : null}
					</Tabs>
				</div>
			</main>
		</WorkspaceShell>
	);
}
