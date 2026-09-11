import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	type OnChangeFn,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import {
	ArrowUpDownIcon,
	Building2Icon,
	ChevronLeftIcon,
	ChevronRightIcon,
	ChevronsUpDownIcon,
	CrownIcon,
	RefreshCwIcon,
	SearchIcon,
	Trash2Icon,
	UserPlusIcon,
	UsersRoundIcon,
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
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	addAdminOrganizationMember,
	deleteAdminOrganization,
	getAdminOrganization,
	listAdminOrganizations,
	type OrganizationMemberRole,
	type OrganizationSortField,
	removeAdminOrganizationMember,
	searchAvailableOrganizationUsers,
	transferAdminOrganizationOwnership,
	updateAdminOrganization,
	updateAdminOrganizationMemberRole,
} from "@/lib/admin-organizations";
import { formatOrganizationRole } from "@/lib/organization-permissions";
import { getDashboardSession } from "@/lib/session";

const PAGE_SIZE = 25;

export const Route = createFileRoute("/admin/organizations")({
	beforeLoad: async () => {
		const dashboard = await getDashboardSession();

		if (!dashboard) throw redirect({ to: "/login" });
		if (!dashboard.session.user.role?.split(",").includes("admin")) {
			throw redirect({ to: "/dashboard" });
		}

		const initialOrganizations = await listAdminOrganizations({
			data: {
				page: 1,
				pageSize: PAGE_SIZE,
				sortBy: "createdAt",
				sortDirection: "desc",
			},
		});

		return { ...dashboard, initialOrganizations };
	},
	component: OrganizationManagement,
});

type OrganizationListResult = Awaited<
	ReturnType<typeof listAdminOrganizations>
>;
type ManagedOrganization = OrganizationListResult["organizations"][number];
type OrganizationDetails = Awaited<ReturnType<typeof getAdminOrganization>>;
type ManagedMember = OrganizationDetails["members"][number];
type AvailableUser = Awaited<
	ReturnType<typeof searchAvailableOrganizationUsers>
>[number];

type MemberRiskAction = {
	type: "remove" | "transfer";
	member: ManagedMember;
};

function initials(name: string) {
	return name
		.split(" ")
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0])
		.join("")
		.toUpperCase();
}

function formatDate(value: Date | string) {
	return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
		new Date(value),
	);
}

function getErrorMessage(error: unknown, fallback: string) {
	return error instanceof Error && error.message ? error.message : fallback;
}

