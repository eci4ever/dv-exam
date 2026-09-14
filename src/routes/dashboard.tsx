import { createFileRoute, redirect } from "@tanstack/react-router";

import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/dashboard")({
	beforeLoad: async () => {
		const data = await getDashboardSession();

		if (!data) {
			throw redirect({ to: "/login" });
		}

		return data;
	},
	component: Dashboard,
});

function Dashboard() {
	const {
		session,
		organization,
		organizations,
		activeOrganizationId,
		isOrganizationOwner,
		organizationRole,
		entitlement,
		maintenanceNotice,
	} = Route.useRouteContext();
	const firstName = session.user.name.split(/\s+/)[0] || session.user.name;

	return (
		<SidebarProvider>
			<AppSidebar
				user={session.user}
				organizations={organizations}
				activeOrganizationId={activeOrganizationId}
				isOrganizationOwner={isOrganizationOwner}
				organizationRole={organizationRole}
				isImpersonating={Boolean(session.session.impersonatedBy)}
			/>
			<SidebarInset>
				<header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
					<SidebarTrigger className="-ml-1" />
					<Separator
						orientation="vertical"
						className="mr-2 data-vertical:h-4 data-vertical:self-center"
					/>
					<p className="text-sm font-medium">Dashboard</p>
				</header>
				{maintenanceNotice ? (
					<output className="border-b bg-muted px-4 py-2 text-center text-sm">
						{maintenanceNotice}
					</output>
				) : null}
				{entitlement?.status === "suspended" ? (
					<div
						className="border-b bg-destructive/10 px-4 py-3 text-center text-sm text-destructive"
						role="alert"
					>
						This workspace is suspended.{" "}
						{entitlement.suspensionReason ?? "Contact platform support."}
					</div>
				) : null}
				<main className="flex flex-1 flex-col gap-6 p-6 sm:p-8">
					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">
							{organization?.name ?? "Your personal workspace"}
						</p>
						<h1 className="text-2xl font-semibold tracking-tight">
							Welcome, {firstName}
						</h1>
						<p className="max-w-2xl text-sm leading-6 text-muted-foreground">
							Your DV-EXAM workspace is ready for you to organise your exam
							preparation.
						</p>
					</div>
					<section
						className="rounded-xl border bg-card p-6"
						aria-disabled={entitlement?.status === "suspended"}
					>
						<p className="text-sm font-medium">Your account</p>
						<p className="mt-1 text-sm text-muted-foreground">
							{session.user.email}
						</p>
						{entitlement ? (
							<p className="mt-3 text-xs text-muted-foreground">
								{entitlement.planName} plan · {entitlement.memberLimit} member
								limit
							</p>
						) : null}
					</section>
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
