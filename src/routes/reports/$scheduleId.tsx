import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	type Table,
	useReactTable,
} from "@tanstack/react-table";
import { ArrowLeftIcon, ArrowUpDownIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { WorkspaceShell } from "@/components/workspace-shell";
import { userCanManageDelivery } from "@/lib/exam-delivery";
import {
	getScheduleItemAnalysis,
	getScheduleReport,
	listScheduleReportRecipients,
} from "@/lib/exam-reports";
import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/reports/$scheduleId")({
	beforeLoad: async () => {
		const data = await getDashboardSession();
		if (!data) throw redirect({ to: "/login" });
		if (!userCanManageDelivery(data.organizationRole))
			throw redirect({ to: "/dashboard" });
		return data;
	},
	component: ScheduleReportPage,
});

type Report = Awaited<ReturnType<typeof getScheduleReport>>;
type Recipients = Awaited<ReturnType<typeof listScheduleReportRecipients>>;
type Recipient = Recipients["rows"][number];
type ItemAnalysis = Awaited<ReturnType<typeof getScheduleItemAnalysis>>;
type RecipientSort = "name" | "status" | "percentage" | "submittedAt";

const distributionConfig = {
	count: { label: "Students", color: "var(--foreground)" },
} satisfies ChartConfig;

function dateTime(value: Date | null) {
	if (!value) return "—";
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function ScheduleReportPage() {
	const shell = Route.useRouteContext();
	const { scheduleId } = Route.useParams();
	const [classId, setClassId] = useState("");
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState("all");
	const [page, setPage] = useState(1);
	const [sortBy, setSortBy] = useState<RecipientSort>("name");
	const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
	const [report, setReport] = useState<Report | null>(null);
	const [recipients, setRecipients] = useState<Recipients | null>(null);
	const [items, setItems] = useState<ItemAnalysis>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadReport = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const [nextReport, nextItems] = await Promise.all([
				getScheduleReport({ data: { scheduleId, classId } }),
				getScheduleItemAnalysis({ data: { scheduleId, classId } }),
			]);
			setReport(nextReport);
			setItems(nextItems);
		} catch (caught) {
			setError(
				caught instanceof Error
					? caught.message
					: "Unable to load this schedule report.",
			);
		} finally {
			setLoading(false);
		}
	}, [scheduleId, classId]);

	const loadRecipients = useCallback(
		async (nextPage = page) => {
			try {
				setRecipients(
					await listScheduleReportRecipients({
						data: {
							scheduleId,
							classId,
							search,
							status,
							page: nextPage,
							pageSize: 25,
							sortBy,
							sortDirection,
						},
					}),
				);
			} catch (caught) {
				setError(
					caught instanceof Error
						? caught.message
						: "Unable to load report recipients.",
				);
			}
		},
		[scheduleId, classId, search, status, page, sortBy, sortDirection],
	);

	useEffect(() => {
		void loadReport();
	}, [loadReport]);
	useEffect(() => {
		const timer = window.setTimeout(() => {
			setPage(1);
			void loadRecipients(1);
		}, 300);
		return () => window.clearTimeout(timer);
	}, [loadRecipients]);

	const changeSort = (column: RecipientSort) => {
		if (sortBy === column) {
			setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
		} else {
			setSortBy(column);
			setSortDirection(column === "name" ? "asc" : "desc");
		}
	};
	const sortableHeader = (label: string, column: RecipientSort) => (
		<button
			className="inline-flex items-center gap-1 font-medium"
			type="button"
			onClick={() => changeSort(column)}
		>
			{label}
			<ArrowUpDownIcon className="size-3" />
		</button>
	);
	const columns: ColumnDef<Recipient>[] = [
		{
			accessorKey: "name",
			header: () => sortableHeader("Student", "name"),
			cell: ({ row }) => (
				<div>
					<p className="font-medium">{row.original.name}</p>
					<p className="text-xs text-muted-foreground">{row.original.email}</p>
				</div>
			),
		},
		{
			accessorKey: "status",
			header: () => sortableHeader("Status", "status"),
			cell: ({ row }) => (
				<Badge variant="secondary">{row.original.status}</Badge>
			),
		},
		{
			accessorKey: "startedAt",
			header: "Started",
			cell: ({ row }) => dateTime(row.original.startedAt),
		},
		{
			accessorKey: "submittedAt",
			header: () => sortableHeader("Submitted", "submittedAt"),
			cell: ({ row }) => dateTime(row.original.submittedAt),
		},
		{
			accessorKey: "percentage",
			header: () => sortableHeader("Score", "percentage"),
			cell: ({ row }) =>
				row.original.percentage === null ? (
					"—"
				) : (
					<div>
						<p>{row.original.percentage}%</p>
						<p className="text-xs text-muted-foreground">
							{row.original.score}/{row.original.maxScore}
						</p>
					</div>
				),
		},
		{
			accessorKey: "passed",
			header: "Outcome",
			cell: ({ row }) =>
				row.original.passed === null ? (
					"—"
				) : (
					<Badge variant={row.original.passed ? "default" : "secondary"}>
						{row.original.passed ? "Passed" : "Not passed"}
					</Badge>
				),
		},
	];
	const table = useReactTable({
		data: recipients?.rows ?? [],
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	const cards = report
		? ([
				["Recipients", report.summary.recipients],
				["Completion", `${report.summary.completionRate}%`],
				["Average score", `${report.summary.averagePercentage}%`],
				["Pass rate", `${report.summary.passRate}%`],
				["Missed", report.missedCount],
				["Timed out", report.timedOutCount],
			] as const)
		: [];

	return (
		<WorkspaceShell data={shell} activeItem="reports" title="Schedule report">
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
						<div>
							<a
								className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
								href="/reports"
							>
								<ArrowLeftIcon className="size-4" />
								All reports
							</a>
							<h1 className="text-2xl font-semibold tracking-tight">
								{report?.examTitle ?? "Schedule report"}
							</h1>
							{report ? (
								<p className="mt-1 text-sm text-muted-foreground">
									Version {report.examVersion} · {report.durationMinutes} min ·
									Opens {dateTime(report.opensAt)}
								</p>
							) : null}
						</div>
						<div className="flex items-center gap-2">
							{report ? (
								<>
									<Badge
										variant={
											report.reportStatus === "live" ? "default" : "secondary"
										}
									>
										{report.reportStatus}
									</Badge>
									<Badge variant="outline">{report.scheduleStatus}</Badge>
								</>
							) : null}
							<a
								className={buttonVariants({ variant: "outline" })}
								href={`/schedule/${scheduleId}`}
							>
								Monitoring
							</a>
						</div>
					</div>

					{error ? (
						<p className="text-sm text-destructive" role="alert">
							{error}
						</p>
					) : null}
					{loading && !report ? (
						<p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
							Loading report…
						</p>
					) : null}
					{report ? (
						<>
							{report.isPartial ? (
								<p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
									This report is limited to your assigned classes.
								</p>
							) : null}
							{!report.classSnapshotAvailable ? (
								<p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
									This legacy schedule has overall analytics only. Historical
									class breakdown is unavailable.
								</p>
							) : null}
							<section className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<p className="text-sm font-medium">Audience</p>
									<p className="mt-1 text-sm text-muted-foreground">
										{report.audienceMode === "all_students"
											? "All students"
											: "Selected classes"}{" "}
										· Passing score {report.passingPercentage}%
									</p>
								</div>
								{report.classSnapshotAvailable && report.classes.length ? (
									<select
										aria-label="Report class"
										className="h-9 rounded-md border bg-transparent px-3 text-sm"
										value={classId}
										onChange={(event) => setClassId(event.target.value)}
									>
										<option value="">All accessible classes</option>
										{report.classes.map((item) => (
											<option key={item.id} value={item.id}>
												{item.name} · {item.code}
											</option>
										))}
									</select>
								) : null}
							</section>

							<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
								{cards.map(([label, value]) => (
									<section
										className="rounded-xl border bg-card p-4"
										key={label}
									>
										<p className="text-xs text-muted-foreground">{label}</p>
										<p className="mt-2 text-2xl font-semibold tabular-nums">
											{value}
										</p>
									</section>
								))}
							</div>

							<section className="rounded-xl border bg-card p-5">
								<h2 className="font-medium">Score distribution</h2>
								<p className="mt-1 text-sm text-muted-foreground">
									Completed attempts grouped into fixed percentage ranges.
								</p>
								<ChartContainer
									className="mt-5 h-64 w-full aspect-auto"
									config={distributionConfig}
								>
									<BarChart data={report.distribution}>
										<CartesianGrid vertical={false} />
										<XAxis dataKey="label" tickLine={false} axisLine={false} />
										<YAxis
											allowDecimals={false}
											tickLine={false}
											axisLine={false}
										/>
										<ChartTooltip content={<ChartTooltipContent />} />
										<Bar dataKey="count" fill="var(--color-count)" radius={4} />
									</BarChart>
								</ChartContainer>
							</section>

							<section className="overflow-hidden rounded-xl border bg-card">
								<div className="flex flex-col gap-3 border-b p-5 lg:flex-row lg:items-end lg:justify-between">
									<div>
										<h2 className="font-medium">Student roster</h2>
										<p className="mt-1 text-sm text-muted-foreground">
											Live delivery and outcome status.
										</p>
									</div>
									<div className="flex flex-col gap-2 sm:flex-row">
										<Input
											className="sm:w-64"
											placeholder="Search name or email…"
											value={search}
											onValueChange={setSearch}
										/>
										<select
											aria-label="Recipient status"
											className="h-9 rounded-md border bg-transparent px-3 text-sm"
											value={status}
											onChange={(event) => setStatus(event.target.value)}
										>
											<option value="all">All statuses</option>
											<option value="not_started">Not started</option>
											<option value="in_progress">In progress</option>
											<option value="submitted">Submitted</option>
											<option value="timed_out">Timed out</option>
											<option value="missed">Missed</option>
										</select>
									</div>
								</div>
								<ReportTable
									table={table}
									empty="No students match these filters."
								/>
								<div className="flex items-center justify-between border-t p-3">
									<p className="text-xs text-muted-foreground">
										{recipients?.total ?? 0} students
									</p>
									<div className="flex gap-2">
										<Button
											size="sm"
											variant="outline"
											disabled={page <= 1}
											onClick={() => {
												const next = page - 1;
												setPage(next);
												void loadRecipients(next);
											}}
										>
											Previous
										</Button>
										<Button
											size="sm"
											variant="outline"
											disabled={!recipients || page >= recipients.pageCount}
											onClick={() => {
												const next = page + 1;
												setPage(next);
												void loadRecipients(next);
											}}
										>
											Next
										</Button>
									</div>
								</div>
							</section>

							<section className="space-y-4">
								<div>
									<h2 className="font-medium">Item analysis</h2>
									<p className="mt-1 text-sm text-muted-foreground">
										Correctness, blanks, and option selection for completed
										attempts.
									</p>
								</div>
								{items.map((item) => (
									<article
										className="rounded-xl border bg-card p-5"
										key={item.id}
									>
										<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
											<div>
												<p className="text-xs text-muted-foreground">
													Question {item.position + 1} · {item.marks} marks
												</p>
												<h3 className="mt-1 font-medium">{item.prompt}</h3>
											</div>
											<div className="flex gap-2">
												<Badge variant="secondary">
													{item.correctRate}% correct
												</Badge>
												<Badge variant="outline">{item.blankRate}% blank</Badge>
												<Badge>{item.difficulty}</Badge>
											</div>
										</div>
										<div className="mt-4 grid gap-2 sm:grid-cols-2">
											{item.options.map((option) => (
												<div
													className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
													key={option.id}
												>
													<div className="flex items-center gap-2">
														<span>{option.text}</span>
														{option.isCorrect ? (
															<Badge variant="outline">Correct</Badge>
														) : null}
													</div>
													<span className="text-muted-foreground">
														{option.selectedCount} selected
													</span>
												</div>
											))}
										</div>
									</article>
								))}
								{items.length === 0 ? (
									<p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
										No exam items available.
									</p>
								) : null}
							</section>
						</>
					) : null}
				</div>
			</main>
		</WorkspaceShell>
	);
}

function ReportTable<T>({ table, empty }: { table: Table<T>; empty: string }) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-sm">
				<thead className="bg-muted/40">
					{table.getHeaderGroups().map((group) => (
						<tr key={group.id}>
							{group.headers.map((header) => (
								<th className="p-3 text-left font-medium" key={header.id}>
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
							<tr className="border-t" key={row.id}>
								{row.getVisibleCells().map((cell) => (
									<td className="p-3" key={cell.id}>
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</td>
								))}
							</tr>
						))
					) : (
						<tr>
							<td
								className="border-t p-8 text-center text-muted-foreground"
								colSpan={table.getAllColumns().length}
							>
								{empty}
							</td>
						</tr>
					)}
				</tbody>
			</table>
		</div>
	);
}
