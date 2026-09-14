import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import {
	ArrowUpDownIcon,
	KeyRoundIcon,
	MonitorIcon,
	PlusIcon,
	RefreshCwIcon,
	SearchIcon,
	ShieldCheckIcon,
	Trash2Icon,
	UserRoundCogIcon,
	XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import {
	createPlatformUser,
	deletePlatformUser,
	impersonatePlatformUser,
	listPlatformUserSessions,
	listPlatformUsers,
	listUserProvisioningOrganizations,
	revokePlatformUserSession,
	revokePlatformUserSessions,
	setPlatformUserBan,
	setPlatformUserPassword,
	setPlatformUserRole,
	updatePlatformUser,
} from "@/lib/admin";
import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/admin/users")({
	beforeLoad: async () => {
		const dashboard = await getDashboardSession();

		if (!dashboard) {
			throw redirect({ to: "/login" });
		}

		if (!dashboard.session.user.role?.split(",").includes("admin")) {
			throw redirect({ to: "/dashboard" });
		}

		const [users, provisioningOrganizations] = await Promise.all([
			listPlatformUsers({ data: {} }),
			listUserProvisioningOrganizations(),
		]);
		return { ...dashboard, initialUsers: users, provisioningOrganizations };
	},
	component: UserManagement,
});

function roleLabel(role?: string | null) {
	return (role ?? "user")
		.split(",")
		.map((value) => value.replace(/^./, (character) => character.toUpperCase()))
		.join(", ");
}

function userInitials(name: string) {
	return name
		.split(" ")
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0])
		.join("")
		.toUpperCase();
}

type ManagedUser = {
	id: string;
	name: string;
	email: string;
	role?: string | null;
	banned?: boolean | null;
	banReason?: string | null;
	banExpires?: Date | string | null;
	createdAt?: Date | string;
};

type ManagedSession = {
	id: string;
	token: string;
	expiresAt: Date | string;
};

type RiskAction =
	| "ban"
	| "unban"
	| "revoke-sessions"
	| "impersonate"
	| "delete";

