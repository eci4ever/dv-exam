import type * as React from "react";

import { NavUser } from "@/components/nav-user";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarRail,
} from "@/components/ui/sidebar";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
	user: {
		name: string;
		email: string;
		image?: string | null;
		role?: string | null;
	};
	organizations: {
		id: string;
		name: string;
		slug: string;
		logo?: string | null;
	}[];
	activeOrganizationId?: string | null;
}

export function AppSidebar({
	user,
	organizations,
	activeOrganizationId,
	...props
}: AppSidebarProps) {
	const isAdmin = user.role?.split(",").includes("admin") ?? false;

	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<OrganizationSwitcher
					organizations={organizations}
					activeOrganizationId={activeOrganizationId}
				/>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Main</SidebarGroupLabel>
				</SidebarGroup>
				<SidebarGroup>
					<SidebarGroupLabel>Workspace</SidebarGroupLabel>
				</SidebarGroup>
				{isAdmin ? (
					<SidebarGroup>
						<SidebarGroupLabel>Platform Admin</SidebarGroupLabel>
					</SidebarGroup>
				) : null}
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={user} />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
