import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	ActivityIcon,
	BookOpenCheckIcon,
	CalendarDaysIcon,
	GraduationCapIcon,
	MailPlusIcon,
	PlusIcon,
	UsersRoundIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getDashboardSession } from "@/lib/session";
import { getWorkspaceOverview } from "@/lib/workspace-governance";

export const Route = createFileRoute("/workspace/")({
	beforeLoad: async () => {
		const data = await getDashboardSession();
		if (!data) throw redirect({ to: "/login" });
		return data;
	},
	loader: () => getWorkspaceOverview(),
	component: WorkspaceOverviewPage,
});

const labels: Record<string, string> = {
	members: "Members",
	activeClasses: "Active classes",
	activeExams: "Active exams",
	monthlyAttempts: "Monthly attempts",
	pendingInvitations: "Pending invitations",
	assignedClasses: "Assigned classes",
	upcomingDeliveries: "Upcoming deliveries",
	students: "Student recipients",
	completedAttempts: "Completed attempts",
	upcomingExams: "Upcoming exams",
	completedExams: "Completed exams",
	recentResults: "Recent results",
};

function formatDate(value: Date) {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function WorkspaceOverviewPage() {
	const shell = Route.useRouteContext();
	const data = Route.useLoaderData();
	const suspended = data.status === "suspended";
	const manager = data.audience === "manager";
	const teacher = data.audience === "teacher";
	const actions = manager
		? ([
				["Create exam", "/exams/new", PlusIcon],
				["Schedule exam", "/schedule/new", CalendarDaysIcon],
				["Invite member", "/workspace/invitations", MailPlusIcon],
				["Manage classes", "/workspace/classes", GraduationCapIcon],
			] as const)
		: teacher
			? ([
					["Create exam", "/exams/new", PlusIcon],
					["Schedule exam", "/schedule/new", CalendarDaysIcon],
					["View classes", "/workspace/classes", GraduationCapIcon],
				] as const)
			: ([
					["View my exams", "/my-exams", BookOpenCheckIcon],
					["View results", "/results", ActivityIcon],
				] as const);

	return (
		<WorkspaceShell
			data={shell}
			activeItem="workspace-overview"
			title="Workspace overview"
		>
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
						<div className="space-y-1">
							<p className="text-sm text-muted-foreground">
								{data.organization.name}
							</p>
							<h1 className="text-2xl font-semibold tracking-tight">
								Workspace overview
							</h1>
							<p className="text-sm text-muted-foreground">
								A role-aware view of learning activity and workspace capacity.
							</p>
						</div>
						<div className="flex items-center gap-2">
							<Badge variant="secondary">{data.plan.name}</Badge>
							<Badge variant={suspended ? "destructive" : "outline"}>
								{data.usage.health.replace("_", " ")}
							</Badge>
						</div>
					</div>

					{suspended ? (
						<div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
							This workspace is suspended. Data remains available in read-only
							mode.
						</div>
					) : (
						<section
							className="flex flex-wrap gap-2"
							aria-label="Quick actions"
						>
							{actions.map(([label, href, Icon]) => (
								<a
									className={buttonVariants({ variant: "outline", size: "sm" })}
									href={href}
									key={label}
								>
									<Icon />
									{label}
								</a>
							))}
						</section>
					)}

					<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
						{Object.entries(data.metrics).map(([key, value]) => (
							<section className="rounded-xl border bg-card p-5" key={key}>
								<p className="text-sm text-muted-foreground">
									{labels[key] ?? key}
								</p>
								<p className="mt-3 text-3xl font-semibold tabular-nums">
									{value}
								</p>
							</section>
						))}
					</div>

					<div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
						<section className="rounded-xl border bg-card">
							<div className="border-b p-5">
								<h2 className="font-medium">
									{data.audience === "student"
										? "Upcoming exams"
										: "Recent deliveries"}
								</h2>
							</div>
							{data.recent.length ? (
								<div className="divide-y">
									{data.recent.map((item) => (
										<a
											className="block px-5 py-4 hover:bg-muted/50"
											href={
												data.audience === "student"
													? "/my-exams"
													: `/schedule/${item.id}`
											}
											key={item.id}
										>
											<p className="text-sm font-medium">{item.title}</p>
											<p className="mt-1 text-xs text-muted-foreground">
												{formatDate(item.opensAt)} – {formatDate(item.closesAt)}
											</p>
										</a>
									))}
								</div>
							) : (
								<p className="p-8 text-center text-sm text-muted-foreground">
									No upcoming delivery activity.
								</p>
							)}
						</section>

						<section className="rounded-xl border bg-card p-5">
							<div className="flex items-center gap-2">
								<UsersRoundIcon className="size-4" />
								<h2 className="font-medium">Plan usage</h2>
							</div>
							<div className="mt-5 space-y-5">
								{[
									["Members", data.usage.members],
									["Active exams", data.usage.activeExams],
									["Monthly attempts", data.usage.monthlyAttempts],
								].map(([label, usage]) => {
									const item = usage as { used: number; limit: number };
									return (
										<div className="space-y-2" key={label as string}>
											<div className="flex justify-between text-sm">
												<span>{label as string}</span>
												<span className="text-muted-foreground">
													{item.used} of {item.limit}
												</span>
											</div>
											<div className="h-2 overflow-hidden rounded-full bg-muted">
												<div
													className="h-full bg-foreground"
													style={{
														width: `${Math.min(100, (item.used / item.limit) * 100)}%`,
													}}
												/>
											</div>
										</div>
									);
								})}
							</div>
						</section>
					</div>
				</div>
			</main>
		</WorkspaceShell>
	);
}