function UserManagement() {
	const {
		session,
		organizations,
		activeOrganizationId,
		isOrganizationOwner,
		organizationRole,
		initialUsers,
		provisioningOrganizations,
	} = Route.useRouteContext();
	const [users, setUsers] = useState(initialUsers.users);
	const [search, setSearch] = useState("");
	const [resultTotal, setResultTotal] = useState(initialUsers.total);
	const [isSearching, setIsSearching] = useState(false);
	const searchRequest = useRef(0);
	const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [sorting, setSorting] = useState<SortingState>([]);
	const [roleFilter, setRoleFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState("all");
	const [page, setPage] = useState(1);
	const [pageCount, setPageCount] = useState(initialUsers.pageCount);
	const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
	const [selectedName, setSelectedName] = useState("");
	const [password, setPassword] = useState("");
	const [sessions, setSessions] = useState<ManagedSession[]>([]);
	const [sessionsLoaded, setSessionsLoaded] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [showCreateUser, setShowCreateUser] = useState(false);
	const [newUser, setNewUser] = useState({
		name: "",
		email: "",
		password: "",
		mode: "workspace" as "workspace" | "organization",
		organizationId: provisioningOrganizations[0]?.id ?? "",
		organizationRole: "student" as "admin" | "teacher" | "student",
	});
	const [riskAction, setRiskAction] = useState<RiskAction | null>(null);
	const [banReason, setBanReason] = useState("");
	const [banDuration, setBanDuration] = useState<
		"24h" | "7d" | "30d" | "permanent"
	>("7d");

	const selectUser = useCallback((user: ManagedUser) => {
		setSelectedUser(user);
		setSelectedName(user.name);
		setPassword("");
		setSessions([]);
		setSessionsLoaded(false);
		setError(null);
	}, []);

	const refreshUsers = useCallback(
		async (nextPage = page) => {
			const requestId = ++searchRequest.current;
			try {
				const primarySort = sorting[0];
				const result = await listPlatformUsers({
					data: {
						search,
						role: roleFilter,
						status: statusFilter,
						page: nextPage,
						sortBy: primarySort?.id ?? "createdAt",
						sortDirection: primarySort?.desc
							? "desc"
							: primarySort
								? "asc"
								: "desc",
					},
				});
				if (requestId === searchRequest.current) {
					setUsers(result.users);
					setResultTotal(result.total);
					setPageCount(result.pageCount);
				}
			} catch (cause) {
				setError(
					cause instanceof Error ? cause.message : "Unable to load users.",
				);
			}
		},
		[page, roleFilter, search, sorting, statusFilter],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: refreshUsers captures the debounced server filters
	useEffect(() => {
		const timeout = window.setTimeout(async () => {
			setIsSearching(true);
			setError(null);

			setPage(1);
			await refreshUsers(1);
			setIsSearching(false);
		}, 300);

		return () => window.clearTimeout(timeout);
	}, [search, roleFilter, statusFilter, sorting, refreshUsers]);

	async function updateRole(userId: string, role: "admin" | "user") {
		setUpdatingUserId(userId);
		setError(null);

		try {
			await setPlatformUserRole({ data: { userId, role } });
			setUsers((currentUsers) =>
				currentUsers.map((user) =>
					user.id === userId ? { ...user, role } : user,
				),
			);
			setSelectedUser((user) => (user ? { ...user, role } : null));
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: "Unable to update this user's role.",
			);
		}

		setUpdatingUserId(null);
	}

	async function saveUserName(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!selectedUser) return;
		setIsSaving(true);
		setError(null);
		try {
			await updatePlatformUser({
				data: { userId: selectedUser.id, name: selectedName },
			});
			setUsers((currentUsers) =>
				currentUsers.map((user) =>
					user.id === selectedUser.id ? { ...user, name: selectedName } : user,
				),
			);
			setSelectedUser((user) =>
				user ? { ...user, name: selectedName } : null,
			);
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "Unable to update this user.",
			);
		}
		setIsSaving(false);
	}

	async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!selectedUser || !password) return;
		setIsSaving(true);
		setError(null);
		try {
			await setPlatformUserPassword({
				data: { userId: selectedUser.id, newPassword: password },
			});
			setPassword("");
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: "Unable to reset the password.",
			);
		}
		setIsSaving(false);
	}

	async function toggleBan() {
		if (!selectedUser) return;
		setIsSaving(true);
		setError(null);
		try {
			await setPlatformUserBan({
				data: {
					userId: selectedUser.id,
					banned: !selectedUser.banned,
					reason: banReason,
					duration: banDuration,
				},
			});
			const banned = !selectedUser.banned;
			setUsers((currentUsers) =>
				currentUsers.map((user) =>
					user.id === selectedUser.id ? { ...user, banned } : user,
				),
			);
			setSelectedUser((user) => (user ? { ...user, banned } : null));
			setBanReason("");
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "Unable to update ban status.",
			);
		}
		setIsSaving(false);
	}

	async function loadSessions() {
		if (!selectedUser) return;
		setIsSaving(true);
		setError(null);
		try {
			const result = await listPlatformUserSessions({
				data: { userId: selectedUser.id },
			});
			setSessions(result.sessions);
			setSessionsLoaded(true);
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "Unable to load sessions.",
			);
		}
		setIsSaving(false);
	}

	async function revokeAllSessions() {
		if (!selectedUser) return;
		setIsSaving(true);
		try {
			await revokePlatformUserSessions({ data: { userId: selectedUser.id } });
			setSessions([]);
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "Unable to revoke sessions.",
			);
		}
		setIsSaving(false);
	}

	async function revokeSession(sessionToken: string) {
		setIsSaving(true);
		try {
			await revokePlatformUserSession({ data: { sessionToken } });
			setSessions((currentSessions) =>
				currentSessions.filter((session) => session.token !== sessionToken),
			);
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: "Unable to revoke this session.",
			);
		}
		setIsSaving(false);
	}

	async function createUser(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsSaving(true);
		setError(null);
		try {
			await createPlatformUser({ data: newUser });
			setNewUser({
				name: "",
				email: "",
				password: "",
				mode: "workspace",
				organizationId: provisioningOrganizations[0]?.id ?? "",
				organizationRole: "student",
			});
			setShowCreateUser(false);
			setSearch("");
			await refreshUsers();
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "Unable to create the user.",
			);
		}
		setIsSaving(false);
	}

	async function confirmRiskAction() {
		if (!selectedUser || !riskAction) return;

		if (riskAction === "ban" || riskAction === "unban") {
			await toggleBan();
		} else if (riskAction === "revoke-sessions") {
			await revokeAllSessions();
		} else if (riskAction === "impersonate") {
			try {
				await impersonatePlatformUser({ data: { userId: selectedUser.id } });
				window.location.assign("/dashboard");
			} catch (cause) {
				setError(
					cause instanceof Error
						? cause.message
						: "Unable to impersonate this user.",
				);
			}
		} else if (riskAction === "delete") {
			try {
				await deletePlatformUser({ data: { userId: selectedUser.id } });
				setUsers((currentUsers) =>
					currentUsers.filter((user) => user.id !== selectedUser.id),
				);
				setSelectedUser(null);
			} catch (cause) {
				setError(
					cause instanceof Error
						? cause.message
						: "Unable to remove this user.",
				);
			}
		}

		setRiskAction(null);
	}

	const riskCopy: Record<
		RiskAction,
		{ title: string; description: string; label: string }
	> = {
		ban: {
			title: "Ban user?",
			description: "This user will no longer be able to sign in to DV-EXAM.",
			label: "Ban user",
		},
		unban: {
			title: "Unban user?",
			description: "This user will be allowed to sign in again.",
			label: "Unban user",
		},
		"revoke-sessions": {
			title: "Revoke all sessions?",
			description: "This signs the user out of every active device.",
			label: "Revoke sessions",
		},
		impersonate: {
			title: "Impersonate user?",
			description:
				"You will switch to this user's account until you end the impersonation session.",
			label: "Continue",
		},
		delete: {
			title: "Delete user?",
			description:
				"This permanently removes the user and their authentication data.",
			label: "Delete user",
		},
	};

	const columns = useMemo<ColumnDef<ManagedUser>[]>(
		() => [
			{
				accessorKey: "name",
				header: ({ column }) => (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Name
						<ArrowUpDownIcon />
					</Button>
				),
				cell: ({ row }) => (
					<div className="flex items-center gap-3">
						<Avatar>
							<AvatarFallback>{userInitials(row.original.name)}</AvatarFallback>
						</Avatar>
						<div className="min-w-0">
							<div className="flex items-center gap-2">
								<span className="truncate font-medium">
									{row.original.name}
								</span>
								{row.original.id === session.user.id ? (
									<Badge variant="outline">You</Badge>
								) : null}
							</div>
							<span className="block truncate text-xs text-muted-foreground sm:hidden">
								{row.original.email}
							</span>
						</div>
					</div>
				),
			},
			{
				accessorKey: "email",
				header: ({ column }) => (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Email
						<ArrowUpDownIcon />
					</Button>
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground">{row.original.email}</span>
				),
			},
			{
				accessorKey: "role",
				header: "Role",
				cell: ({ row }) => (
					<Badge variant="secondary">{roleLabel(row.original.role)}</Badge>
				),
			},
			{
				accessorKey: "banned",
				header: "Status",
				cell: ({ row }) => (
					<Badge variant={row.original.banned ? "destructive" : "outline"}>
						{row.original.banned ? "Banned" : "Active"}
					</Badge>
				),
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => {
					const user = row.original;
					return (
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => selectUser(user)}
						>
							Manage
						</Button>
					);
				},
			},
		],
		[selectUser, session.user.id],
	);
	const table = useReactTable({
		data: users,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		manualSorting: true,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<SidebarProvider>
			<AppSidebar
				user={session.user}
				organizations={organizations}
				activeOrganizationId={activeOrganizationId}
				isOrganizationOwner={isOrganizationOwner}
				organizationRole={organizationRole}
				isImpersonating={Boolean(session.session.impersonatedBy)}
				activeItem="users"
			/>
			<SidebarInset>
				<header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
					<SidebarTrigger className="-ml-1" />
					<Separator
						orientation="vertical"
						className="mr-2 data-vertical:h-4 data-vertical:self-center"
					/>
					<p className="text-sm font-medium">Users</p>
				</header>
				<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
					<div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
							<div className="flex items-start gap-3">
								<div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-card">
									<UserRoundCogIcon className="size-5" />
								</div>
								<div className="space-y-1">
									<p className="text-sm text-muted-foreground">
										Platform Admin
									</p>
									<h1 className="text-2xl font-semibold tracking-tight">
										User management
									</h1>
									<p className="text-sm leading-6 text-muted-foreground">
										Manage accounts, access, and active sessions.
									</p>
								</div>
							</div>
							<Button type="button" onClick={() => setShowCreateUser(true)}>
								<PlusIcon />
								Create user
							</Button>
						</div>

						<section className="overflow-hidden rounded-xl border bg-card">
							<div className="flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center lg:justify-between">
								<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
									<div className="relative w-full sm:w-80">
										<SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
										<Input
											value={search}
											onInput={(event) => setSearch(event.currentTarget.value)}
											placeholder="Search by name or email"
											aria-label="Search users by name or email"
											className="pr-8 pl-8"
										/>
										{search ? (
											<Button
												type="button"
												variant="ghost"
												size="icon-xs"
												className="absolute top-1/2 right-1 -translate-y-1/2"
												onClick={() => setSearch("")}
												aria-label="Clear search"
											>
												<XIcon />
											</Button>
										) : null}
									</div>
									<select
										value={roleFilter}
										onChange={(event) => setRoleFilter(event.target.value)}
										className="h-9 rounded-md border bg-transparent px-3 text-sm"
									>
										<option value="all">All roles</option>
										<option value="admin">Admin</option>
										<option value="user">User</option>
									</select>
									<select
										value={statusFilter}
										onChange={(event) => setStatusFilter(event.target.value)}
										className="h-9 rounded-md border bg-transparent px-3 text-sm"
									>
										<option value="all">All statuses</option>
										<option value="active">Active</option>
										<option value="banned">Banned</option>
									</select>
								</div>
								<div className="flex items-center justify-between gap-2 sm:justify-end">
									<Badge variant="secondary">
										{isSearching
											? "Searching..."
											: search.trim()
												? `${resultTotal} matching ${resultTotal === 1 ? "user" : "users"}`
												: `${resultTotal} ${resultTotal === 1 ? "user" : "users"}`}
									</Badge>
									<Button
										type="button"
										variant="outline"
										size="icon"
										disabled={isSearching}
										onClick={() => {
											if (search) setSearch("");
											else void refreshUsers();
										}}
										aria-label="Refresh users"
									>
										<RefreshCwIcon
											className={isSearching ? "animate-spin" : ""}
										/>
									</Button>
								</div>
							</div>

							{error ? (
								<div
									className="border-b bg-destructive/5 px-4 py-3 text-sm text-destructive"
									role="alert"
								>
									{error}
								</div>
							) : null}

							<div className="overflow-x-auto">
								<table className="w-full min-w-180 text-sm">
									<thead className="border-b bg-muted/50 text-left text-muted-foreground">
										{table.getHeaderGroups().map((headerGroup) => (
											<tr key={headerGroup.id}>
												{headerGroup.headers.map((header) => (
													<th
														key={header.id}
														className="h-11 px-4 font-medium [&:last-child]:text-right"
													>
														{header.isPlaceholder
															? null
															: flexRender(
																	header.column.columnDef.header,
																	header.getContext(),
																)}
													</th>
												))}
											</tr>
										))}
									</thead>
									<tbody className="divide-y">
										{table.getRowModel().rows.length ? (
											table.getRowModel().rows.map((row) => (
												<tr
													key={row.id}
													className="transition-colors hover:bg-muted/40"
												>
													{row.getVisibleCells().map((cell) => (
														<td
															key={cell.id}
															className="p-4 [&:last-child]:text-right"
														>
															{flexRender(
																cell.column.columnDef.cell,
																cell.getContext(),
															)}
														</td>
													))}
												</tr>
											))
										) : (
											<tr>
												<td
													colSpan={columns.length}
													className="h-40 px-4 text-center"
												>
													<div className="mx-auto flex max-w-sm flex-col items-center gap-2">
														<div className="flex size-9 items-center justify-center rounded-lg bg-muted">
															<SearchIcon className="size-4 text-muted-foreground" />
														</div>
														<p className="font-medium">No users found</p>
														<p className="text-sm text-muted-foreground">
															Try a different name or email address.
														</p>
													</div>
												</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>
							<div className="flex items-center justify-between border-t p-4">
								<p className="text-sm text-muted-foreground">
									Page {page} of {pageCount}
								</p>
								<div className="flex gap-2">
									<Button
										variant="outline"
										size="sm"
										disabled={page <= 1 || isSearching}
										onClick={() => {
											const next = page - 1;
											setPage(next);
											void refreshUsers(next);
										}}
									>
										Previous
									</Button>
									<Button
										variant="outline"
										size="sm"
										disabled={page >= pageCount || isSearching}
										onClick={() => {
											const next = page + 1;
											setPage(next);
											void refreshUsers(next);
										}}
									>
										Next
									</Button>
								</div>
							</div>
						</section>

						<Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
							<DialogContent>
								<form onSubmit={createUser} className="grid gap-5">
									<DialogHeader>
										<DialogTitle>Create user</DialogTitle>
										<DialogDescription>
											Create an account with standard user access.
										</DialogDescription>
									</DialogHeader>
									<div className="grid gap-4">
										<label
											htmlFor="create-user-name"
											className="grid gap-2 text-sm font-medium"
										>
											Full name
											<Input
												id="create-user-name"
												value={newUser.name}
												onValueChange={(name) =>
													setNewUser((user) => ({ ...user, name }))
												}
												placeholder="Jane Doe"
												autoComplete="name"
												required
											/>
										</label>
										<label
											htmlFor="create-user-email"
											className="grid gap-2 text-sm font-medium"
										>
											Email address
											<Input
												id="create-user-email"
												value={newUser.email}
												onValueChange={(email) =>
													setNewUser((user) => ({ ...user, email }))
												}
												placeholder="jane@example.com"
												type="email"
												autoComplete="email"
												required
											/>
										</label>
										<label
											htmlFor="create-user-password"
											className="grid gap-2 text-sm font-medium"
										>
											Temporary password
											<Input
												id="create-user-password"
												value={newUser.password}
												onValueChange={(password) =>
													setNewUser((user) => ({ ...user, password }))
												}
												placeholder="Enter a secure password"
												type="password"
												autoComplete="new-password"
												required
											/>
										</label>
										<fieldset className="grid gap-3">
											<legend className="text-sm font-medium">
												Provision access
											</legend>
											<div className="grid grid-cols-2 gap-2">
												<Button
													type="button"
													variant={
														newUser.mode === "workspace" ? "default" : "outline"
													}
													onClick={() =>
														setNewUser((user) => ({
															...user,
															mode: "workspace",
														}))
													}
												>
													Personal workspace
												</Button>
												<Button
													type="button"
													variant={
														newUser.mode === "organization"
															? "default"
															: "outline"
													}
													onClick={() =>
														setNewUser((user) => ({
															...user,
															mode: "organization",
														}))
													}
												>
													Existing organization
												</Button>
											</div>
										</fieldset>
										{newUser.mode === "organization" ? (
											<div className="grid gap-3 sm:grid-cols-2">
												<label
													htmlFor="ban-reason"
													className="grid gap-2 text-sm font-medium"
												>
													Organization
													<select
														value={newUser.organizationId}
														onChange={(event) =>
															setNewUser((user) => ({
																...user,
																organizationId: event.target.value,
															}))
														}
														className="h-9 rounded-md border bg-transparent px-3 text-sm"
													>
														{provisioningOrganizations.map((organization) => (
															<option
																key={organization.id}
																value={organization.id}
															>
																{organization.name}
															</option>
														))}
													</select>
												</label>
												<label className="grid gap-2 text-sm font-medium">
													Role
													<select
														value={newUser.organizationRole}
														onChange={(event) =>
															setNewUser((user) => ({
																...user,
																organizationRole: event.target.value as
																	| "admin"
																	| "teacher"
																	| "student",
															}))
														}
														className="h-9 rounded-md border bg-transparent px-3 text-sm"
													>
														<option value="admin">Admin</option>
														<option value="teacher">Teacher</option>
														<option value="student">Student</option>
													</select>
												</label>
											</div>
										) : (
											<p className="text-sm text-muted-foreground">
												A personal workspace will be created with this user as
												owner and the default plan.
											</p>
										)}
									</div>
									<DialogFooter showCloseButton>
										<Button type="submit" disabled={isSaving}>
											{isSaving ? "Creating..." : "Create user"}
										</Button>
									</DialogFooter>
								</form>
							</DialogContent>
						</Dialog>

						<Dialog
							open={selectedUser !== null}
							onOpenChange={(open) => !open && setSelectedUser(null)}
						>
							<DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
								{selectedUser ? (
									<>
										<div className="flex items-start gap-3 pr-8">
											<Avatar size="lg">
												<AvatarFallback>
													{userInitials(selectedUser.name)}
												</AvatarFallback>
											</Avatar>
											<DialogHeader className="min-w-0 flex-1 gap-1">
												<div className="flex flex-wrap items-center gap-2">
													<DialogTitle>{selectedUser.name}</DialogTitle>
													<Badge variant="secondary">
														{roleLabel(selectedUser.role)}
													</Badge>
													<Badge
														variant={
															selectedUser.banned ? "destructive" : "outline"
														}
													>
														{selectedUser.banned ? "Banned" : "Active"}
													</Badge>
												</div>
												<DialogDescription className="truncate">
													{selectedUser.email}
												</DialogDescription>
											</DialogHeader>
										</div>

										{error ? (
											<div
												className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
												role="alert"
											>
												{error}
											</div>
										) : null}

										<div className="grid gap-4 md:grid-cols-2">
											<section className="rounded-xl border p-4">
												<div className="mb-4 flex items-center gap-2">
													<UserRoundCogIcon className="size-4 text-muted-foreground" />
													<h2 className="font-medium">Account details</h2>
												</div>
												<form className="grid gap-3" onSubmit={saveUserName}>
													<label
														htmlFor="manage-user-name"
														className="grid gap-2 text-sm font-medium"
													>
														Full name
														<Input
															id="manage-user-name"
															value={selectedName}
															onValueChange={setSelectedName}
															required
														/>
													</label>
													<Button
														type="submit"
														variant="outline"
														disabled={
															isSaving || selectedName === selectedUser.name
														}
													>
														Save changes
													</Button>
												</form>
											</section>

											<section className="rounded-xl border p-4">
												<div className="mb-4 flex items-center gap-2">
													<ShieldCheckIcon className="size-4 text-muted-foreground" />
													<h2 className="font-medium">Access role</h2>
												</div>
												<p className="mb-3 text-sm text-muted-foreground">
													{selectedUser.role?.split(",").includes("admin")
														? "Can manage platform users and organizations."
														: "Has standard access to their workspace."}
												</p>
												<Button
													type="button"
													variant="outline"
													disabled={
														updatingUserId === selectedUser.id ||
														selectedUser.id === session.user.id
													}
													onClick={() =>
														updateRole(
															selectedUser.id,
															selectedUser.role?.split(",").includes("admin")
																? "user"
																: "admin",
														)
													}
												>
													{selectedUser.role?.split(",").includes("admin")
														? "Change to user"
														: "Make platform admin"}
												</Button>
												{selectedUser.id === session.user.id ? (
													<p className="mt-2 text-xs text-muted-foreground">
														You cannot change your own role.
													</p>
												) : null}
											</section>
										</div>

										<section className="rounded-xl border p-4">
											<div className="mb-4 flex items-center justify-between gap-3">
												<div className="flex items-center gap-2">
													<MonitorIcon className="size-4 text-muted-foreground" />
													<h2 className="font-medium">Active sessions</h2>
												</div>
												<div className="flex gap-2">
													<Button
														type="button"
														variant="outline"
														size="sm"
														onClick={loadSessions}
														disabled={isSaving}
													>
														{sessionsLoaded ? "Refresh" : "Load sessions"}
													</Button>
													<Button
														type="button"
														variant="outline"
														size="sm"
														onClick={() => setRiskAction("revoke-sessions")}
														disabled={sessions.length === 0 || isSaving}
													>
														Revoke all
													</Button>
												</div>
											</div>
											{sessions.length ? (
												<div className="grid gap-2">
													{sessions.map((userSession) => (
														<div
															key={userSession.id}
															className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3"
														>
															<div className="min-w-0">
																<p className="text-sm font-medium">
																	Signed-in session
																</p>
																<p className="truncate text-xs text-muted-foreground">
																	Expires{" "}
																	{new Intl.DateTimeFormat("en-MY", {
																		dateStyle: "medium",
																		timeStyle: "short",
																		timeZone: "Asia/Kuala_Lumpur",
																	}).format(new Date(userSession.expiresAt))}
																</p>
															</div>
															<Button
																type="button"
																variant="outline"
																size="sm"
																onClick={() => revokeSession(userSession.token)}
																disabled={isSaving}
															>
																Revoke
															</Button>
														</div>
													))}
												</div>
											) : (
												<p className="text-sm text-muted-foreground">
													{sessionsLoaded
														? "No active sessions found."
														: "Load this user's sessions to review their active devices."}
												</p>
											)}
										</section>

										<section className="rounded-xl border p-4">
											<div className="mb-3 flex items-center gap-2">
												<KeyRoundIcon className="size-4 text-muted-foreground" />
												<h2 className="font-medium">Security actions</h2>
											</div>
											<div className="grid gap-3 md:grid-cols-[1fr_auto]">
												<form className="flex gap-2" onSubmit={resetPassword}>
													<Input
														value={password}
														onValueChange={setPassword}
														type="password"
														placeholder="New password"
														autoComplete="new-password"
														required
													/>
													<Button
														type="submit"
														variant="outline"
														disabled={isSaving || !password}
													>
														Reset password
													</Button>
												</form>
												<div className="flex flex-wrap gap-2">
													<Button
														type="button"
														variant="outline"
														onClick={() =>
															setRiskAction(
																selectedUser.banned ? "unban" : "ban",
															)
														}
														disabled={
															isSaving || selectedUser.id === session.user.id
														}
													>
														{selectedUser.banned ? "Unban user" : "Ban user"}
													</Button>
													<Button
														type="button"
														variant="outline"
														onClick={() => setRiskAction("impersonate")}
														disabled={
															isSaving || selectedUser.id === session.user.id
														}
													>
														Impersonate
													</Button>
													<Button
														type="button"
														variant="destructive"
														onClick={() => setRiskAction("delete")}
														disabled={
															isSaving || selectedUser.id === session.user.id
														}
													>
														<Trash2Icon />
														Delete
													</Button>
												</div>
											</div>
										</section>
									</>
								) : null}
							</DialogContent>
						</Dialog>

						<AlertDialog
							open={riskAction !== null}
							onOpenChange={(open) => !open && setRiskAction(null)}
						>
							<AlertDialogContent>
								{riskAction ? (
									<>
										<AlertDialogHeader>
											<AlertDialogTitle>
												{riskCopy[riskAction].title}
											</AlertDialogTitle>
											<AlertDialogDescription>
												{riskCopy[riskAction].description}
											</AlertDialogDescription>
										</AlertDialogHeader>
										{riskAction === "ban" ? (
											<div className="grid gap-4">
												<label
													htmlFor="ban-reason"
													className="grid gap-2 text-sm font-medium"
												>
													Reason
													<Input
														id="ban-reason"
														value={banReason}
														onValueChange={setBanReason}
														placeholder="Reason for banning this user"
													/>
												</label>
												<label
													htmlFor="ban-expiry"
													className="grid gap-2 text-sm font-medium"
												>
													Expiry
													<select
														id="ban-expiry"
														value={banDuration}
														onChange={(event) =>
															setBanDuration(
																event.target.value as typeof banDuration,
															)
														}
														className="h-9 rounded-md border bg-transparent px-3 text-sm"
													>
														<option value="24h">24 hours</option>
														<option value="7d">7 days</option>
														<option value="30d">30 days</option>
														<option value="permanent">Permanent</option>
													</select>
												</label>
											</div>
										) : null}
										<AlertDialogFooter>
											<AlertDialogCancel>Cancel</AlertDialogCancel>
											<AlertDialogAction
												variant={
													riskAction === "delete" ? "destructive" : "default"
												}
												disabled={
													riskAction === "ban" && banReason.trim().length < 3
												}
												onClick={confirmRiskAction}
											>
												{riskCopy[riskAction].label}
											</AlertDialogAction>
										</AlertDialogFooter>
									</>
								) : null}
							</AlertDialogContent>
						</AlertDialog>
					</div>
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
