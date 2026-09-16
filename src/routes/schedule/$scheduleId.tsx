import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getPaginationRowModel,
	useReactTable,
} from "@tanstack/react-table";
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
import {
	cancelExamSchedule,
	getExamScheduleMonitoring,
	updateExamSchedule,
	userCanManageDelivery,
} from "@/lib/exam-delivery";
import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/schedule/$scheduleId")({
	beforeLoad: async () => {
		const data = await getDashboardSession();
		if (!data) throw redirect({ to: "/login" });
		if (!userCanManageDelivery(data.organizationRole))
			throw redirect({ to: "/dashboard" });
		return data;
	},
	component: ScheduleDetailPage,
});

type Monitoring = Awaited<ReturnType<typeof getExamScheduleMonitoring>>;
type Recipient = Monitoring["recipients"][number];

function localInput(value: Date) {
	const date = new Date(value);
	return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
		.toISOString()
		.slice(0, 16);
}

function ScheduleDetailPage() {
	const data = Route.useRouteContext();
	const { scheduleId } = Route.useParams();
	const [result, setResult] = useState<Monitoring | null>(null);
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState("all");
	const [opensAt, setOpensAt] = useState("");
	const [closesAt, setClosesAt] = useState("");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const load = useCallback(async () => {
		setError(null);
		try {
			const next = await getExamScheduleMonitoring({ data: { scheduleId } });
			setResult(next);
			setOpensAt(localInput(next.opensAt));
			setClosesAt(localInput(next.closesAt));
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "Unable to load schedule.",
			);
		}
	}, [scheduleId]);
	useEffect(() => {
		void load();
	}, [load]);
	const rows = useMemo(
		() =>
			(result?.recipients ?? []).filter((recipient) => {
				const matchesText = `${recipient.name} ${recipient.email}`
					.toLowerCase()
					.includes(search.toLowerCase());
				return matchesText && (status === "all" || recipient.status === status);
			}),
		[result, search, status],
	);
	const columns = useMemo<ColumnDef<Recipient>[]>(
		() => [
			{
				accessorKey: "name",
				header: "Student",
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
				accessorKey: "status",
				header: "Status",
				cell: ({ row }) => (
					<Badge
						variant={
							row.original.status === "submitted" ? "default" : "secondary"
						}
					>
						{row.original.status.replace("_", " ")}
					</Badge>
				),
			},
			{
				id: "started",
				header: "Started",
				cell: ({ row }) =>
					row.original.attempt?.startedAt
						? new Date(row.original.attempt.startedAt).toLocaleString()
						: "—",
			},
			{
				id: "score",
				header: "Score",
				cell: ({ row }) =>
					row.original.attempt?.score == null
						? "—"
						: `${row.original.attempt.score}/${row.original.attempt.maxScore} (${row.original.attempt.percentage}%)`,
			},
			{
				id: "result",
				header: "Result",
				cell: ({ row }) =>
					row.original.attempt?.passed == null
						? "—"
						: row.original.attempt.passed
							? "Passed"
							: "Not passed",
			},
		],
		[],
	);
	const table = useReactTable({
		data: rows,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		initialState: { pagination: { pageIndex: 0, pageSize: 25 } },
	});
	return (
		<WorkspaceShell data={data} activeItem="schedule" title="Schedule details">
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
					{result ? (
						<>
							<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
								<div>
									<div className="flex items-center gap-2">
										<h1 className="text-2xl font-semibold">
											{result.examTitle}
										</h1>
										<Badge>{result.status}</Badge>
									</div>
									<p className="mt-1 text-sm text-muted-foreground">
										Version {result.version} · {result.durationMinutes} minutes
										· {result.passingPercentage}% pass mark
									</p>
								</div>
							</div>
							<section className="rounded-xl border bg-card p-5">
								<div className="grid gap-4 sm:grid-cols-2">
									<div className="space-y-2">
										<label className="text-sm font-medium" htmlFor="opens">
											Opens
										</label>
										<Input
											id="opens"
											type="datetime-local"
											value={opensAt}
											disabled={result.status !== "scheduled"}
											onValueChange={setOpensAt}
										/>
									</div>
									<div className="space-y-2">
										<label className="text-sm font-medium" htmlFor="closes">
											Closes
										</label>
										<Input
											id="closes"
											type="datetime-local"
											value={closesAt}
											disabled={
												result.status === "closed" ||
												result.status === "cancelled"
											}
											onValueChange={setClosesAt}
										/>
									</div>
								</div>
								<div className="mt-4 flex flex-wrap gap-3">
									<Button
										disabled={
											pending ||
											result.status === "closed" ||
											result.status === "cancelled"
										}
										onClick={async () => {
											setPending(true);
											setError(null);
											try {
												await updateExamSchedule({
													data: {
														scheduleId,
														opensAt: new Date(opensAt).toISOString(),
														closesAt: new Date(closesAt).toISOString(),
													},
												});
												await load();
											} catch (caught) {
												setError(
													caught instanceof Error
														? caught.message
														: "Unable to update schedule.",
												);
											} finally {
												setPending(false);
											}
										}}
									>
										Save schedule
									</Button>
									{result.status === "scheduled" ? (
										<AlertDialog>
											<AlertDialogTrigger
												render={<Button variant="destructive" />}
											>
												Cancel schedule
											</AlertDialogTrigger>
											<AlertDialogContent>
												<AlertDialogHeader>
													<AlertDialogTitle>
														Cancel this schedule?
													</AlertDialogTitle>
													<AlertDialogDescription>
														Students will no longer be able to access this
														delivery. This cannot be undone.
													</AlertDialogDescription>
												</AlertDialogHeader>
												<AlertDialogFooter>
													<AlertDialogCancel>Keep schedule</AlertDialogCancel>
													<AlertDialogAction
														variant="destructive"
														onClick={async () => {
															try {
																await cancelExamSchedule({
																	data: { scheduleId },
																});
																await load();
															} catch (caught) {
																setError(
																	caught instanceof Error
																		? caught.message
																		: "Unable to cancel schedule.",
																);
															}
														}}
													>
														Cancel schedule
													</AlertDialogAction>
												</AlertDialogFooter>
											</AlertDialogContent>
										</AlertDialog>
									) : null}
								</div>
							</section>
							<div className="grid gap-3 sm:grid-cols-5">
								{Object.entries(result.summary).map(([key, value]) => (
									<div className="rounded-xl border bg-card p-4" key={key}>
										<p className="text-2xl font-semibold">{value}</p>
										<p className="mt-1 text-xs capitalize text-muted-foreground">
											{key.replace("_", " ")}
										</p>
									</div>
								))}
							</div>
							<section className="space-y-4">
								<div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
									<Input
										placeholder="Search name or email…"
										value={search}
										onValueChange={setSearch}
									/>
									<select
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
															No students match these filters.
														</td>
													</tr>
												)}
											</tbody>
										</table>
									</div>
								</div>
								<div className="flex items-center justify-between">
									<p className="text-xs text-muted-foreground">
										{rows.length} students
									</p>
									<div className="flex gap-2">
										<Button
											size="sm"
											variant="outline"
											disabled={!table.getCanPreviousPage()}
											onClick={() => table.previousPage()}
										>
											Previous
										</Button>
										<Button
											size="sm"
											variant="outline"
											disabled={!table.getCanNextPage()}
											onClick={() => table.nextPage()}
										>
											Next
										</Button>
									</div>
								</div>
							</section>
						</>
					) : (
						<p className="text-sm text-muted-foreground">Loading schedule…</p>
					)}
					{error ? (
						<p className="text-sm text-destructive" role="alert">
							{error}
						</p>
					) : null}
				</div>
			</main>
		</WorkspaceShell>
	);
}
