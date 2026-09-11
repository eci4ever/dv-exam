import { useNavigate } from "@tanstack/react-router";
import { ChevronsUpDownIcon, LogOutIcon, ShieldCheckIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";

function initials(name: string) {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0])
		.join("")
		.toUpperCase();
}

export function NavUser({
	user,
	isImpersonating,
}: {
	user: {
		name: string;
		email: string;
		image?: string | null;
		role?: string | null;
	};
	isImpersonating: boolean;
}) {
	const { isMobile } = useSidebar();
	const navigate = useNavigate();
	const roleLabel = user.role
		?.split(",")[0]
		.replace(/^./, (character) => character.toUpperCase());

	async function signOut() {
		await authClient.signOut();
		await navigate({ to: "/" });
	}

	async function stopImpersonating() {
		const result = await authClient.admin.stopImpersonating();

		if (!result.error) {
			window.location.assign("/dashboard");
		}
	}

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<SidebarMenuButton
								size="lg"
								className={
									isImpersonating
										? "bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive aria-expanded:bg-destructive/15"
										: "aria-expanded:bg-muted"
								}
							/>
						}
					>
						<Avatar>
							<AvatarImage src={user.image ?? undefined} alt={user.name} />
							<AvatarFallback>{initials(user.name)}</AvatarFallback>
						</Avatar>
						<div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
							<span className="truncate font-medium">{user.name}</span>
							<div className="flex min-w-0 items-center gap-1">
								<span className="min-w-0 flex-1 truncate text-xs">
									{user.email}
								</span>
								{roleLabel ? (
									<Badge className="shrink-0" variant="secondary">
										{roleLabel}
									</Badge>
								) : null}
							</div>
						</div>
						<ChevronsUpDownIcon
							className="ml-auto size-4 shrink-0 group-data-[collapsible=icon]:hidden"
							aria-hidden="true"
						/>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="min-w-56 max-w-72"
						side={isMobile ? "bottom" : "right"}
						align="end"
						sideOffset={4}
					>
						<DropdownMenuGroup>
							<DropdownMenuLabel className="p-0 font-normal">
								<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
									<Avatar>
										<AvatarImage
											src={user.image ?? undefined}
											alt={user.name}
										/>
										<AvatarFallback>{initials(user.name)}</AvatarFallback>
									</Avatar>
									<div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
										<span className="truncate font-medium">{user.name}</span>
										<div className="flex min-w-0 items-center gap-1">
											<span className="min-w-0 flex-1 truncate text-xs">
												{user.email}
											</span>
											{roleLabel ? (
												<Badge className="shrink-0" variant="secondary">
													{roleLabel}
												</Badge>
											) : null}
										</div>
									</div>
								</div>
							</DropdownMenuLabel>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						{isImpersonating ? (
							<>
								<DropdownMenuItem onClick={stopImpersonating}>
									<ShieldCheckIcon />
									Return to admin
								</DropdownMenuItem>
								<DropdownMenuSeparator />
							</>
						) : null}
						<DropdownMenuItem onClick={signOut}>
							<LogOutIcon />
							Log out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
