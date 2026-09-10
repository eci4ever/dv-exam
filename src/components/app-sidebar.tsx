import {
	Building2Icon,
	LayoutDashboardIcon,
	ScrollTextIcon,
	Settings2Icon,
	UserRoundCogIcon,
	UsersRoundIcon,
} from "lucide-react";
import type * as React from "react";

import { NavUser } from "@/components/nav-user";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
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
	isOrganizationOwner: boolean;
	organizationRole?: string | null;
	isImpersonating: boolean;
}

export function AppSidebar({
	user,
	organizations,
	activeOrganizationId,
	isOrganizationOwner,
	organizationRole,
	isImpersonating,
	...props
}: AppSidebarProps) {
	const isAdmin = user.role?.split(",").includes("admin") ?? false;

	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader className="h-16 shrink-0 justify-center">
				<OrganizationSwitcher
					organizations={organizations}
					activeOrganizationId={activeOrganizationId}
					organizationRole={organizationRole}
				/>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Main</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									render={
										<a href="/dashboard">
											<LayoutDashboardIcon />
											<span>Dashboard</span>
										</a>
									}
									isActive
									tooltip="Dashboard"
								/>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarGroup>
					<SidebarGroupLabel>Workspace</SidebarGroupLabel>
					{isOrganizationOwner ? (
						<SidebarGroupContent>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton tooltip="Organization settings">
										<Settings2Icon />
										<span>Organization settings</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton tooltip="Members">
										<UsersRoundIcon />
										<span>Members</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton tooltip="Invitations">
										<UserRoundCogIcon />
										<span>Invitations</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					) : null}
				</SidebarGroup>
				{isAdmin ? (
					<SidebarGroup>
						<SidebarGroupLabel>Platform Admin</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton
										render={
											<a href="/admin/users">
												<UsersRoundIcon />
												<span>Users</span>
											</a>
										}
										tooltip="Users"
									/>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton tooltip="Organizations">
										<Building2Icon />
										<span>Organizations</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton tooltip="Audit log">
										<ScrollTextIcon />
										<span>Audit log</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				) : null}
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={user} isImpersonating={isImpersonating} />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
