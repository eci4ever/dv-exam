import { Link } from "@tanstack/react-router";
import { BadgeCheck, ChevronsUpDown, LogOut, ShieldCheck } from "lucide-react";
import type { SidebarUser } from "#/components/app-sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "#/components/ui/sidebar";
import { authClient } from "#/lib/auth-client";

export function NavUser({ user }: { user: SidebarUser }) {
	const { isMobile } = useSidebar();
	const initials = user.name
		.split(" ")
		.slice(0, 2)
		.map((part) => part[0])
		.join("")
		.toUpperCase();

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
							size="lg"
						>
							<Avatar className="size-8 rounded-lg">
								{user.image && <AvatarImage alt={user.name} src={user.image} />}
								<AvatarFallback className="rounded-lg">
									{initials}
								</AvatarFallback>
							</Avatar>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">{user.name}</span>
								<span className="truncate text-xs text-muted-foreground">
									{user.email}
								</span>
							</div>
							<ChevronsUpDown className="ml-auto size-4" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="end"
						className="w-(--radix-dropdown-menu-trigger-width) min-w-60 rounded-lg"
						side={isMobile ? "bottom" : "right"}
						sideOffset={4}
					>
						<DropdownMenuLabel className="font-normal">
							<p className="truncate text-sm font-medium">{user.name}</p>
							<p className="truncate text-xs text-muted-foreground">
								{user.email}
							</p>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem asChild>
								<Link to="/account">
									<BadgeCheck /> Tetapan akaun
								</Link>
							</DropdownMenuItem>
							{user.role === "admin" && (
								<DropdownMenuItem asChild>
									<Link to="/super-admin">
										<ShieldCheck /> Konsol Super Admin
									</Link>
								</DropdownMenuItem>
							)}
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={() =>
								authClient.signOut({
									fetchOptions: {
										onSuccess: () => window.location.assign("/"),
									},
								})
							}
						>
							<LogOut /> Log keluar
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
