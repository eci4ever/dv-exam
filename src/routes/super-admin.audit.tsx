import { createFileRoute, redirect } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { DashboardShell } from "#/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
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
	const audits = Route.useLoaderData();
	return (
		<DashboardShell pageTitle="Audit trails" user={user}>
			<div className="mx-auto w-full max-w-7xl p-6">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<FileText className="size-5" /> Audit trails
						</CardTitle>
					</CardHeader>
					<CardContent className="divide-y">
						{audits.length ? (
							audits.map(
								(audit: {
									id: string;
									actorName: string;
									action: string;
									reason: string;
									createdAt: number;
								}) => (
									<div className="py-3 text-sm" key={audit.id}>
										<p className="font-medium">{audit.action}</p>
										<p className="text-muted-foreground">
											{audit.actorName} · {audit.reason} ·{" "}
											{new Date(audit.createdAt).toLocaleString()}
										</p>
									</div>
								),
							)
						) : (
							<p className="py-6 text-sm text-muted-foreground">
								No audit records yet.
							</p>
						)}
					</CardContent>
				</Card>
			</div>
		</DashboardShell>
	);
}
