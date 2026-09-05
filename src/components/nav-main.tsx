import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "#/components/ui/sidebar";

export type AppRoute =
	| "/dashboard"
	| "/account"
	| "/organizations"
	| "/super-admin"
	| "/super-admin/users"
	| "/super-admin/organisations"
	| "/super-admin/audit";

export function NavMain({
	label,
	items,
}: {
	label: string;
	items: Array<{
		title: string;
		to: AppRoute;
		icon: LucideIcon;
		hash?: string;
	}>;
}) {
	return (
		<SidebarGroup>
			<SidebarGroupLabel>{label}</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) => (
					<SidebarMenuItem key={`${item.to}${item.hash ?? ""}`}>
						<SidebarMenuButton asChild tooltip={item.title}>
							<Link
								activeOptions={{ exact: !item.hash }}
								activeProps={{
									className:
										"bg-sidebar-accent font-medium text-sidebar-accent-foreground",
								}}
								hash={item.hash}
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
