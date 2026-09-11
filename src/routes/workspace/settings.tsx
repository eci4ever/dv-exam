import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	CircleGaugeIcon,
	CreditCardIcon,
	Settings2Icon,
	ShieldCheckIcon,
	Trash2Icon,
	UsersRoundIcon,
} from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
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
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/workspace/settings")({
	beforeLoad: async () => {
		const dashboard = await getDashboardSession();

		if (!dashboard) {
			throw redirect({ to: "/login" });
		}

		if (!dashboard.isOrganizationOwner) {
			throw redirect({ to: "/dashboard" });
		}

		return dashboard;
	},
	component: WorkspaceSettings,
});

const roles = [
	{
		key: "owner",
		name: "Owner",
		description: "Full access, including billing and workspace deletion.",
	},
	{
		key: "admin",
		name: "Admin",
		description: "Manage members, exams, questions, attempts, and results.",
	},
	{
		key: "teacher",
		name: "Teacher",
		description:
			"Create and publish exams, manage questions, and grade attempts.",
	},
	{
		key: "student",
		name: "Student",
		description: "Take assigned exams and view their own results.",
	},
];

function WorkspaceSettings() {
	const {
		session,
		organization,
		organizations,
		activeOrganizationId,
		isOrganizationOwner,
		organizationRole,
	} = Route.useRouteContext();
	const organizationName = organization?.name ?? "Your workspace";
	const activeRoles = organizationRole?.split(",") ?? [];

	return (
		<SidebarProvider>
			<AppSidebar
				user={session.user}
				organizations={organizations}
				activeOrganizationId={activeOrganizationId}
				isOrganizationOwner={isOrganizationOwner}
				organizationRole={organizationRole}
				isImpersonating={Boolean(session.session.impersonatedBy)}
				activeItem="settings"
			/>
			<SidebarInset>
				<header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
					<SidebarTrigger className="-ml-1" />
					<Separator
						orientation="vertical"
						className="mr-2 data-vertical:h-4 data-vertical:self-center"
					/>
					<p className="text-sm font-medium">Workspace settings</p>
				</header>

				<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
					<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
						<div className="flex items-start gap-3">
							<div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-card">
								<Settings2Icon className="size-5" />
							</div>
							<div className="space-y-1">
								<p className="text-sm text-muted-foreground">
									{organizationName}
								</p>
								<h1 className="text-2xl font-semibold tracking-tight">
									Workspace settings
								</h1>
								<p className="text-sm leading-6 text-muted-foreground">
									Review access, plan usage, and workspace controls.
								</p>
							</div>
						</div>

						<Tabs defaultValue="roles" className="gap-5">
							<TabsList
								variant="line"
								className="w-full justify-start overflow-x-auto"
							>
								<TabsTrigger value="roles" className="flex-none px-3">
									<ShieldCheckIcon />
									Roles &amp; Permissions
								</TabsTrigger>
								<TabsTrigger value="billing" className="flex-none px-3">
									<CreditCardIcon />
									Billing &amp; Usage
								</TabsTrigger>
								<TabsTrigger value="danger" className="flex-none px-3">
									<Trash2Icon />
									Danger Zone
								</TabsTrigger>
							</TabsList>

							<TabsContent value="roles">
								<section className="overflow-hidden rounded-xl border bg-card">
									<div className="flex items-start gap-3 border-b p-5 sm:p-6">
										<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
											<UsersRoundIcon className="size-4" />
										</div>
										<div className="space-y-1">
											<h2 className="font-medium">Workspace access</h2>
											<p className="text-sm leading-6 text-muted-foreground">
												Roles determine what members can manage in this
												workspace.
											</p>
										</div>
									</div>
									<div className="divide-y">
										{roles.map((role) => (
											<div
												key={role.name}
												className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
											>
												<div className="space-y-1">
													<div className="flex items-center gap-2">
														<p className="font-medium">{role.name}</p>
														{activeRoles.includes(role.key) ? (
															<Badge variant="secondary">Your role</Badge>
														) : null}
													</div>
													<p className="text-sm leading-6 text-muted-foreground">
														{role.description}
													</p>
												</div>
											</div>
										))}
									</div>
								</section>
							</TabsContent>

							<TabsContent value="billing">
								<div className="grid gap-4 lg:grid-cols-2">
									<section className="rounded-xl border bg-card p-5 sm:p-6">
										<div className="flex items-start justify-between gap-4">
											<div className="space-y-1">
												<p className="font-medium">Current plan</p>
												<p className="text-sm text-muted-foreground">
													For small learning groups getting started.
												</p>
											</div>
											<Badge variant="secondary">Starter</Badge>
										</div>
										<Separator className="my-5" />
										<dl className="grid gap-3 text-sm">
											<div className="flex items-center justify-between gap-4">
												<dt className="text-muted-foreground">Monthly price</dt>
												<dd className="font-medium">RM 0</dd>
											</div>
											<div className="flex items-center justify-between gap-4">
												<dt className="text-muted-foreground">Billing cycle</dt>
												<dd className="font-medium">Monthly</dd>
											</div>
										</dl>
									</section>

									<section className="rounded-xl border bg-card p-5 sm:p-6">
										<div className="flex items-start gap-3">
											<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
												<CircleGaugeIcon className="size-4" />
											</div>
											<div>
												<p className="font-medium">Current usage</p>
												<p className="text-sm text-muted-foreground">
													This billing period
												</p>
											</div>
										</div>
										<Separator className="my-5" />
										<dl className="grid gap-3 text-sm">
											<div className="flex items-center justify-between gap-4">
												<dt className="text-muted-foreground">Members</dt>
												<dd className="font-medium">1 of 10</dd>
											</div>
											<div className="flex items-center justify-between gap-4">
												<dt className="text-muted-foreground">Exams</dt>
												<dd className="font-medium">0 of 25</dd>
											</div>
										</dl>
									</section>
								</div>
							</TabsContent>

							<TabsContent value="danger">
								<section className="rounded-xl border border-destructive/40 bg-card p-5 sm:p-6">
									<div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
										<div className="max-w-2xl space-y-1">
											<h2 className="font-medium">Delete workspace</h2>
											<p className="text-sm leading-6 text-muted-foreground">
												Permanently remove {organizationName} and all associated
												data. Deletion is disabled in this preview.
											</p>
										</div>
										<AlertDialog>
											<AlertDialogTrigger
												render={<Button variant="destructive" />}
											>
												<Trash2Icon />
												Delete workspace
											</AlertDialogTrigger>
											<AlertDialogContent>
												<AlertDialogHeader>
													<AlertDialogTitle>
														Delete this workspace?
													</AlertDialogTitle>
													<AlertDialogDescription>
														This would permanently delete {organizationName}.
														This action is disabled in the mock settings page.
													</AlertDialogDescription>
												</AlertDialogHeader>
												<AlertDialogFooter>
													<AlertDialogCancel>Cancel</AlertDialogCancel>
													<AlertDialogAction variant="destructive" disabled>
														Delete workspace
													</AlertDialogAction>
												</AlertDialogFooter>
											</AlertDialogContent>
										</AlertDialog>
									</div>
								</section>
							</TabsContent>
						</Tabs>
					</div>
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
