"use client";

import { useRouter } from "@tanstack/react-router";
import { Building2Icon, ChevronsUpDownIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";

interface Organization {
	id: string;
	name: string;
	slug: string;
	logo?: string | null;
}

export function OrganizationSwitcher({
	organizations,
	activeOrganizationId,
	organizationRole,
}: {
	organizations: Organization[];
	activeOrganizationId?: string | null;
	organizationRole?: string | null;
}) {
	const { isMobile } = useSidebar();
	const router = useRouter();
	const activeOrganization =
		organizations.find(
			(organization) => organization.id === activeOrganizationId,
		) ?? organizations[0];
	const roleLabel = organizationRole
		?.split(",")[0]
		.replace(/^./, (character) => character.toUpperCase());

	if (!activeOrganization) {
		return null;
	}

	async function setActiveOrganization(organizationId: string) {
		if (organizationId === activeOrganization.id) {
			return;
		}

		const result = await authClient.organization.setActive({ organizationId });

		if (!result.error) {
			await router.invalidate();
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
								className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
							/>
						}
					>
						<div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
							<Building2Icon className="size-4" aria-hidden="true" />
						</div>
						<div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
							<span className="truncate font-medium">
								{activeOrganization.name}
							</span>
							<div className="flex min-w-0 items-center gap-1">
								<span className="min-w-0 flex-1 truncate text-xs">
									Organization
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
						align="start"
						side={isMobile ? "bottom" : "right"}
						sideOffset={4}
					>
						<DropdownMenuGroup>
							<DropdownMenuLabel>Organizations</DropdownMenuLabel>
							{organizations.map((organization) => (
								<DropdownMenuItem
									key={organization.id}
									onClick={() => setActiveOrganization(organization.id)}
									className="gap-2 p-2"
								>
									<div className="flex size-6 items-center justify-center rounded-md border">
										<Building2Icon className="size-3.5" aria-hidden="true" />
									</div>
									<span className="truncate">{organization.name}</span>
								</DropdownMenuItem>
							))}
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
