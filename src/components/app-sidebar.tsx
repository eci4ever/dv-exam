import {
	Building2Icon,
	CalendarDaysIcon,
	ChartNoAxesColumnIncreasingIcon,
	CreditCardIcon,
	FileTextIcon,
	GaugeIcon,
	GraduationCapIcon,
	LayoutDashboardIcon,
	LibraryIcon,
	type LucideIcon,
	MailPlusIcon,
	MegaphoneIcon,
	PanelsTopLeftIcon,
	ScrollTextIcon,
	Settings2Icon,
	SlidersHorizontalIcon,
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
	activeItem?: "dashboard" | "settings" | "users";
}

interface MockSidebarItemProps {
	icon: LucideIcon;
	label: string;
	tooltip?: string;
}

function MockSidebarItem({
	icon: Icon,
	label,
	tooltip = label,
}: MockSidebarItemProps) {
	return (
		<SidebarMenuItem>
			<SidebarMenuButton type="button" tooltip={tooltip}>
				<Icon />
				<span>{label}</span>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

export function AppSidebar({
	user,
	organizations,
	activeOrganizationId,
	isOrganizationOwner,
	organizationRole,
	isImpersonating,
	activeItem = "dashboard",
	...props
}: AppSidebarProps) {
	const isAdmin = user.role?.split(",").includes("admin") ?? false;
	const organizationRoles = organizationRole?.split(",") ?? [];
	const canManageOrganization = organizationRoles.some((role) =>
		["owner", "admin"].includes(role),
	);
	const canManageExams = organizationRoles.some((role) =>
		["owner", "admin", "teacher"].includes(role),
	);

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
									isActive={activeItem === "dashboard"}
									tooltip="Dashboard"
								/>
							</SidebarMenuItem>
							<MockSidebarItem icon={FileTextIcon} label="My Exams" />
							<MockSidebarItem icon={CalendarDaysIcon} label="Schedule" />
							<MockSidebarItem
								icon={ChartNoAxesColumnIncreasingIcon}
								label="Results"
							/>
							{canManageExams ? (
								<MockSidebarItem icon={LibraryIcon} label="Question Bank" />
							) : null}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarGroup>
					<SidebarGroupLabel>Workspace</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							<MockSidebarItem icon={PanelsTopLeftIcon} label="Overview" />
							<MockSidebarItem icon={UsersRoundIcon} label="Members" />
							<MockSidebarItem icon={MegaphoneIcon} label="Announcements" />
							{canManageOrganization ? (
								<>
									<MockSidebarItem icon={MailPlusIcon} label="Invitations" />
									<MockSidebarItem
										icon={GraduationCapIcon}
										label="Academic Setup"
									/>
									{isOrganizationOwner ? (
										<SidebarMenuItem>
											<SidebarMenuButton
												render={
													<a href="/workspace/settings">
														<Settings2Icon />
														<span>Settings</span>
													</a>
												}
												isActive={activeItem === "settings"}
												tooltip="Settings"
											/>
										</SidebarMenuItem>
									) : null}
								</>
							) : null}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				{isAdmin ? (
					<SidebarGroup>
						<SidebarGroupLabel>Platform Admin</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								<MockSidebarItem
									icon={GaugeIcon}
									label="Overview"
									tooltip="Platform overview"
								/>
								<SidebarMenuItem>
									<SidebarMenuButton
										render={
											<a href="/admin/users">
												<UsersRoundIcon />
												<span>Users</span>
											</a>
										}
										isActive={activeItem === "users"}
										tooltip="Users"
									/>
								</SidebarMenuItem>
								<MockSidebarItem icon={Building2Icon} label="Organizations" />
								<MockSidebarItem
									icon={CreditCardIcon}
									label="Plans & Billing"
								/>
								<MockSidebarItem icon={ScrollTextIcon} label="Audit Log" />
								<MockSidebarItem
									icon={SlidersHorizontalIcon}
									label="System Settings"
								/>
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
