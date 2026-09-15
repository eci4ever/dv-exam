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
import { Input } from "@/components/ui/input";
import { WorkspaceShell } from "@/components/workspace-shell";
import { listExams } from "@/lib/exams";
import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/exams/")({
	beforeLoad: async () => {
		const data = await getDashboardSession();
		if (!data) throw redirect({ to: "/login" });
		if (
			!data.organizationRole
				?.split(",")
				.some((role) => ["owner", "admin", "teacher"].includes(role))
		)
			throw redirect({ to: "/dashboard" });
		return data;
	},
	component: ExamsPage,
});
type Row = Awaited<ReturnType<typeof listExams>>["rows"][number];

function ExamsPage() {
	const data = Route.useRouteContext();
	const navigate = useNavigate();
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState("published");
	const [page, setPage] = useState(1);
	const [result, setResult] = useState<Awaited<
		ReturnType<typeof listExams>
	> | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const load = useCallback(
		async (next = page) => {
			setLoading(true);
			setError(null);
			try {
				setResult(await listExams({ data: { search, status, page: next } }));
			} catch (caught) {
				setError(
					caught instanceof Error ? caught.message : "Unable to load exams.",
				);
			} finally {
				setLoading(false);
			}
		},
		[search, status, page],
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
				accessorKey: "title",
				header: "Exam",
				cell: ({ row }) => (
					<div>
						<p className="font-medium">{row.original.title}</p>
						<p className="text-xs text-muted-foreground">
							Version {row.original.version}
						</p>
					</div>
				),
			},
			{
				accessorKey: "status",
				header: "Status",
				cell: ({ row }) => (
					<Badge
						variant={
							row.original.status === "published" ? "default" : "secondary"
						}
					>
						{row.original.status}
					</Badge>
				),
			},
			{ accessorKey: "questionCount", header: "Questions" },
			{
				accessorKey: "durationMinutes",
				header: "Duration",
				cell: ({ row }) => `${row.original.durationMinutes} min`,
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => (
					<div className="text-right">
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								navigate({
									to: "/exams/$examId",
									params: { examId: row.original.id },
								})
							}
						>
							{row.original.status === "draft" ? "Edit" : "View"}
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
		<WorkspaceShell data={data} activeItem="exams" title="Exams">
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
					<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
						<div>
							<h1 className="text-2xl font-semibold tracking-tight">Exams</h1>
							<p className="mt-1 text-sm text-muted-foreground">
								Draft, publish, and version workspace exams.
							</p>
						</div>
						<Button onClick={() => navigate({ to: "/exams/new" })}>
							<PlusIcon />
							New exam
						</Button>
					</div>
					<div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
						<Input
							placeholder="Search exams…"
							value={search}
							onValueChange={setSearch}
						/>
						<select
							className="h-9 rounded-md border bg-transparent px-3 text-sm"
							value={status}
							onChange={(event) => setStatus(event.target.value)}
						>
							<option value="published">Published</option>
							<option value="draft">Drafts</option>
							<option value="archived">Archived</option>
						</select>
					</div>
					{error ? <p className="text-sm text-destructive">{error}</p> : null}
					<div className="overflow-hidden rounded-xl border bg-card">
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead className="border-b bg-muted/40">
									<tr>
										{table.getHeaderGroups()[0]?.headers.map((header) => (
											<th className="p-3 text-left font-medium" key={header.id}>
												{flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{loading ? (
										<tr>
											<td
												colSpan={columns.length}
												className="p-8 text-center text-muted-foreground"
											>
												Loading exams…
											</td>
										</tr>
									) : table.getRowModel().rows.length ? (
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
												colSpan={columns.length}
												className="p-8 text-center text-muted-foreground"
											>
												No exams found.
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
						<div className="flex items-center justify-between border-t p-3">
							<p className="text-sm text-muted-foreground">
								{result?.total ?? 0} exams
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
				</div>
			</main>
		</WorkspaceShell>
	);
}
