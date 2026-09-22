import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";

interface WorkspaceShellProps {
	data: {
		session: {
			user: {
				name: string;
				email: string;
				image?: string | null;
				role?: string | null;
			};
			session: { impersonatedBy?: string | null };
		};
		organizations: Array<{
			id: string;
			name: string;
			slug: string;
			logo?: string | null;
		}>;
		activeOrganizationId?: string | null;
		isOrganizationOwner: boolean;
		organizationRole?: string | null;
		maintenanceNotice?: string | null;
	};
	activeItem:
		| "exams"
		| "questions"
		| "schedule"
		| "my-exams"
		| "results"
		| "reports"
		| "workspace-overview"
		| "settings"
		| "workspace-members"
		| "workspace-invitations"
		| "workspace-classes";
	title: string;
	children: ReactNode;
}

export function WorkspaceShell({
	data,
	activeItem,
	title,
	children,
}: WorkspaceShellProps) {
	return (
		<SidebarProvider>
			<AppSidebar
				user={data.session.user}
				organizations={data.organizations}
				activeOrganizationId={data.activeOrganizationId}
				isOrganizationOwner={data.isOrganizationOwner}
				organizationRole={data.organizationRole}
				isImpersonating={Boolean(data.session.session.impersonatedBy)}
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
				{data.maintenanceNotice ? (
					<output className="border-b bg-muted px-4 py-2 text-center text-sm">
						{data.maintenanceNotice}
					</output>
				) : null}
				{children}
			</SidebarInset>
		</SidebarProvider>
	);
}
