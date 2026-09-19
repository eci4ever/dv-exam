import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { RotateCwIcon, XIcon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getDashboardSession } from "@/lib/session";
import {
	cancelWorkspaceInvitation,
	inviteWorkspaceMember,
	listWorkspaceInvitations,
	resendWorkspaceInvitation,
} from "@/lib/workspace-invitations";

export const Route = createFileRoute("/workspace/invitations")({
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
	component: InvitationsPage,
});

type InvitationResult = Awaited<ReturnType<typeof listWorkspaceInvitations>>;
type InvitationRow = InvitationResult["rows"][number];

function InvitationsPage() {
	const shell = Route.useRouteContext();
	const [result, setResult] = useState<InvitationResult | null>(null);
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState("pending");
	const [page, setPage] = useState(1);
	const [email, setEmail] = useState("");
	const [role, setRole] = useState("student");
	const [pending, setPending] = useState(false);
	const [cancelTarget, setCancelTarget] = useState<InvitationRow | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const load = useCallback(
		async (nextPage = page) => {
			try {
				setError(null);
				setResult(
					await listWorkspaceInvitations({
						data: { search, status, page: nextPage },
					}),
				);
			} catch (caught) {
				setError(
					caught instanceof Error
						? caught.message
						: "Unable to load invitations.",
				);
			}
		},
		[page, search, status],
	);
	useEffect(() => {
		const timer = window.setTimeout(() => {
			setPage(1);
			void load(1);
		}, 300);
		return () => window.clearTimeout(timer);
	}, [load]);
	const resend = useCallback(
		async (row: InvitationRow) => {
			setPending(true);
			setError(null);
			setSuccess(null);
			try {
				await resendWorkspaceInvitation({ data: { invitationId: row.id } });
				setSuccess(`Invitation resent to ${row.email}.`);
				await load();
			} catch (caught) {
				setError(
					caught instanceof Error
						? caught.message
						: "Unable to resend invitation.",
				);
			} finally {
				setPending(false);
			}
		},
		[load],
	);
	const columns = useMemo<ColumnDef<InvitationRow>[]>(
		() => [
			{
				accessorKey: "email",
				header: "Recipient",
				cell: ({ row }) => (
					<div>
						<p className="font-medium">{row.original.email}</p>
						<p className="text-xs text-muted-foreground">
							Invited by {row.original.inviterName}
						</p>
					</div>
				),
			},
			{
				accessorKey: "role",
				header: "Role",
				cell: ({ row }) => (
					<Badge variant="secondary">{row.original.role}</Badge>
				),
			},
			{
				accessorKey: "status",
				header: "Status",
				cell: ({ row }) => (
					<Badge
						variant={row.original.status === "pending" ? "default" : "outline"}
					>
						{row.original.status}
					</Badge>
				),
			},
			{
				accessorKey: "expiresAt",
				header: "Expires",
				cell: ({ row }) => new Date(row.original.expiresAt).toLocaleString(),
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) =>
					row.original.status === "pending" ? (
						<div className="flex justify-end gap-1">
							<Button
								size="icon-sm"
								variant="ghost"
								aria-label={`Resend invitation to ${row.original.email}`}
								disabled={pending}
								onClick={() => void resend(row.original)}
							>
								<RotateCwIcon />
							</Button>
							<Button
								size="icon-sm"
								variant="ghost"
								aria-label={`Cancel invitation to ${row.original.email}`}
								disabled={pending}
								onClick={() => setCancelTarget(row.original)}
							>
								<XIcon />
							</Button>
						</div>
					) : null,
			},
		],
		[pending, resend],
	);
	const table = useReactTable({
		data: result?.rows ?? [],
		columns,
		getCoreRowModel: getCoreRowModel(),
	});
	const submitInvite = async (event: React.FormEvent) => {
		event.preventDefault();
		setPending(true);
		setError(null);
		setSuccess(null);
		try {
			await inviteWorkspaceMember({ data: { email, role } });
			setEmail("");
			setSuccess(`Invitation sent to ${email}.`);
			await load(1);
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "Unable to send invitation.",
			);
		} finally {
			setPending(false);
		}
	};
	const confirmCancel = async () => {
		if (!cancelTarget) return;
		setPending(true);
		setError(null);
		try {
			await cancelWorkspaceInvitation({
				data: { invitationId: cancelTarget.id },
			});
			setSuccess(`Invitation to ${cancelTarget.email} cancelled.`);
			setCancelTarget(null);
			await load();
		} catch (caught) {
			setError(
				caught instanceof Error
					? caught.message
					: "Unable to cancel invitation.",
			);
		} finally {
			setPending(false);
		}
	};
	const usageRatio = result?.memberLimit
		? result.seats / result.memberLimit
		: 0;
	return (
		<WorkspaceShell
			data={shell}
			activeItem="workspace-invitations"
			title="Invitations"
		>
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
					<div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
						<div>
							<h1 className="text-2xl font-semibold">Invitations</h1>
							<p className="mt-1 text-sm text-muted-foreground">
								Invite people and manage pending workspace access.
							</p>
						</div>
						{result ? (
							<p
								className={
									usageRatio >= 0.8
										? "text-sm font-medium text-destructive"
										: "text-sm text-muted-foreground"
								}
							>
								{result.seats} of {result.memberLimit} seats reserved
							</p>
						) : null}
					</div>
					<form
						className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_11rem_auto]"
						onSubmit={submitInvite}
					>
						<Input
							type="email"
							placeholder="person@example.com"
							value={email}
							onValueChange={setEmail}
							required
						/>
						<select
							className="h-9 rounded-md border bg-transparent px-3 text-sm"
							value={role}
							onChange={(event) => setRole(event.target.value)}
						>
							<option value="student">Student</option>
							<option value="teacher">Teacher</option>
							<option value="admin">Admin</option>
						</select>
						<Button type="submit" disabled={pending || !email}>
							{pending ? "Sending…" : "Send invitation"}
						</Button>
					</form>
					{error ? (
						<p className="text-sm text-destructive" role="alert">
							{error}
						</p>
					) : null}
					{success ? (
						<output className="text-sm text-muted-foreground">{success}</output>
					) : null}
					<div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
						<Input
							placeholder="Search email…"
							value={search}
							onValueChange={setSearch}
						/>
						<select
							className="h-9 rounded-md border bg-transparent px-3 text-sm"
							value={status}
							onChange={(event) => setStatus(event.target.value)}
						>
							<option value="pending">Pending</option>
							<option value="all">All statuses</option>
							<option value="expired">Expired</option>
							<option value="accepted">Accepted</option>
							<option value="rejected">Rejected</option>
							<option value="canceled">Canceled</option>
						</select>
					</div>
					<div className="overflow-hidden rounded-xl border">
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead className="border-b bg-muted/50">
									{table.getHeaderGroups().map((group) => (
										<tr key={group.id}>
											{group.headers.map((header) => (
												<th
													className="h-11 px-4 text-left font-medium"
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
									{table.getRowModel().rows.map((row) => (
										<tr className="border-b last:border-0" key={row.id}>
											{row.getVisibleCells().map((cell) => (
												<td className="px-4 py-3" key={cell.id}>
													{flexRender(
														cell.column.columnDef.cell,
														cell.getContext(),
													)}
												</td>
											))}
										</tr>
									))}
								</tbody>
							</table>
							{result && result.rows.length === 0 ? (
								<p className="p-8 text-center text-sm text-muted-foreground">
									No invitations found.
								</p>
							) : null}
						</div>
					</div>
					<div className="flex items-center justify-between">
						<p className="text-sm text-muted-foreground">
							{result?.total ?? 0} invitations
						</p>
						<div className="flex gap-2">
							<Button
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
			</main>
			<AlertDialog
				open={Boolean(cancelTarget)}
				onOpenChange={(open) => {
					if (!open) setCancelTarget(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Cancel invitation?</AlertDialogTitle>
						<AlertDialogDescription>
							{cancelTarget
								? `${cancelTarget.email} will no longer be able to use this invitation.`
								: "This invitation will be cancelled."}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Keep invitation</AlertDialogCancel>
						<AlertDialogAction
							disabled={pending}
							onClick={() => void confirmCancel()}
						>
							Cancel invitation
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</WorkspaceShell>
	);
}
