import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDownIcon, PlusIcon } from "lucide-react";
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
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkspaceShell } from "@/components/workspace-shell";
import { archiveQuestion, listQuestions } from "@/lib/exam-authoring";
import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/questions/")({
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
	component: QuestionBank,
});

type Row = Awaited<ReturnType<typeof listQuestions>>["rows"][number];

function QuestionBank() {
	const data = Route.useRouteContext();
	const navigate = useNavigate();
	const [search, setSearch] = useState("");
	const [type, setType] = useState("all");
	const [difficulty, setDifficulty] = useState("all");
	const [status, setStatus] = useState("active");
	const [page, setPage] = useState(1);
	const [sortBy, setSortBy] = useState<"prompt" | "difficulty" | "updatedAt">(
		"updatedAt",
	);
	const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
	const [result, setResult] = useState<Awaited<
		ReturnType<typeof listQuestions>
	> | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	const load = useCallback(
		async (nextPage = page) => {
			setLoading(true);
			setError(null);
			try {
				setResult(
					await listQuestions({
						data: {
							search,
							type,
							difficulty,
							status,
							page: nextPage,
							sortBy,
							sortDirection,
						},
					}),
				);
			} catch (caught) {
				setError(
					caught instanceof Error
						? caught.message
						: "Unable to load questions.",
				);
			} finally {
				setLoading(false);
			}
		},
		[search, type, difficulty, status, page, sortBy, sortDirection],
	);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			setPage(1);
			void load(1);
		}, 300);
		return () => window.clearTimeout(timer);
	}, [load]);

	const sort = useCallback(
		(column: "prompt" | "difficulty") => {
			if (sortBy === column)
				setSortDirection(sortDirection === "asc" ? "desc" : "asc");
			else {
				setSortBy(column);
				setSortDirection("asc");
			}
		},
		[sortBy, sortDirection],
	);
	const columns = useMemo<ColumnDef<Row>[]>(
		() => [
			{
				accessorKey: "prompt",
				header: () => (
					<Button variant="ghost" size="sm" onClick={() => sort("prompt")}>
						Question
						<ArrowUpDownIcon />
					</Button>
				),
				cell: ({ row }) => (
					<div className="max-w-lg">
						<p className="line-clamp-2 font-medium">{row.original.prompt}</p>
						<div className="mt-1 flex flex-wrap gap-1">
							{row.original.tags.map((tag) => (
								<Badge variant="outline" key={tag}>
									{tag}
								</Badge>
							))}
						</div>
					</div>
				),
			},
			{
				accessorKey: "type",
				header: "Type",
				cell: ({ row }) =>
					row.original.type === "single_choice"
						? "Single choice"
						: "True / False",
			},
			{
				accessorKey: "difficulty",
				header: () => (
					<Button variant="ghost" size="sm" onClick={() => sort("difficulty")}>
						Difficulty
						<ArrowUpDownIcon />
					</Button>
				),
				cell: ({ row }) => (
					<Badge variant="secondary">{row.original.difficulty}</Badge>
				),
			},
			{ accessorKey: "defaultMarks", header: "Marks" },
			{
				id: "actions",
				header: "",
				cell: ({ row }) => (
					<div className="flex justify-end gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								navigate({
									to: "/questions/$questionId",
									params: { questionId: row.original.id },
								})
							}
						>
							Edit
						</Button>
						<AlertDialog>
							<AlertDialogTrigger render={<Button variant="ghost" size="sm" />}>
								{status === "archived" ? "Remove" : "Archive"}
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Remove this question?</AlertDialogTitle>
									<AlertDialogDescription>
										Unused questions are deleted. Questions already copied into
										an exam are archived to preserve history.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction
										onClick={async () => {
											await archiveQuestion({
												data: { questionId: row.original.id },
											});
											await load();
										}}
									>
										Continue
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				),
			},
		],
		[navigate, status, sort, load],
	);
	const table = useReactTable({
		data: result?.rows ?? [],
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<WorkspaceShell data={data} activeItem="questions" title="Question Bank">
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
					<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
						<div>
							<h1 className="text-2xl font-semibold tracking-tight">
								Question Bank
							</h1>
							<p className="mt-1 text-sm text-muted-foreground">
								Create reusable questions for your workspace exams.
							</p>
						</div>
						<Button onClick={() => navigate({ to: "/questions/new" })}>
							<PlusIcon />
							New question
						</Button>
					</div>
					<div className="grid gap-3 sm:grid-cols-4">
						<Input
							placeholder="Search questions or tags…"
							value={search}
							onValueChange={setSearch}
						/>
						<select
							className="h-9 rounded-md border bg-transparent px-3 text-sm"
							value={type}
							onChange={(event) => setType(event.target.value)}
						>
							<option value="all">All types</option>
							<option value="single_choice">Single choice</option>
							<option value="true_false">True / False</option>
						</select>
						<select
							className="h-9 rounded-md border bg-transparent px-3 text-sm"
							value={difficulty}
							onChange={(event) => setDifficulty(event.target.value)}
						>
							<option value="all">All difficulty</option>
							<option value="easy">Easy</option>
							<option value="medium">Medium</option>
							<option value="hard">Hard</option>
						</select>
						<select
							className="h-9 rounded-md border bg-transparent px-3 text-sm"
							value={status}
							onChange={(event) => setStatus(event.target.value)}
						>
							<option value="active">Active</option>
							<option value="archived">Archived</option>
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
												className="p-8 text-center text-muted-foreground"
												colSpan={columns.length}
											>
												Loading questions…
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
												className="p-8 text-center text-muted-foreground"
												colSpan={columns.length}
											>
												No questions found.
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
						<div className="flex items-center justify-between border-t p-3">
							<p className="text-sm text-muted-foreground">
								{result?.total ?? 0} questions
							</p>
							<div className="flex gap-2">
								<Button
									variant="outline"
									size="sm"
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
									size="sm"
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
