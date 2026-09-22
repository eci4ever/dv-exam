import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	type Table,
	useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDownIcon, ChartSplineIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

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
	getReportFilterOptions,
	getReportsOverview,
	listReportSchedules,
} from "@/lib/exam-reports";
import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/reports/")({
	beforeLoad: async () => {
		const data = await getDashboardSession();
		if (!data) throw redirect({ to: "/login" });
		if (!userCanManageDelivery(data.organizationRole))
			throw redirect({ to: "/dashboard" });
		return data;
	},
	component: ReportsOverviewPage,
});

type Overview = Awaited<ReturnType<typeof getReportsOverview>>;
type ScheduleResult = Awaited<ReturnType<typeof listReportSchedules>>;
type ScheduleRow = ScheduleResult["rows"][number];
type ClassRow = Overview["classes"][number];
type SortBy = "opensAt" | "examTitle" | "completionRate" | "passRate";

const chartConfig = {
	completionRate: { label: "Completion", color: "var(--foreground)" },
	averagePercentage: {
		label: "Average score",
		color: "var(--muted-foreground)",
	},
	passRate: { label: "Pass rate", color: "var(--border)" },
} satisfies ChartConfig;

function dateTime(value: Date) {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function ReportsOverviewPage() {
	const shell = Route.useRouteContext();
	const [period, setPeriod] = useState("90d");
	const [examId, setExamId] = useState("");
	const [classId, setClassId] = useState("");
	const [status, setStatus] = useState("active");
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [sortBy, setSortBy] = useState<SortBy>("opensAt");
	const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
	const [overview, setOverview] = useState<Overview | null>(null);
	const [schedules, setSchedules] = useState<ScheduleResult | null>(null);
	const [options, setOptions] = useState<Awaited<
		ReturnType<typeof getReportFilterOptions>
	> | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		void getReportFilterOptions()
			.then(setOptions)
			.catch(() => undefined);
	}, []);

	const filterData = useMemo(
		() => ({ period, examId, classId, status }),
		[period, examId, classId, status],
	);
	const load = useCallback(
		async (nextPage = page) => {
			setLoading(true);
			setError(null);
			try {
				const [nextOverview, nextSchedules] = await Promise.all([
					getReportsOverview({ data: filterData }),
					listReportSchedules({
						data: {
							...filterData,
							search,
							page: nextPage,
							pageSize: 25,
							sortBy,
							sortDirection,
						},
					}),
				]);
				setOverview(nextOverview);
				setSchedules(nextSchedules);
			} catch (caught) {
				setError(
					caught instanceof Error ? caught.message : "Unable to load reports.",
				);
			} finally {
				setLoading(false);
			}
		},
		[filterData, page, search, sortBy, sortDirection],
	);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			setPage(1);
			void load(1);
		}, 300);
		return () => window.clearTimeout(timer);
	}, [load]);

	const changeSort = (column: SortBy) => {
		if (sortBy === column) {
			setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
		} else {
			setSortBy(column);
			setSortDirection(column === "examTitle" ? "asc" : "desc");
		}
	};

	const classColumns = useMemo<ColumnDef<ClassRow>[]>(
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
			{ accessorKey: "recipients", header: "Recipients" },
			{
				accessorKey: "completionRate",
				header: "Completion",
				cell: ({ row }) => `${row.original.completionRate}%`,
			},
			{
				accessorKey: "averagePercentage",
				header: "Average",
				cell: ({ row }) => `${row.original.averagePercentage}%`,
			},
			{
				accessorKey: "passRate",
				header: "Pass rate",
				cell: ({ row }) => `${row.original.passRate}%`,
			},
		],
		[],
	);
	const classTable = useReactTable({
		data: overview?.classes ?? [],
		columns: classColumns,
		getCoreRowModel: getCoreRowModel(),
	});

	const sortableHeader = (label: string, column: SortBy) => (
		<button
			className="inline-flex items-center gap-1 font-medium"
			type="button"
			onClick={() => changeSort(column)}
		>
			{label}
			<ArrowUpDownIcon className="size-3" />
		</button>
	);
	const scheduleColumns: ColumnDef<ScheduleRow>[] = [
		{
			accessorKey: "examTitle",
			header: () => sortableHeader("Exam", "examTitle"),
			cell: ({ row }) => (
				<div>
					<p className="font-medium">{row.original.examTitle}</p>
					<p className="text-xs text-muted-foreground">
						Version {row.original.examVersion}
					</p>
				</div>
			),
		},
		{
			accessorKey: "opensAt",
			header: () => sortableHeader("Opens", "opensAt"),
			cell: ({ row }) => dateTime(row.original.opensAt),
		},
		{
			accessorKey: "status",
			header: "Status",
			cell: ({ row }) => (
				<Badge
					variant={row.original.status === "open" ? "default" : "secondary"}
				>
					{row.original.status}
				</Badge>
			),
		},
		{
			accessorKey: "completionRate",
			header: () => sortableHeader("Completion", "completionRate"),
			cell: ({ row }) => `${row.original.completionRate}%`,
		},
		{
			accessorKey: "passRate",
			header: () => sortableHeader("Pass rate", "passRate"),
			cell: ({ row }) => `${row.original.passRate}%`,
		},
		{
			id: "action",
			header: "",
			cell: ({ row }) => (
				<a
					className={buttonVariants({ size: "sm", variant: "outline" })}
					href={`/reports/${row.original.id}`}
				>
					View report
				</a>
			),
		},
	];
	const scheduleTable = useReactTable({
		data: schedules?.rows ?? [],
		columns: scheduleColumns,
		getCoreRowModel: getCoreRowModel(),
	});

	const cards = overview
		? ([
				["Scheduled recipients", overview.summary.recipients],
				["Completion rate", `${overview.summary.completionRate}%`],
				["Average score", `${overview.summary.averagePercentage}%`],
				["Pass rate", `${overview.summary.passRate}%`],
			] as const)
		: [];

	return (
		<WorkspaceShell data={shell} activeItem="reports" title="Reports">
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
					<div className="flex items-start gap-3">
						<div className="rounded-lg border p-2">
							<ChartSplineIcon className="size-5" />
						</div>
						<div>
							<h1 className="text-2xl font-semibold tracking-tight">
								Reports & analytics
							</h1>
							<p className="mt-1 text-sm text-muted-foreground">
								Monitor participation and performance across exam deliveries.
							</p>
						</div>
					</div>

					<section className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-4">
						<select
							aria-label="Report period"
							className="h-9 rounded-md border bg-transparent px-3 text-sm"
							value={period}
							onChange={(event) => setPeriod(event.target.value)}
						>
							<option value="30d">Last 30 days</option>
							<option value="90d">Last 90 days</option>
							<option value="12m">Last 12 months</option>
							<option value="all">All time</option>
						</select>
						<select
							aria-label="Exam"
							className="h-9 rounded-md border bg-transparent px-3 text-sm"
							value={examId}
							onChange={(event) => setExamId(event.target.value)}
						>
							<option value="">All exams</option>
							{options?.exams.map((exam) => (
								<option key={exam.id} value={exam.id}>
									{exam.title}
								</option>
							))}
						</select>
						<select
							aria-label="Class"
							className="h-9 rounded-md border bg-transparent px-3 text-sm"
							value={classId}
							onChange={(event) => setClassId(event.target.value)}
						>
							<option value="">All accessible classes</option>
							{options?.classes.map((item) => (
								<option key={item.id} value={item.id}>
									{item.name} · {item.code}
								</option>
							))}
						</select>
						<select
							aria-label="Schedule status"
							className="h-9 rounded-md border bg-transparent px-3 text-sm"
							value={status}
							onChange={(event) => setStatus(event.target.value)}
						>
							<option value="active">All non-cancelled</option>
							<option value="scheduled">Scheduled</option>
							<option value="open">Open</option>
							<option value="closed">Closed</option>
							<option value="cancelled">Cancelled</option>
							<option value="all">All statuses</option>
						</select>
					</section>

					{error ? (
						<p className="text-sm text-destructive" role="alert">
							{error}
						</p>
					) : null}
					<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
						{cards.map(([label, value]) => (
							<section className="rounded-xl border bg-card p-5" key={label}>
								<p className="text-sm text-muted-foreground">{label}</p>
								<p className="mt-3 text-3xl font-semibold tabular-nums">
									{value}
								</p>
							</section>
						))}
					</div>

					<section className="rounded-xl border bg-card p-5">
						<div>
							<h2 className="font-medium">Performance trend</h2>
							<p className="mt-1 text-sm text-muted-foreground">
								Completion, average score, and pass rate over the selected
								period.
							</p>
						</div>
						{overview?.trend.length ? (
							<ChartContainer
								className="mt-5 h-72 w-full aspect-auto"
								config={chartConfig}
							>
								<LineChart data={overview.trend} margin={{ left: 8, right: 8 }}>
									<CartesianGrid vertical={false} />
									<XAxis dataKey="period" tickLine={false} axisLine={false} />
									<YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
									<ChartTooltip content={<ChartTooltipContent />} />
									<Line
										dataKey="completionRate"
										stroke="var(--color-completionRate)"
										strokeWidth={2}
										dot={false}
									/>
									<Line
										dataKey="averagePercentage"
										stroke="var(--color-averagePercentage)"
										strokeWidth={2}
										dot={false}
									/>
									<Line
										dataKey="passRate"
										stroke="var(--color-passRate)"
										strokeWidth={2}
										dot={false}
									/>
								</LineChart>
							</ChartContainer>
						) : (
							<p className="mt-5 rounded-lg border p-8 text-center text-sm text-muted-foreground">
								No performance data for this period.
							</p>
						)}
					</section>

					<section className="overflow-hidden rounded-xl border bg-card">
						<div className="border-b p-5">
							<h2 className="font-medium">Class comparison</h2>
							<p className="mt-1 text-sm text-muted-foreground">
								Only schedules with an accurate class snapshot are included.
							</p>
						</div>
						<TableView
							table={classTable}
							empty="No class analytics available."
						/>
					</section>

					<section className="overflow-hidden rounded-xl border bg-card">
						<div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-end sm:justify-between">
							<div>
								<h2 className="font-medium">Schedule reports</h2>
								<p className="mt-1 text-sm text-muted-foreground">
									Open a delivery for roster and item analysis.
								</p>
							</div>
							<Input
								className="sm:w-72"
								placeholder="Search exam title…"
								value={search}
								onValueChange={setSearch}
							/>
						</div>
						{loading && !schedules ? (
							<p className="p-8 text-center text-sm text-muted-foreground">
								Loading reports…
							</p>
						) : (
							<TableView
								table={scheduleTable}
								empty="No schedule reports found."
							/>
						)}
						<div className="flex items-center justify-between border-t p-3">
							<p className="text-xs text-muted-foreground">
								{schedules?.total ?? 0} schedules
							</p>
							<div className="flex gap-2">
								<Button
									size="sm"
									variant="outline"
									disabled={page <= 1 || loading}
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
									disabled={
										!schedules || page >= schedules.pageCount || loading
									}
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
					</section>
				</div>
			</main>
		</WorkspaceShell>
	);
}

function TableView<T>({ table, empty }: { table: Table<T>; empty: string }) {
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
