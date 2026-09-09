import { NotebookPen } from "lucide-react";
import type * as React from "react";

import { NavUser } from "@/components/nav-user";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarRail,
} from "@/components/ui/sidebar";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
	user: {
		name: string;
		email: string;
		image?: string | null;
	};
	organizationName?: string | null;
}

export function AppSidebar({
	user,
	organizationName,
	...props
}: AppSidebarProps) {
	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<div className="flex items-center gap-2 px-2 py-1.5">
					<span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
						<NotebookPen className="size-4" aria-hidden="true" />
					</span>
					<div className="min-w-0">
						<p className="truncate text-sm font-semibold">DV-EXAM</p>
						<p className="truncate text-xs text-muted-foreground">
							{organizationName ?? "Personal workspace"}
						</p>
					</div>
				</div>
			</SidebarHeader>
			<SidebarContent />
			<SidebarFooter>
				<NavUser user={user} />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
