import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	AlertTriangleIcon,
	Building2Icon,
	ShieldCheckIcon,
	UserRoundCheckIcon,
	UsersRoundIcon,
} from "lucide-react";

import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { Badge } from "@/components/ui/badge";
import { getPlatformOverview } from "@/lib/platform-admin";
import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/admin/")({
	beforeLoad: async () => {
		const dashboard = await getDashboardSession();
		if (!dashboard) throw redirect({ to: "/login" });
		if (!dashboard.session.user.role?.split(",").includes("admin"))
			throw redirect({ to: "/dashboard" });
		return dashboard;
	},
	loader: () => getPlatformOverview(),
	component: PlatformOverview,
});

function formatEvent(value: string) {
	return value
		.replaceAll(".", " ")
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function PlatformOverview() {
	const context = Route.useRouteContext();
	const data = Route.useLoaderData();
	const cards = [
		{
			label: "Total users",
			value: data.metrics.totalUsers,
			icon: UsersRoundIcon,
		},
		{
			label: "Active users",
			value: data.metrics.activeUsers,
			icon: UserRoundCheckIcon,
		},
		{
			label: "Active organizations",
			value: data.metrics.activeOrganizations,
			icon: Building2Icon,
		},
		{
			label: "Suspended organizations",
			value: data.metrics.suspendedOrganizations,
			icon: ShieldCheckIcon,
		},
	];
	const attention = [
		["Banned users", data.attention.bannedUsers],
		["Ownerless organizations", data.attention.ownerlessOrganizations],
		["Organizations at member limit", data.attention.organizationsAtLimit],
		["Suspended organizations", data.attention.suspendedOrganizations],
	] as const;

	return (
		<PlatformAdminShell
			context={context}
			activeItem="admin-overview"
			title="Overview"
		>
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
					<div className="space-y-1">
						<p className="text-sm text-muted-foreground">Platform Admin</p>
						<h1 className="text-2xl font-semibold tracking-tight">
							Operational overview
						</h1>
						<p className="text-sm text-muted-foreground">
							Current account, workspace, and security health.
						</p>
					</div>
					<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
						{cards.map(({ label, value, icon: Icon }) => (
							<section key={label} className="rounded-xl border bg-card p-5">
								<div className="flex items-center justify-between">
									<p className="text-sm text-muted-foreground">{label}</p>
									<Icon className="size-4 text-muted-foreground" />
								</div>
								<p className="mt-3 text-3xl font-semibold tabular-nums">
									{value}
								</p>
							</section>
						))}
					</div>
					<div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
						<section className="rounded-xl border bg-card">
							<div className="border-b p-5">
								<div className="flex items-center gap-2">
									<AlertTriangleIcon className="size-4" />
									<h2 className="font-medium">Needs attention</h2>
								</div>
							</div>
							<div className="divide-y">
								{attention.map(([label, value]) => (
									<div
										key={label}
										className="flex items-center justify-between gap-4 px-5 py-4 text-sm"
									>
										<span>{label}</span>
										<Badge variant={value > 0 ? "destructive" : "secondary"}>
											{value}
										</Badge>
									</div>
								))}
							</div>
						</section>
						<section className="rounded-xl border bg-card">
							<div className="border-b p-5">
								<h2 className="font-medium">Recent activity</h2>
							</div>
							{data.recent.length ? (
								<div className="divide-y">
									{data.recent.map((event) => (
										<a
											key={event.id}
											href={`/admin/audit?event=${event.id}`}
											className="flex items-center justify-between gap-4 px-5 py-4 text-sm hover:bg-muted/50"
										>
											<div>
												<p className="font-medium">{formatEvent(event.type)}</p>
												<p className="mt-1 text-xs text-muted-foreground">
													{new Intl.DateTimeFormat("en-MY", {
														dateStyle: "medium",
														timeStyle: "short",
														timeZone: "Asia/Kuala_Lumpur",
													}).format(new Date(event.createdAt))}
												</p>
											</div>
											<Badge
												variant={
													event.result === "success"
														? "secondary"
														: "destructive"
												}
											>
												{event.result}
											</Badge>
										</a>
									))}
								</div>
							) : (
								<p className="p-8 text-center text-sm text-muted-foreground">
									No audit events yet.
								</p>
							)}
						</section>
					</div>
				</div>
			</main>
		</PlatformAdminShell>
	);
}
