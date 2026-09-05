import { Link } from "@tanstack/react-router";
import {
	Building2,
	FileText,
	GraduationCap,
	LayoutDashboard,
	Settings,
	ShieldCheck,
	Users,
} from "lucide-react";
import type * as React from "react";
import { NavMain } from "#/components/nav-main";
import { NavUser } from "#/components/nav-user";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "#/components/ui/sidebar";

export type SidebarUser = {
	name: string;
	email: string;
	image?: string | null;
	role?: string | null;
};

export function AppSidebar({
	user,
	organizationRole,
	...props
}: React.ComponentProps<typeof Sidebar> & {
	user: SidebarUser;
	organizationRole?: string | null;
}) {
	const platformItems = [
		{ title: "Dashboard", to: "/dashboard" as const, icon: LayoutDashboard },
		{ title: "Account settings", to: "/account" as const, icon: Settings },
	];
	const canManageOrganization =
		organizationRole === "owner" || organizationRole === "admin";

	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild className="h-12" size="lg">
							<Link to="/dashboard">
								<span className="grid aspect-square size-8 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
									<GraduationCap className="size-4" />
								</span>
								<span className="grid flex-1 text-left leading-tight">
									<span className="truncate font-semibold">CaknaExam</span>
									<span className="truncate text-xs">
										Examination management
									</span>
								</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavMain label="Platform" items={platformItems} />
				{canManageOrganization && (
					<NavMain
						label="Organisation"
						items={[
							{ title: "Workspace", to: "/organizations", icon: Building2 },
							{
								title: "Members & invitations",
								to: "/organizations",
								hash: "members",
								icon: Users,
							},
						]}
					/>
				)}
				{user.role === "admin" && (
					<NavMain
						label="Platform Admin"
						items={[
							{ title: "Overview", to: "/super-admin", icon: ShieldCheck },
							{ title: "Users", to: "/super-admin/users", icon: Users },
							{
								title: "Organisations",
								to: "/super-admin/organisations",
								icon: Building2,
							},
							{
								title: "Audit trails",
								to: "/super-admin/audit",
								icon: FileText,
							},
						]}
					/>
				)}
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={user} />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
