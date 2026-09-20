import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { PlusIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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
import {
	createAcademicClass,
	listAcademicClasses,
} from "@/lib/academic-classes";
import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/workspace/classes/")({
	beforeLoad: async () => {
		const data = await getDashboardSession();
		if (!data) throw redirect({ to: "/login" });
		if (
			!data.organizationRole
				?.split(",")
				.some((role) => ["owner", "admin", "teacher"].includes(role)) ||
			data.entitlement?.status === "suspended"
		)
			throw redirect({ to: "/dashboard" });
		return data;
	},
	component: ClassesPage,
});

type Result = Awaited<ReturnType<typeof listAcademicClasses>>;
type Row = Result["rows"][number];

function ClassesPage() {
	const shell = Route.useRouteContext();
	const navigate = useNavigate();
	const [result, setResult] = useState<Result | null>(null);
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState("active");
	const [page, setPage] = useState(1);
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [code, setCode] = useState("");
	const [description, setDescription] = useState("");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const load = useCallback(
		async (next = page) => {
			try {
				setError(null);
				setResult(
					await listAcademicClasses({ data: { search, status, page: next } }),
				);
			} catch (caught) {
				setError(
					caught instanceof Error ? caught.message : "Unable to load classes.",
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
	const columns = useMemo<ColumnDef<Row>[]>(
		() => [
			{
				accessorKey: "name",
				header: "Class",
				cell: ({ row }) => (
					<div>
						<p className="font-medium">{row.original.name}</p>
						<p className="text-xs text-muted-foreground">{row.original.code}</p>
					</div>
				),
			},
			{ accessorKey: "teacherCount", header: "Teachers" },
			{ accessorKey: "studentCount", header: "Students" },
			{
				accessorKey: "status",
				header: "Status",
				cell: ({ row }) => (
					<Badge
						variant={row.original.status === "active" ? "default" : "secondary"}
					>
						{row.original.status}
					</Badge>
				),
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => (
					<div className="text-right">
						<Button
							size="sm"
							variant="outline"
							onClick={() =>
								void navigate({
									to: "/workspace/classes/$classId",
									params: { classId: row.original.id },
								})
							}
						>
							Open
						</Button>
					</div>
				),
			},
		],
		[navigate],
	);
	const table = useReactTable({
		data: result?.rows ?? [],
		columns,
		getCoreRowModel: getCoreRowModel(),
	});
	return (
		<WorkspaceShell data={shell} activeItem="workspace-classes" title="Classes">
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
					<div className="flex items-end justify-between gap-4">
						<div>
							<h1 className="text-2xl font-semibold">Classes</h1>
							<p className="mt-1 text-sm text-muted-foreground">
								Organize teachers and students into exam cohorts.
							</p>
						</div>
						{result?.canManageClasses ? (
							<Button onClick={() => setOpen(true)}>
								<PlusIcon />
								New class
							</Button>
						) : null}
					</div>
					<div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
						<Input
							placeholder="Search name or code…"
							value={search}
							onValueChange={setSearch}
						/>
						<select
							className="h-9 rounded-md border bg-transparent px-3 text-sm"
							value={status}
							onChange={(event) => setStatus(event.target.value)}
						>
							<option value="active">Active</option>
							<option value="archived">Archived</option>
							<option value="all">All statuses</option>
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
												No classes found.
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
						<div className="flex items-center justify-between border-t p-3">
							<p className="text-xs text-muted-foreground">
								{result?.total ?? 0} classes
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
					<Dialog open={open} onOpenChange={setOpen}>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Create class</DialogTitle>
								<DialogDescription>
									Create an active cohort for teachers and students.
								</DialogDescription>
							</DialogHeader>
							<form
								className="space-y-4"
								onSubmit={async (event) => {
									event.preventDefault();
									setPending(true);
									setError(null);
									try {
										const created = await createAcademicClass({
											data: { name, code, description },
										});
										setOpen(false);
										await navigate({
											to: "/workspace/classes/$classId",
											params: { classId: created.id },
										});
									} catch (caught) {
										setError(
											caught instanceof Error
												? caught.message
												: "Unable to create class.",
										);
									} finally {
										setPending(false);
									}
								}}
							>
								<div className="space-y-2">
									<label className="text-sm font-medium" htmlFor="class-name">
										Name
									</label>
									<Input
										id="class-name"
										value={name}
										onValueChange={setName}
										required
									/>
								</div>
								<div className="space-y-2">
									<label className="text-sm font-medium" htmlFor="class-code">
										Code
									</label>
									<Input
										id="class-code"
										value={code}
										onValueChange={setCode}
										required
									/>
								</div>
								<div className="space-y-2">
									<label
										className="text-sm font-medium"
										htmlFor="class-description"
									>
										Description
									</label>
									<Input
										id="class-description"
										value={description}
										onValueChange={setDescription}
									/>
								</div>
								<DialogFooter>
									<Button
										type="button"
										variant="outline"
										onClick={() => setOpen(false)}
									>
										Cancel
									</Button>
									<Button type="submit" disabled={pending}>
										{pending ? "Creating…" : "Create class"}
									</Button>
								</DialogFooter>
							</form>
						</DialogContent>
					</Dialog>
				</div>
			</main>
		</WorkspaceShell>
	);
}
