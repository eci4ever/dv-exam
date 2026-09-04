import { Link } from "@tanstack/react-router";
import {
	Building2,
	GraduationCap,
	LayoutDashboard,
	Settings,
	ShieldCheck,
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
	...props
}: React.ComponentProps<typeof Sidebar> & { user: SidebarUser }) {
	const navItems = [
		{ title: "Dashboard", to: "/dashboard" as const, icon: LayoutDashboard },
		{ title: "Organisasi", to: "/organizations" as const, icon: Building2 },
		{ title: "Tetapan akaun", to: "/account" as const, icon: Settings },
	];

	if (user.role === "admin") {
		navItems.push({
			title: "Super Admin",
			to: "/super-admin" as const,
			icon: ShieldCheck,
		});
	}

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
										Pengurusan peperiksaan
									</span>
								</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavMain items={navItems} />
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={user} />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
