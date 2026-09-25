import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { SearchIcon, ShieldCheckIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	getAuditEvent,
	listAuditEvents,
	listAuditFilterOptions,
} from "@/lib/platform-admin";
import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/admin/audit")({
	validateSearch: (value: Record<string, unknown>) => ({
		organization:
			typeof value.organization === "string" ? value.organization : "",
		event: typeof value.event === "string" ? value.event : "",
	}),
	beforeLoad: async () => {
		const dashboard = await getDashboardSession();
		if (!dashboard) throw redirect({ to: "/login" });
		if (!dashboard.session.user.role?.split(",").includes("admin"))
			throw redirect({ to: "/dashboard" });
		return dashboard;
	},
	loaderDeps: ({ search }) => ({
		organizationId: search.organization,
		eventId: search.event,
	}),
	loader: async ({ deps }) => ({
		events: await listAuditEvents({
			data: { organizationId: deps.organizationId },
		}),
		options: await listAuditFilterOptions(),
		selectedEvent: deps.eventId
			? await getAuditEvent({ data: { eventId: deps.eventId } }).catch(
					() => null,
				)
			: null,
	}),
	component: AuditLog,
});

type AuditRow = Awaited<ReturnType<typeof listAuditEvents>>["events"][number];
type AuditDetail = Awaited<ReturnType<typeof getAuditEvent>>;

