import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Filter } from "lucide-react";
import { useState } from "react";
import { DashboardShell } from "#/components/dashboard-shell";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { getSession } from "#/lib/auth.functions";
import { getPlatformAuditLog } from "#/lib/super-admin.functions";
export const Route = createFileRoute("/super-admin/audit")({
	beforeLoad: async () => {
		const session = await getSession();
		if (!session) throw redirect({ to: "/login" });
		if (session.user.role !== "admin") throw redirect({ to: "/dashboard" });
		return { user: session.user };
	},
	loader: () => getPlatformAuditLog(),
	component: AuditPage,
});
function AuditPage() {
	const { user } = Route.useRouteContext();
	const initial = Route.useLoaderData() as { records: any[]; hasMore: boolean };
	const router = useRouter();
	const queryLog = useServerFn(getPlatformAuditLog);
	const [records, setRecords] = useState(initial.records);
	const [hasMore, setHasMore] = useState(initial.hasMore);
	const [offset, setOffset] = useState(0);
	const [action, setAction] = useState("");
	const [actor, setActor] = useState("");
	const [target, setTarget] = useState("");
	const [from, setFrom] = useState("");
	const [to, setTo] = useState("");
	const [notice, setNotice] = useState("");
	async function filter(nextOffset = 0) {
		try {
			const result = (await queryLog({
				data: {
					action: action || undefined,
					actor: actor || undefined,
					target: target || undefined,
					from: from ? new Date(from).getTime() : undefined,
					to: to ? new Date(to).getTime() : undefined,
					offset: nextOffset,
				},
			})) as { records: any[]; hasMore: boolean };
			setRecords(result.records);
			setHasMore(result.hasMore);
			setOffset(nextOffset);
		} catch (error) {
			setNotice(
				error instanceof Error
					? error.message
					: "Unable to filter audit records.",
			);
		}
	}
	return (
		<DashboardShell user={user} pageTitle="Audit trails">
			<div className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
				<section>
					<p className="text-sm text-muted-foreground">
						Immutable platform history
					</p>
					<h1 className="mt-1 text-2xl font-semibold">Audit trails</h1>
				</section>
				{notice ? (
					<p className="rounded-md border p-3 text-sm">{notice}</p>
				) : null}
				<Card>
					<CardContent className="flex flex-wrap gap-2 p-4">
						<Input
							className="max-w-xs"
							onChange={(event) => setActor(event.target.value)}
							placeholder="Actor user ID"
							value={actor}
						/>
						<Input
							className="max-w-xs"
							onChange={(event) => setAction(event.target.value)}
							placeholder="Exact action, e.g. user.ban"
							value={action}
						/>
						<Input
							className="max-w-xs"
							onChange={(event) => setTarget(event.target.value)}
							placeholder="Target ID"
							value={target}
						/>
						<Input
							onChange={(event) => setFrom(event.target.value)}
							type="date"
							value={from}
						/>
						<Input
							onChange={(event) => setTo(event.target.value)}
							type="date"
							value={to}
						/>
						<Button onClick={filter} type="button" variant="outline">
							<Filter /> Filter
						</Button>
						<Button
							onClick={() => {
								setAction("");
								setActor("");
								setTarget("");
								setFrom("");
								setTo("");
								setRecords(initial.records);
								setHasMore(initial.hasMore);
								setOffset(0);
								void router.invalidate();
							}}
							type="button"
							variant="ghost"
						>
							Reset
						</Button>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<FileText className="size-4" /> {records.length} records
						</CardTitle>
					</CardHeader>
					<CardContent className="divide-y">
						{records.length ? (
							records.map((audit) => (
								<div className="py-4" key={audit.id}>
									<div className="flex flex-wrap items-center gap-2">
										<p className="font-medium">{audit.action}</p>
										<Badge variant="outline">{audit.outcome}</Badge>
									</div>
									<p className="mt-1 text-sm text-muted-foreground">
										Actor: {audit.actorName} · Target: {audit.targetType}{" "}
										{audit.targetId ?? "platform"}
									</p>
									<p className="mt-1 text-sm">Reason: {audit.reason}</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{new Date(audit.createdAt).toLocaleString()}
									</p>
								</div>
							))
						) : (
							<p className="py-8 text-center text-sm text-muted-foreground">
								No audit records match these filters.
							</p>
						)}
					</CardContent>
				</Card>
				<div className="flex items-center justify-between gap-3">
					<Button
						disabled={offset === 0}
						onClick={() => void filter(Math.max(0, offset - 50))}
						type="button"
						variant="outline"
					>
						Previous
					</Button>
					<Button
						disabled={!hasMore}
						onClick={() => void filter(offset + 50)}
						type="button"
						variant="outline"
					>
						Next
					</Button>
				</div>
			</div>
		</DashboardShell>
	);
}
