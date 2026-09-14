import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";

type DashboardContext = NonNullable<
	Awaited<ReturnType<typeof import("@/lib/session").getDashboardSession>>
>;

interface PlatformAdminShellProps {
	context: DashboardContext;
	activeItem:
		| "admin-overview"
		| "users"
		| "organizations"
		| "plans"
		| "audit"
		| "admin-settings";
	title: string;
	children: ReactNode;
}

export function PlatformAdminShell({
	context,
	activeItem,
	title,
	children,
}: PlatformAdminShellProps) {
	return (
		<SidebarProvider>
			<AppSidebar
				user={context.session.user}
				organizations={context.organizations}
				activeOrganizationId={context.activeOrganizationId}
				isOrganizationOwner={context.isOrganizationOwner}
				organizationRole={context.organizationRole}
				isImpersonating={Boolean(context.session.session.impersonatedBy)}
				activeItem={activeItem}
			/>
			<SidebarInset>
				<header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
					<SidebarTrigger className="-ml-1" />
					<Separator
						orientation="vertical"
						className="mr-2 data-vertical:h-4 data-vertical:self-center"
					/>
					<p className="text-sm font-medium">{title}</p>
				</header>
				{context.maintenanceNotice ? (
					<output className="border-b bg-muted px-4 py-2 text-center text-sm">
						{context.maintenanceNotice}
					</output>
				) : null}
				{context.session.session.impersonatedBy ? (
					<output className="border-b bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">
						Support mode is read-only. Return to admin to make changes.
					</output>
				) : null}
				{children}
			</SidebarInset>
		</SidebarProvider>
	);
}
