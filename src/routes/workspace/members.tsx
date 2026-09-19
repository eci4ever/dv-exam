import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { MoreHorizontalIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { WorkspaceShell } from "@/components/workspace-shell";
import { getDashboardSession } from "@/lib/session";
import {
	listWorkspaceMembers,
	removeWorkspaceMember,
	transferWorkspaceOwnership,
	updateWorkspaceMemberRole,
} from "@/lib/workspace-members";

export const Route = createFileRoute("/workspace/members")({
	beforeLoad: async () => {
		const data = await getDashboardSession();
		if (!data) throw redirect({ to: "/login" });
		if (
			!data.organizationRole
				?.split(",")
				.some((role) => role === "owner" || role === "admin") ||
			data.entitlement?.status === "suspended"
		)
			throw redirect({ to: "/dashboard" });
		return data;
	},
	component: MembersPage,
});

type MemberResult = Awaited<ReturnType<typeof listWorkspaceMembers>>;
type MemberRow = MemberResult["rows"][number];

function MembersPage() {
	const data = Route.useRouteContext();
	const [result, setResult] = useState<MemberResult | null>(null);
	const [search, setSearch] = useState("");
	const [role, setRole] = useState("all");
	const [page, setPage] = useState(1);
	const [selected, setSelected] = useState<MemberRow | null>(null);
	const [selectedRole, setSelectedRole] = useState("student");
	const [danger, setDanger] = useState<"remove" | "transfer" | null>(null);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const load = useCallback(
		async (nextPage = page) => {
			setError(null);
			try {
				setResult(
					await listWorkspaceMembers({
						data: { search, role, page: nextPage },
					}),
				);
			} catch (caught) {
				setError(
					caught instanceof Error ? caught.message : "Unable to load members.",
				);
			}
		},
		[page, role, search],
	);
	useEffect(() => {
		const timer = window.setTimeout(() => {
			setPage(1);
			void load(1);
		}, 300);
		return () => window.clearTimeout(timer);
	}, [load]);
	const manage = useCallback((member: MemberRow) => {
		setSelected(member);
		setSelectedRole(member.role);
	}, []);
	const columns = useMemo<ColumnDef<MemberRow>[]>(
		() => [
			{
				accessorKey: "name",
				header: "Member",
				cell: ({ row }) => (
					<div>
						<p className="font-medium">{row.original.name}</p>
						<p className="text-xs text-muted-foreground">
							{row.original.email}
						</p>
					</div>
				),
			},
			{
				accessorKey: "role",
				header: "Role",
				cell: ({ row }) => (
					<Badge
						variant={row.original.role === "owner" ? "default" : "secondary"}
					>
						{row.original.role}
					</Badge>
				),
			},
			{
				accessorKey: "createdAt",
				header: "Joined",
				cell: ({ row }) =>
					new Date(row.original.createdAt).toLocaleDateString(),
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => (
					<div className="text-right">
						{row.original.role !== "owner" ? (
							<Button
								size="icon-sm"
								variant="ghost"
								aria-label={`Manage ${row.original.name}`}
								onClick={() => manage(row.original)}
							>
								<MoreHorizontalIcon />
							</Button>
						) : null}
					</div>
				),
			},
		],
		[manage],
	);
	const table = useReactTable({
		data: result?.rows ?? [],
		columns,
		getCoreRowModel: getCoreRowModel(),
	});
	const usageRatio = result?.memberLimit
		? result.usage / result.memberLimit
		: 0;
	const mutate = async (action: "update" | "remove" | "transfer") => {
		if (!selected) return;
		setPending(true);
		setError(null);
		try {
			if (action === "update")
				await updateWorkspaceMemberRole({
					data: { memberId: selected.id, role: selectedRole },
				});
			if (action === "remove")
				await removeWorkspaceMember({ data: { memberId: selected.id } });
			if (action === "transfer")
				await transferWorkspaceOwnership({ data: { memberId: selected.id } });
			setSelected(null);
			setDanger(null);
			await load();
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "Unable to update member.",
			);
		} finally {
			setPending(false);
		}
	};
	return (
		<WorkspaceShell data={data} activeItem="workspace-members" title="Members">
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
					<div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
						<div>
							<h1 className="text-2xl font-semibold">Members</h1>
							<p className="mt-1 text-sm text-muted-foreground">
								Manage who can access this workspace.
							</p>
						</div>
						{result ? (
							<div
								className={
									usageRatio >= 0.8
										? "text-sm font-medium text-destructive"
										: "text-sm text-muted-foreground"
								}
							>
								{result.usage} of {result.memberLimit} seats used
							</div>
						) : null}
					</div>
					<div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
						<Input
							placeholder="Search name or email…"
							value={search}
							onValueChange={setSearch}
						/>
						<select
							className="h-9 rounded-md border bg-transparent px-3 text-sm"
							value={role}
							onChange={(event) => setRole(event.target.value)}
						>
							<option value="all">All roles</option>
							<option value="owner">Owner</option>
							<option value="admin">Admin</option>
							<option value="teacher">Teacher</option>
							<option value="student">Student</option>
						</select>
					</div>
					{error ? (
						<p className="text-sm text-destructive" role="alert">
							{error}
						</p>
					) : null}
					<div className="overflow-hidden rounded-xl border bg-card">
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead className="border-b bg-muted/40">
									{table.getHeaderGroups().map((group) => (
										<tr key={group.id}>
											{group.headers.map((header) => (
												<th
													className="p-3 text-left font-medium"
													key={header.id}
												>
													{flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)}
												</th>
											))}
										</tr>
									))}
								</thead>
								<tbody>
									{table.getRowModel().rows.length ? (
										table.getRowModel().rows.map((row) => (
											<tr className="border-b last:border-0" key={row.id}>
												{row.getVisibleCells().map((cell) => (
													<td className="p-3" key={cell.id}>
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
												className="p-8 text-center text-muted-foreground"
												colSpan={columns.length}
											>
												No members found.
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
						<div className="flex items-center justify-between border-t p-3">
							<p className="text-xs text-muted-foreground">
								{result?.total ?? 0} members
							</p>
							<div className="flex gap-2">
								<Button
									size="sm"
									variant="outline"
									disabled={page <= 1}
									onClick={() => {
										const next = page - 1;
										setPage(next);
										void load(next);
									}}
								>
									Previous
								</Button>
								<Button
									size="sm"
									variant="outline"
									disabled={!result || page >= result.pageCount}
									onClick={() => {
										const next = page + 1;
										setPage(next);
										void load(next);
									}}
								>
									Next
								</Button>
							</div>
						</div>
					</div>
					<Dialog
						open={Boolean(selected) && !danger}
						onOpenChange={(open) => {
							if (!open) setSelected(null);
						}}
					>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Manage member</DialogTitle>
								<DialogDescription>
									{selected?.name} · {selected?.email}
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-2 py-4">
								<label className="text-sm font-medium" htmlFor="member-role">
									Workspace role
								</label>
								<select
									id="member-role"
									className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
									value={selectedRole}
									onChange={(event) => setSelectedRole(event.target.value)}
								>
									<option value="admin">Admin</option>
									<option value="teacher">Teacher</option>
									<option value="student">Student</option>
								</select>
							</div>
							<DialogFooter className="flex-col gap-2 sm:flex-row">
								<div className="flex flex-1 gap-2">
									{selected?.userId !== result?.currentUserId ? (
										<Button
											type="button"
											variant="destructive"
											onClick={() => setDanger("remove")}
										>
											Remove
										</Button>
									) : null}
									{result?.currentRole.split(",").includes("owner") &&
									selected?.userId !== result.currentUserId ? (
										<Button
											type="button"
											variant="outline"
											onClick={() => setDanger("transfer")}
										>
											Transfer ownership
										</Button>
									) : null}
								</div>
								<Button
									disabled={pending || selectedRole === selected?.role}
									onClick={() => void mutate("update")}
								>
									Save role
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
					<AlertDialog
						open={Boolean(danger)}
						onOpenChange={(open) => {
							if (!open) setDanger(null);
						}}
					>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>
									{danger === "transfer"
										? "Transfer workspace ownership?"
										: "Remove this member?"}
								</AlertDialogTitle>
								<AlertDialogDescription>
									{danger === "transfer"
										? `${selected?.name} will become the owner and you will become an admin.`
										: `${selected?.name} will lose access to this workspace. Their account and historical exam data will remain.`}
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<AlertDialogAction
									variant="destructive"
									disabled={pending}
									onClick={() =>
										void mutate(danger === "transfer" ? "transfer" : "remove")
									}
								>
									{danger === "transfer"
										? "Transfer ownership"
										: "Remove member"}
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</main>
		</WorkspaceShell>
	);
}
