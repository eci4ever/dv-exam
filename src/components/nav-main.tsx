import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "#/components/ui/sidebar";

type AppRoute = "/dashboard" | "/organizations" | "/account" | "/super-admin";

export function NavMain({
	items,
}: {
	items: Array<{ title: string; to: AppRoute; icon: LucideIcon }>;
}) {
	return (
		<SidebarGroup>
			<SidebarGroupLabel>Menu utama</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) => (
					<SidebarMenuItem key={item.to}>
						<SidebarMenuButton asChild tooltip={item.title}>
							<Link
								activeOptions={{ exact: true }}
								activeProps={{
									className:
										"bg-sidebar-accent font-medium text-sidebar-accent-foreground",
								}}
								to={item.to}
							>
								<item.icon />
								<span>{item.title}</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				))}
			</SidebarMenu>
		</SidebarGroup>
	);
}