function RolePicker({
	value,
	onValueChange,
	disabled,
}: {
	value: OrganizationMemberRole;
	onValueChange: (role: OrganizationMemberRole) => void;
	disabled?: boolean;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				disabled={disabled}
				render={<Button type="button" variant="outline" size="sm" />}
			>
				{formatOrganizationRole(value)}
				<ChevronsUpDownIcon />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-36">
				<DropdownMenuRadioGroup
					value={value}
					onValueChange={(role) =>
						onValueChange(role as OrganizationMemberRole)
					}
				>
					<DropdownMenuRadioItem value="admin">Admin</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="teacher">Teacher</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="student">Student</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function OrganizationManagement() {
	const {
		session,
		organizations: userOrganizations,
		activeOrganizationId,
		isOrganizationOwner,
		organizationRole,
		initialOrganizations,
	} = Route.useRouteContext();
	const [organizations, setOrganizations] = useState(
		initialOrganizations.organizations,
	);
	const [total, setTotal] = useState(initialOrganizations.total);
	const [pageCount, setPageCount] = useState(initialOrganizations.pageCount);
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [sortBy, setSortBy] = useState<OrganizationSortField>("createdAt");
	const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
	const [isLoading, setIsLoading] = useState(false);
	const [pageError, setPageError] = useState<string | null>(null);
	const listRequest = useRef(0);

	const [isManageOpen, setIsManageOpen] = useState(false);
	const [selectedOrganization, setSelectedOrganization] =
		useState<ManagedOrganization | null>(null);
	const [details, setDetails] = useState<OrganizationDetails | null>(null);
	const [isDetailsLoading, setIsDetailsLoading] = useState(false);
	const detailsRequest = useRef(0);
	const [dialogError, setDialogError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [organizationName, setOrganizationName] = useState("");
	const [organizationSlug, setOrganizationSlug] = useState("");

	const [memberSearch, setMemberSearch] = useState("");
	const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
	const [isSearchingUsers, setIsSearchingUsers] = useState(false);
	const availableUsersRequest = useRef(0);
	const [newMemberRole, setNewMemberRole] =
		useState<OrganizationMemberRole>("student");

	const [memberRiskAction, setMemberRiskAction] =
		useState<MemberRiskAction | null>(null);
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const [deleteConfirmation, setDeleteConfirmation] = useState("");

	const loadOrganizations = useCallback(async () => {
		const requestId = ++listRequest.current;
		setIsLoading(true);
		setPageError(null);

		try {
			const result = await listAdminOrganizations({
				data: {
					search,
					page,
					pageSize: PAGE_SIZE,
					sortBy,
					sortDirection,
				},
			});

			if (requestId !== listRequest.current) return;
			if (page > result.pageCount) {
				setPage(result.pageCount);
				return;
			}

			setOrganizations(result.organizations);
			setTotal(result.total);
			setPageCount(result.pageCount);
		} catch (error) {
			if (requestId === listRequest.current) {
				setPageError(getErrorMessage(error, "Unable to load organizations."));
			}
		} finally {
			if (requestId === listRequest.current) setIsLoading(false);
		}
	}, [page, search, sortBy, sortDirection]);

	useEffect(() => {
		const timeout = window.setTimeout(() => void loadOrganizations(), 300);
		return () => window.clearTimeout(timeout);
	}, [loadOrganizations]);

	const applyDetails = useCallback((nextDetails: OrganizationDetails) => {
		setDetails(nextDetails);
		setOrganizationName(nextDetails.organization.name);
		setOrganizationSlug(nextDetails.organization.slug);
		setSelectedOrganization((current) =>
			current
				? {
						...current,
						name: nextDetails.organization.name,
						slug: nextDetails.organization.slug,
						memberCount: nextDetails.members.length,
						ownerId: nextDetails.owner?.userId ?? null,
						ownerName: nextDetails.owner?.name ?? null,
						ownerEmail: nextDetails.owner?.email ?? null,
					}
				: current,
		);
	}, []);

	const openOrganization = useCallback(
		async (organization: ManagedOrganization) => {
			const requestId = ++detailsRequest.current;
			setSelectedOrganization(organization);
			setDetails(null);
			setDialogError(null);
			setMemberSearch("");
			setAvailableUsers([]);
			setNewMemberRole("student");
			setIsManageOpen(true);
			setIsDetailsLoading(true);

			try {
				const result = await getAdminOrganization({
					data: { organizationId: organization.id },
				});
				if (requestId === detailsRequest.current) applyDetails(result);
			} catch (error) {
				if (requestId === detailsRequest.current) {
					setDialogError(
						getErrorMessage(error, "Unable to load this organization."),
					);
				}
			} finally {
				if (requestId === detailsRequest.current) setIsDetailsLoading(false);
			}
		},
		[applyDetails],
	);

	useEffect(() => {
		const query = memberSearch.trim();
		const organizationId = selectedOrganization?.id;
		const requestId = ++availableUsersRequest.current;

		if (!organizationId || query.length < 2) {
			setAvailableUsers([]);
			setIsSearchingUsers(false);
			return;
		}

		const timeout = window.setTimeout(async () => {
			setIsSearchingUsers(true);
			try {
				const result = await searchAvailableOrganizationUsers({
					data: { organizationId, search: query },
				});
				if (requestId === availableUsersRequest.current) {
					setAvailableUsers(result);
				}
			} catch (error) {
				if (requestId === availableUsersRequest.current) {
					setDialogError(getErrorMessage(error, "Unable to search users."));
				}
			} finally {
				if (requestId === availableUsersRequest.current) {
					setIsSearchingUsers(false);
				}
			}
		}, 300);

		return () => window.clearTimeout(timeout);
	}, [memberSearch, selectedOrganization?.id]);

	async function saveOrganization(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!selectedOrganization) return;
		setIsSaving(true);
		setDialogError(null);

		try {
			const result = await updateAdminOrganization({
				data: {
					organizationId: selectedOrganization.id,
					name: organizationName,
					slug: organizationSlug,
				},
			});
			applyDetails(result);
			await loadOrganizations();
		} catch (error) {
			setDialogError(getErrorMessage(error, "Unable to save changes."));
		} finally {
			setIsSaving(false);
		}
	}

	async function addMember(userId: string) {
		if (!selectedOrganization) return;
		setIsSaving(true);
		setDialogError(null);

		try {
			const result = await addAdminOrganizationMember({
				data: {
					organizationId: selectedOrganization.id,
					userId,
					role: newMemberRole,
				},
			});
			applyDetails(result);
			setMemberSearch("");
			setAvailableUsers([]);
			await loadOrganizations();
		} catch (error) {
			setDialogError(getErrorMessage(error, "Unable to add this member."));
		} finally {
			setIsSaving(false);
		}
	}

	async function updateMemberRole(
		memberId: string,
		role: OrganizationMemberRole,
	) {
		if (!selectedOrganization) return;
		setIsSaving(true);
		setDialogError(null);

		try {
			const result = await updateAdminOrganizationMemberRole({
				data: {
					organizationId: selectedOrganization.id,
					memberId,
					role,
				},
			});
			applyDetails(result);
		} catch (error) {
			setDialogError(
				getErrorMessage(error, "Unable to update this member's role."),
			);
		} finally {
			setIsSaving(false);
		}
	}

	async function confirmMemberRiskAction() {
		if (!selectedOrganization || !memberRiskAction) return;
		setIsSaving(true);
		setDialogError(null);

		try {
			const request = {
				organizationId: selectedOrganization.id,
				memberId: memberRiskAction.member.id,
			};
			const result =
				memberRiskAction.type === "transfer"
					? await transferAdminOrganizationOwnership({ data: request })
					: await removeAdminOrganizationMember({ data: request });
			applyDetails(result);
			setMemberRiskAction(null);
			await loadOrganizations();
		} catch (error) {
			setDialogError(
				getErrorMessage(error, "Unable to update this organization."),
			);
		} finally {
			setIsSaving(false);
		}
	}

	async function confirmDeleteOrganization() {
		if (!selectedOrganization) return;
		setIsSaving(true);
		setDialogError(null);

		try {
			await deleteAdminOrganization({
				data: {
					organizationId: selectedOrganization.id,
					confirmationName: deleteConfirmation,
				},
			});
			setIsDeleteOpen(false);
			setIsManageOpen(false);
			setSelectedOrganization(null);
			setDetails(null);
			setDeleteConfirmation("");
			if (page === 1) await loadOrganizations();
			else setPage(1);
		} catch (error) {
			setDialogError(getErrorMessage(error, "Unable to delete organization."));
			setIsDeleteOpen(false);
		} finally {
			setIsSaving(false);
		}
	}

	const sorting = useMemo<SortingState>(
		() => [{ id: sortBy, desc: sortDirection === "desc" }],
		[sortBy, sortDirection],
	);
	const onSortingChange: OnChangeFn<SortingState> = (updater) => {
		const next = typeof updater === "function" ? updater(sorting) : updater;
		const primary = next[0];
		if (!primary) return;
		setSortBy(primary.id as OrganizationSortField);
		setSortDirection(primary.desc ? "desc" : "asc");
		setPage(1);
	};

	const columns = useMemo<ColumnDef<ManagedOrganization>[]>(
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
						Organization
						<ArrowUpDownIcon />
					</Button>
				),
				cell: ({ row }) => (
					<div className="flex items-center gap-3">
						<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
							<Building2Icon className="size-4" />
						</div>
						<div className="min-w-0">
							<p className="truncate font-medium">{row.original.name}</p>
							<p className="truncate text-xs text-muted-foreground">
								{row.original.slug}
							</p>
						</div>
					</div>
				),
			},
			{
				id: "owner",
				header: ({ column }) => (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Owner
						<ArrowUpDownIcon />
					</Button>
				),
				cell: ({ row }) =>
					row.original.ownerName ? (
						<div className="min-w-0">
							<p className="truncate">{row.original.ownerName}</p>
							<p className="truncate text-xs text-muted-foreground">
								{row.original.ownerEmail}
							</p>
						</div>
					) : (
						<Badge variant="destructive">No owner</Badge>
					),
			},
			{
				accessorKey: "memberCount",
				header: ({ column }) => (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Members
						<ArrowUpDownIcon />
					</Button>
				),
				cell: ({ row }) => row.original.memberCount,
			},
			{
				accessorKey: "createdAt",
				header: ({ column }) => (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Created
						<ArrowUpDownIcon />
					</Button>
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground">
						{formatDate(row.original.createdAt)}
					</span>
				),
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => (
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => void openOrganization(row.original)}
					>
						Manage
					</Button>
				),
				enableSorting: false,
			},
		],
		[openOrganization],
	);

	const table = useReactTable({
		data: organizations,
		columns,
		state: { sorting },
		onSortingChange,
		manualSorting: true,
		getCoreRowModel: getCoreRowModel(),
	});

	const organizationChanged =
		details !== null &&
		(organizationName !== details.organization.name ||
			organizationSlug !== details.organization.slug);

	return (
		<SidebarProvider>
			<AppSidebar
				user={session.user}
				organizations={userOrganizations}
				activeOrganizationId={activeOrganizationId}
				isOrganizationOwner={isOrganizationOwner}
				organizationRole={organizationRole}
				isImpersonating={Boolean(session.session.impersonatedBy)}
				activeItem="organizations"
			/>
			<SidebarInset>
				<header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
					<SidebarTrigger className="-ml-1" />
					<Separator
						orientation="vertical"
						className="mr-2 data-vertical:h-4 data-vertical:self-center"
					/>
					<p className="text-sm font-medium">Organizations</p>
				</header>

				<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
					<div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
						<div className="flex items-start gap-3">
							<div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-card">
								<Building2Icon className="size-5" />
							</div>
							<div className="space-y-1">
								<p className="text-sm text-muted-foreground">Platform Admin</p>
								<h1 className="text-2xl font-semibold tracking-tight">
									Organization management
								</h1>
								<p className="text-sm leading-6 text-muted-foreground">
									Manage workspace details, ownership, and members.
								</p>
							</div>
						</div>

						<section className="overflow-hidden rounded-xl border bg-card">
							<div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
								<div className="relative w-full sm:max-w-sm">
									<SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
									<Input
										value={search}
										onValueChange={(value) => {
											setSearch(value);
											setPage(1);
										}}
										placeholder="Search organizations or owners"
										aria-label="Search organizations by name, slug, or owner"
										className="pr-8 pl-8"
									/>
									{search ? (
										<Button
											type="button"
											variant="ghost"
											size="icon-xs"
											className="absolute top-1/2 right-1 -translate-y-1/2"
											onClick={() => {
												setSearch("");
												setPage(1);
											}}
											aria-label="Clear organization search"
										>
											<XIcon />
										</Button>
									) : null}
								</div>
								<div className="flex items-center justify-between gap-2 sm:justify-end">
									<Badge variant="secondary">
										{isLoading
											? "Loading..."
											: `${total} ${total === 1 ? "organization" : "organizations"}`}
									</Badge>
									<Button
										type="button"
										variant="outline"
										size="icon"
										disabled={isLoading}
										onClick={() => void loadOrganizations()}
										aria-label="Refresh organizations"
									>
										<RefreshCwIcon
											className={isLoading ? "animate-spin" : ""}
										/>
									</Button>
								</div>
							</div>

							{pageError ? (
								<div
									className="border-b bg-destructive/5 px-4 py-3 text-sm text-destructive"
									role="alert"
								>
									{pageError}
								</div>
							) : null}

							<div className="overflow-x-auto">
								<table className="w-full min-w-220 text-sm">
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
													className="h-44 px-4 text-center"
												>
													<div className="mx-auto flex max-w-sm flex-col items-center gap-2">
														<div className="flex size-9 items-center justify-center rounded-lg bg-muted">
															<SearchIcon className="size-4 text-muted-foreground" />
														</div>
														<p className="font-medium">
															No organizations found
														</p>
														<p className="text-sm text-muted-foreground">
															Try a different organization or owner.
														</p>
													</div>
												</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>

							<div className="flex items-center justify-between gap-4 border-t px-4 py-3">
								<p className="text-sm text-muted-foreground">
									Page {page} of {pageCount}
								</p>
								<div className="flex gap-2">
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={page <= 1 || isLoading}
										onClick={() =>
											setPage((current) => Math.max(1, current - 1))
										}
									>
										<ChevronLeftIcon />
										Previous
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={page >= pageCount || isLoading}
										onClick={() => setPage((current) => current + 1)}
									>
										Next
										<ChevronRightIcon />
									</Button>
								</div>
							</div>
						</section>
					</div>
				</main>
			</SidebarInset>

			<Dialog
				open={isManageOpen}
				onOpenChange={(open) => {
					setIsManageOpen(open);
					if (!open) {
						setSelectedOrganization(null);
						setDetails(null);
						setDialogError(null);
					}
				}}
			>
				<DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-4xl">
					<DialogHeader>
						<DialogTitle>
							{selectedOrganization?.name ?? "Manage organization"}
						</DialogTitle>
						<DialogDescription>
							Review organization details, ownership, and member access.
						</DialogDescription>
					</DialogHeader>

					{dialogError ? (
						<div
							className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
							role="alert"
						>
							{dialogError}
						</div>
					) : null}

					{isDetailsLoading ? (
						<div className="grid gap-4 py-2">
							<Skeleton className="h-9 w-full" />
							<Skeleton className="h-48 w-full" />
						</div>
					) : !details ? (
						<div className="rounded-xl border p-6 text-center">
							<p className="font-medium">
								Organization details are unavailable
							</p>
							<p className="mt-1 text-sm text-muted-foreground">
								Close this dialog and try again.
							</p>
						</div>
					) : (
						<Tabs
							key={details.organization.id}
							defaultValue="general"
							className="gap-5"
						>
							<TabsList variant="line" className="w-full justify-start">
								<TabsTrigger value="general">General</TabsTrigger>
								<TabsTrigger value="members">
									Members
									<Badge variant="secondary">{details.members.length}</Badge>
								</TabsTrigger>
							</TabsList>

							<TabsContent value="general" className="grid gap-4">
								<section className="rounded-xl border p-4 sm:p-5">
									<form className="grid gap-4" onSubmit={saveOrganization}>
										<div className="grid gap-4 sm:grid-cols-2">
											<label
												htmlFor="organization-name"
												className="grid gap-2 text-sm font-medium"
											>
												Organization name
												<Input
													id="organization-name"
													value={organizationName}
													onValueChange={(value) => {
														setOrganizationName(value);
														setDialogError(null);
													}}
													minLength={2}
													maxLength={80}
													required
												/>
											</label>
											<label
												htmlFor="organization-slug"
												className="grid gap-2 text-sm font-medium"
											>
												Slug
												<Input
													id="organization-slug"
													value={organizationSlug}
													onValueChange={(value) => {
														setOrganizationSlug(value);
														setDialogError(null);
													}}
													minLength={2}
													maxLength={64}
													pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
													required
												/>
											</label>
										</div>
										<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
											<p className="text-sm text-muted-foreground">
												Created {formatDate(details.organization.createdAt)}
											</p>
											<Button
												type="submit"
												disabled={isSaving || !organizationChanged}
											>
												{isSaving ? "Saving..." : "Save changes"}
											</Button>
										</div>
									</form>
								</section>

								<section className="rounded-xl border border-destructive/40 p-4 sm:p-5">
									<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
										<div className="space-y-1">
											<p className="font-medium">Delete organization</p>
											<p className="text-sm text-muted-foreground">
												Remove the organization, memberships, and invitations.
												User accounts are kept.
											</p>
										</div>
										<Button
											type="button"
											variant="destructive"
											onClick={() => {
												setDeleteConfirmation("");
												setIsDeleteOpen(true);
											}}
										>
											<Trash2Icon />
											Delete organization
										</Button>
									</div>
								</section>
							</TabsContent>

							<TabsContent value="members" className="grid gap-4">
								<section className="rounded-xl border p-4 sm:p-5">
									<div className="mb-4 flex items-start gap-3">
										<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
											<UserPlusIcon className="size-4" />
										</div>
										<div className="space-y-1">
											<p className="font-medium">Add existing user</p>
											<p className="text-sm text-muted-foreground">
												Search by name or email, then assign an organization
												role.
											</p>
										</div>
									</div>
									<div className="flex flex-col gap-2 sm:flex-row">
										<div className="relative min-w-0 flex-1">
											<SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
											<Input
												value={memberSearch}
												onValueChange={(value) => {
													setMemberSearch(value);
													setDialogError(null);
												}}
												placeholder="Search existing users"
												aria-label="Search users to add"
												className="pl-8"
											/>
										</div>
										<RolePicker
											value={newMemberRole}
											onValueChange={setNewMemberRole}
											disabled={isSaving}
										/>
									</div>

									{memberSearch.trim().length >= 2 ? (
										<div className="mt-3 overflow-hidden rounded-lg border">
											{isSearchingUsers ? (
												<div className="p-3 text-sm text-muted-foreground">
													Searching...
												</div>
											) : availableUsers.length ? (
												<div className="divide-y">
													{availableUsers.map((user) => (
														<div
															key={user.id}
															className="flex items-center justify-between gap-3 p-3"
														>
															<div className="min-w-0">
																<p className="truncate font-medium">
																	{user.name}
																</p>
																<p className="truncate text-xs text-muted-foreground">
																	{user.email}
																</p>
															</div>
															<Button
																type="button"
																size="sm"
																disabled={isSaving}
																onClick={() => void addMember(user.id)}
															>
																Add
															</Button>
														</div>
													))}
												</div>
											) : (
												<div className="p-3 text-sm text-muted-foreground">
													No available users found.
												</div>
											)}
										</div>
									) : null}
								</section>

								<section className="overflow-hidden rounded-xl border">
									<div className="flex items-center gap-2 border-b px-4 py-3">
										<UsersRoundIcon className="size-4 text-muted-foreground" />
										<p className="font-medium">Organization members</p>
									</div>
									<div className="divide-y">
										{details.members.map((member) => {
											const isOwner = member.role.split(",").includes("owner");
											const currentRole = isOwner
												? null
												: (member.role.split(",")[0] as OrganizationMemberRole);

											return (
												<div
													key={member.id}
													className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
												>
													<div className="flex min-w-0 items-center gap-3">
														<Avatar>
															<AvatarFallback>
																{initials(member.name)}
															</AvatarFallback>
														</Avatar>
														<div className="min-w-0">
															<div className="flex flex-wrap items-center gap-2">
																<p className="truncate font-medium">
																	{member.name}
																</p>
																{isOwner ? (
																	<Badge variant="secondary">Owner</Badge>
																) : null}
															</div>
															<p className="truncate text-xs text-muted-foreground">
																{member.email}
															</p>
														</div>
													</div>
													{isOwner ? null : (
														<div className="flex flex-wrap gap-2 sm:justify-end">
															{currentRole ? (
																<RolePicker
																	value={currentRole}
																	onValueChange={(role) =>
																		void updateMemberRole(member.id, role)
																	}
																	disabled={isSaving}
																/>
															) : null}
															<Button
																type="button"
																variant="outline"
																size="sm"
																disabled={isSaving}
																onClick={() =>
																	setMemberRiskAction({
																		type: "transfer",
																		member,
																	})
																}
															>
																<CrownIcon />
																Transfer ownership
															</Button>
															<Button
																type="button"
																variant="ghost"
																size="sm"
																disabled={isSaving}
																onClick={() =>
																	setMemberRiskAction({
																		type: "remove",
																		member,
																	})
																}
															>
																<Trash2Icon />
																Remove
															</Button>
														</div>
													)}
												</div>
											);
										})}
									</div>
								</section>
							</TabsContent>
						</Tabs>
					)}
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={memberRiskAction !== null}
				onOpenChange={(open) => !open && setMemberRiskAction(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{memberRiskAction?.type === "transfer"
								? "Transfer ownership?"
								: "Remove member?"}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{memberRiskAction?.type === "transfer"
								? `${memberRiskAction.member.name} will become the only owner. The current owner will become an organization admin.`
								: `${memberRiskAction?.member.name} will lose access to this organization.`}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							type="button"
							variant={
								memberRiskAction?.type === "remove" ? "destructive" : "default"
							}
							disabled={isSaving}
							onClick={() => void confirmMemberRiskAction()}
						>
							{isSaving
								? "Updating..."
								: memberRiskAction?.type === "transfer"
									? "Transfer ownership"
									: "Remove member"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				open={isDeleteOpen}
				onOpenChange={(open) => {
					setIsDeleteOpen(open);
					if (!open) setDeleteConfirmation("");
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete organization?</AlertDialogTitle>
						<AlertDialogDescription>
							This permanently removes the organization, memberships, and
							invitations. User accounts will be kept.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<label
						htmlFor="delete-organization-confirmation"
						className="grid gap-2 text-sm font-medium"
					>
						Type {selectedOrganization?.name} to confirm
						<Input
							id="delete-organization-confirmation"
							value={deleteConfirmation}
							onValueChange={setDeleteConfirmation}
							autoComplete="off"
						/>
					</label>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							type="button"
							variant="destructive"
							disabled={
								isSaving || deleteConfirmation !== selectedOrganization?.name
							}
							onClick={() => void confirmDeleteOrganization()}
						>
							{isSaving ? "Deleting..." : "Delete organization"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</SidebarProvider>
	);
}
