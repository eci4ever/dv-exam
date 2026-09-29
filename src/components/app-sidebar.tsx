import { Link } from "@tanstack/react-router";
import {
	Building2Icon,
	CalendarDaysIcon,
	ChartSplineIcon,
	CreditCardIcon,
	FileTextIcon,
	GaugeIcon,
	GraduationCapIcon,
	LayoutDashboardIcon,
	LibraryIcon,
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
import { isPlatformAdmin } from "@/lib/platform-role";

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
	activeItem?:
		| "dashboard"
		| "organizations"
		| "settings"
		| "users"
		| "admin-overview"
		| "plans"
		| "audit"
		| "admin-settings"
		| "exams"
		| "questions"
		| "schedule"
		| "my-exams"
		| "results"
		| "reports"
		| "workspace-overview"
		| "workspace-members"
		| "workspace-invitations"
		| "workspace-people"
		| "workspace-classes"
		| "workspace-billing";
}

export function AppSidebar({
	user,
	organizations,
	activeOrganizationId,
	isOrganizationOwner: _isOrganizationOwner,
	organizationRole,
	isImpersonating,
	activeItem = "dashboard",
	...props
}: AppSidebarProps) {
	const isAdmin = isPlatformAdmin(user.role);
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
										<Link to="/dashboard">
											<LayoutDashboardIcon />
											<span>Dashboard</span>
										</Link>
									}
									isActive={activeItem === "dashboard"}
									tooltip="Dashboard"
								/>
							</SidebarMenuItem>
							{canManageExams ? (
								<SidebarMenuItem>
									<SidebarMenuButton
										render={
											<Link to="/exams">
												<FileTextIcon />
												<span>Exams</span>
											</Link>
										}
										isActive={activeItem === "exams"}
										tooltip="Exams"
									/>
								</SidebarMenuItem>
							) : (
								<SidebarMenuItem>
									<SidebarMenuButton
										render={
											<Link to="/my-exams" search={{ tab: "available" }}>
												<FileTextIcon />
												<span>Exams</span>
											</Link>
										}
										isActive={activeItem === "my-exams"}
										tooltip="Exams"
									/>
								</SidebarMenuItem>
							)}
							{canManageExams ? (
								<SidebarMenuItem>
									<SidebarMenuButton
										render={
											<Link to="/schedule">
												<CalendarDaysIcon />
												<span>Schedule</span>
											</Link>
										}
										isActive={activeItem === "schedule"}
										tooltip="Schedule"
									/>
								</SidebarMenuItem>
							) : null}
							{canManageExams ? (
								<SidebarMenuItem>
									<SidebarMenuButton
										render={
											<Link to="/questions">
												<LibraryIcon />
												<span>Question Bank</span>
											</Link>
										}
										isActive={activeItem === "questions"}
										tooltip="Question Bank"
									/>
								</SidebarMenuItem>
							) : null}
							{canManageExams ? (
								<SidebarMenuItem>
									<SidebarMenuButton
										render={
											<Link to="/reports">
												<ChartSplineIcon />
												<span>Reports</span>
											</Link>
										}
										isActive={activeItem === "reports"}
										tooltip="Reports"
									/>
								</SidebarMenuItem>
							) : null}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarGroup>
					<SidebarGroupLabel>Workspace</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									render={
										<Link to="/workspace">
											<PanelsTopLeftIcon />
											<span>Overview</span>
										</Link>
									}
									isActive={activeItem === "workspace-overview"}
									tooltip="Workspace overview"
								/>
							</SidebarMenuItem>
							{canManageOrganization ? (
								<SidebarMenuItem>
									<SidebarMenuButton
										render={
											<Link to="/workspace/people" search={{ tab: "members" }}>
												<UsersRoundIcon />
												<span>People</span>
											</Link>
										}
										isActive={
											activeItem === "workspace-people" ||
											activeItem === "workspace-members" ||
											activeItem === "workspace-invitations"
										}
										tooltip="People"
									/>
								</SidebarMenuItem>
							) : null}
							{canManageExams ? (
								<SidebarMenuItem>
									<SidebarMenuButton
										render={
											<Link to="/workspace/classes">
												<GraduationCapIcon />
												<span>Classes</span>
											</Link>
										}
										isActive={activeItem === "workspace-classes"}
										tooltip="Classes"
									/>
								</SidebarMenuItem>
							) : null}
							{canManageOrganization ? (
								<SidebarMenuItem>
									<SidebarMenuButton
										render={
											<Link
												to="/workspace/settings"
												search={{ tab: "general" }}
											>
												<Settings2Icon />
												<span>Settings</span>
											</Link>
										}
										isActive={activeItem === "settings"}
										tooltip="Settings"
									/>
								</SidebarMenuItem>
							) : null}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				{isAdmin ? (
					<SidebarGroup>
						<SidebarGroupLabel>Platform Admin</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton
										render={
											<Link to="/admin">
												<GaugeIcon />
												<span>Overview</span>
											</Link>
										}
										isActive={activeItem === "admin-overview"}
										tooltip="Platform overview"
									/>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton
										render={
											<Link to="/admin/users" search={{ status: "all" }}>
												<UsersRoundIcon />
												<span>Users</span>
											</Link>
										}
										isActive={activeItem === "users"}
										tooltip="Users"
									/>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton
										render={
											<Link
												to="/admin/organizations"
												search={{ plan: "all", status: "all", health: "all" }}
											>
												<Building2Icon />
												<span>Organizations</span>
											</Link>
										}
										isActive={activeItem === "organizations"}
										tooltip="Organizations"
									/>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton
										render={
											<Link to="/admin/plans">
												<CreditCardIcon />
												<span>Plans & Usage</span>
											</Link>
										}
										isActive={activeItem === "plans"}
										tooltip="Plans & Usage"
									/>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton
										render={
											<Link
												to="/admin/audit"
												search={{ organization: "", event: "" }}
											>
												<ScrollTextIcon />
												<span>Audit Log</span>
											</Link>
										}
										isActive={activeItem === "audit"}
										tooltip="Audit Log"
									/>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton
										render={
											<Link to="/admin/settings">
												<SlidersHorizontalIcon />
												<span>System Settings</span>
											</Link>
										}
										isActive={activeItem === "admin-settings"}
										tooltip="System Settings"
									/>
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