function title(value: string) {
	return value
		.replaceAll(".", " ")
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function AuditLog() {
	const routeSearch = Route.useSearch();
	const context = Route.useRouteContext();
	const initial = Route.useLoaderData();
	const [data, setData] = useState(initial.events);
	const [search, setSearch] = useState("");
	const [category, setCategory] = useState("all");
	const [result, setResult] = useState("all");
	const [typeFilter, setTypeFilter] = useState("all");
	const [actorId, setActorId] = useState("");
	const [organizationId, setOrganizationId] = useState(
		routeSearch.organization,
	);
	const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");
	const [page, setPage] = useState(1);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [detail, setDetail] = useState<AuditDetail | null>(
		initial.selectedEvent,
	);
	const request = useRef(0);

	useEffect(() => {
		if (!routeSearch.event) return;
		let cancelled = false;
		void getAuditEvent({ data: { eventId: routeSearch.event } })
			.then((event) => {
				if (!cancelled) setDetail(event);
			})
			.catch(() => {
				if (!cancelled) setError("Unable to load the linked audit event.");
			});
		return () => {
			cancelled = true;
		};
	}, [routeSearch.event]);

	const load = useCallback(
		async (nextPage = page) => {
			const id = ++request.current;
			setLoading(true);
			setError(null);
			try {
				const next = await listAuditEvents({
					data: {
						search,
						category,
						type: typeFilter,
						result,
						actorId,
						organizationId,
						dateFrom,
						dateTo,
						sortDirection,
						page: nextPage,
					},
				});
				if (id === request.current) setData(next);
			} catch (cause) {
				if (id === request.current)
					setError(
						cause instanceof Error
							? cause.message
							: "Unable to load audit events.",
					);
			} finally {
				if (id === request.current) setLoading(false);
			}
		},
		[
			search,
			category,
			typeFilter,
			result,
			actorId,
			organizationId,
			dateFrom,
			dateTo,
			sortDirection,
			page,
		],
	);

	// The selected filters are intentionally captured for one debounced request.
	// biome-ignore lint/correctness/useExhaustiveDependencies: debounced server-side filtering
	useEffect(() => {
		const timeout = window.setTimeout(() => {
			setPage(1);
			void load(1);
		}, 300);
		return () => window.clearTimeout(timeout);
	}, [
		search,
		category,
		typeFilter,
		result,
		actorId,
		organizationId,
		dateFrom,
		dateTo,
		sortDirection,
	]);

	const columns = useMemo<ColumnDef<AuditRow>[]>(
		() => [
			{
				accessorKey: "createdAt",
				header: () => (
					<Button
						variant="ghost"
						size="sm"
						onClick={() =>
							setSortDirection((value) => (value === "desc" ? "asc" : "desc"))
						}
					>
						Timestamp {sortDirection === "desc" ? "↓" : "↑"}
					</Button>
				),
				cell: ({ row }) => (
					<span className="whitespace-nowrap text-muted-foreground">
						{new Intl.DateTimeFormat("en-MY", {
							dateStyle: "medium",
							timeStyle: "short",
							timeZone: "Asia/Kuala_Lumpur",
						}).format(new Date(row.original.createdAt))}
					</span>
				),
			},
			{
				accessorKey: "type",
				header: "Event",
				cell: ({ row }) => (
					<div>
						<p className="font-medium">{title(row.original.type)}</p>
						<p className="text-xs text-muted-foreground">
							{row.original.category}
						</p>
					</div>
				),
			},
			{
				id: "actor",
				header: "Actor",
				cell: ({ row }) =>
					row.original.actorName ? (
						<div>
							<p>{row.original.actorName}</p>
							<p className="text-xs text-muted-foreground">
								{row.original.actorEmail}
							</p>
						</div>
					) : (
						<span className="text-muted-foreground">System</span>
					),
			},
			{
				id: "target",
				header: "Target",
				cell: ({ row }) => (
					<div>
						<p>{row.original.targetType ?? "—"}</p>
						<p className="max-w-40 truncate text-xs text-muted-foreground">
							{row.original.targetId ?? ""}
						</p>
					</div>
				),
			},
			{
				id: "organization",
				header: "Organization",
				cell: ({ row }) => row.original.organizationName ?? "—",
			},
			{
				accessorKey: "result",
				header: "Result",
				cell: ({ row }) => (
					<Badge
						variant={
							row.original.result === "success" ? "secondary" : "destructive"
						}
					>
						{row.original.result}
					</Badge>
				),
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => (
					<Button
						size="sm"
						variant="outline"
						onClick={async () => {
							try {
								setDetail(
									await getAuditEvent({ data: { eventId: row.original.id } }),
								);
							} catch (cause) {
								setError(
									cause instanceof Error
										? cause.message
										: "Unable to load event.",
								);
							}
						}}
					>
						Details
					</Button>
				),
			},
		],
		[sortDirection],
	);
	const table = useReactTable({
		data: data.events,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<PlatformAdminShell context={context} activeItem="audit" title="Audit Log">
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
					<div className="flex items-start gap-3">
						<div className="flex size-10 items-center justify-center rounded-lg border bg-card">
							<ShieldCheckIcon className="size-5" />
						</div>
						<div>
							<p className="text-sm text-muted-foreground">Platform Admin</p>
							<h1 className="text-2xl font-semibold tracking-tight">
								Audit log
							</h1>
							<p className="mt-1 text-sm text-muted-foreground">
								Immutable authentication, security, and administrative activity.
							</p>
						</div>
					</div>
					<section className="overflow-hidden rounded-xl border bg-card">
						<div className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-4">
							<div className="relative lg:col-span-2">
								<SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									value={search}
									onValueChange={setSearch}
									placeholder="Search event, actor, target"
									className="pl-9"
								/>
							</div>
							<select
								value={category}
								onChange={(e) => setCategory(e.target.value)}
								className="h-9 rounded-md border bg-transparent px-3 text-sm"
							>
								<option value="all">All categories</option>
								{[
									"auth",
									"user",
									"organization",
									"plan",
									"system",
									"security",
								].map((value) => (
									<option key={value}>{value}</option>
								))}
							</select>
							<select
								value={typeFilter}
								onChange={(e) => setTypeFilter(e.target.value)}
								className="h-9 rounded-md border bg-transparent px-3 text-sm"
							>
								<option value="all">All event types</option>
								{initial.options.types.map((item) => (
									<option key={item.type} value={item.type}>
										{title(item.type)}
									</option>
								))}
							</select>
							<select
								value={result}
								onChange={(e) => setResult(e.target.value)}
								className="h-9 rounded-md border bg-transparent px-3 text-sm"
							>
								<option value="all">All results</option>
								<option value="success">Success</option>
								<option value="failure">Failure</option>
							</select>
							<select
								value={actorId}
								onChange={(e) => setActorId(e.target.value)}
								className="h-9 rounded-md border bg-transparent px-3 text-sm"
							>
								<option value="">All actors</option>
								{initial.options.actors.map((actor) => (
									<option key={actor.id} value={actor.id}>
										{actor.name} · {actor.email}
									</option>
								))}
							</select>
							<select
								value={organizationId}
								onChange={(e) => setOrganizationId(e.target.value)}
								className="h-9 rounded-md border bg-transparent px-3 text-sm"
							>
								<option value="">All organizations</option>
								{initial.options.organizations.map((organization) => (
									<option key={organization.id} value={organization.id}>
										{organization.name}
									</option>
								))}
							</select>
							<div className="grid grid-cols-2 gap-2">
								<Input
									type="date"
									value={dateFrom}
									onValueChange={setDateFrom}
									aria-label="From date"
								/>
								<Input
									type="date"
									value={dateTo}
									onValueChange={setDateTo}
									aria-label="To date"
								/>
							</div>
						</div>
						{error ? (
							<div className="border-b bg-destructive/5 p-3 text-sm text-destructive">
								{error}
							</div>
						) : null}
						<div className="overflow-x-auto">
							<table className="w-full min-w-240 text-sm">
								<thead className="border-b bg-muted/50 text-left">
									<tr>
										{table.getHeaderGroups()[0]?.headers.map((header) => (
											<th
												key={header.id}
												className="h-11 px-4 font-medium text-muted-foreground"
											>
												{flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
											</th>
										))}
									</tr>
								</thead>
								<tbody className="divide-y">
									{table.getRowModel().rows.length ? (
										table.getRowModel().rows.map((row) => (
											<tr key={row.id} className="hover:bg-muted/40">
												{row.getVisibleCells().map((cell) => (
													<td key={cell.id} className="p-4">
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
												className="h-40 text-center text-muted-foreground"
											>
												{loading
													? "Loading audit events…"
													: "No audit events found."}
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
						<div className="flex items-center justify-between border-t p-4">
							<p className="text-sm text-muted-foreground">
								{data.total} events
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
									disabled={page >= data.pageCount || loading}
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
			<Dialog
				open={Boolean(detail)}
				onOpenChange={(open) => {
					if (!open) setDetail(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{detail ? title(detail.type) : "Audit event"}
						</DialogTitle>
						<DialogDescription>
							Recorded platform context. Sensitive credentials and raw IP
							addresses are excluded.
						</DialogDescription>
					</DialogHeader>
					{detail ? (
						<dl className="grid gap-4 py-3 text-sm">
							<div>
								<dt className="text-muted-foreground">Timestamp</dt>
								<dd>
									{new Intl.DateTimeFormat("en-MY", {
										dateStyle: "medium",
										timeStyle: "short",
										timeZone: "Asia/Kuala_Lumpur",
									}).format(new Date(detail.createdAt))}
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Session ID</dt>
								<dd className="break-all">
									{detail.sessionId ?? "Not recorded"}
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">User agent</dt>
								<dd className="break-words">
									{detail.userAgent ?? "Not recorded"}
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Impersonation context</dt>
								<dd>
									{detail.actorUserId &&
									detail.effectiveUserId &&
									detail.actorUserId !== detail.effectiveUserId
										? `${detail.actorUserId} acting as ${detail.effectiveUserId}`
										: "None"}
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Metadata</dt>
								<dd className="mt-1 rounded-lg bg-muted p-3 font-mono text-xs break-all">
									{detail.metadata
										? JSON.stringify(detail.metadata, null, 2)
										: "No metadata"}
								</dd>
							</div>
						</dl>
					) : null}
				</DialogContent>
			</Dialog>
		</PlatformAdminShell>
	);
}
