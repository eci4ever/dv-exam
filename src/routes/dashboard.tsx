import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
	Activity,
	ArrowRight,
	BarChart3,
	CalendarDays,
	CheckCircle2,
	FilePlus2,
	Gauge,
	ShieldCheck,
	Users,
} from "lucide-react";
import { DashboardShell } from "#/components/dashboard-shell";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { getSession } from "#/lib/auth.functions";
import { getOrganizationWorkspace } from "#/lib/organization.functions";
import { getDashboardData } from "#/lib/examination.functions";

export const Route = createFileRoute("/dashboard")({
	beforeLoad: async () => {
		const session = await getSession();
		if (!session) throw redirect({ to: "/login" });
		return { user: session.user };
	},
	loader: async () => ({
		workspace: await getOrganizationWorkspace(),
		dashboard: await getDashboardData(),
	}),
	component: DashboardPage,
});

function DashboardPage() {
	const { user } = Route.useRouteContext();
	const { workspace, dashboard } = Route.useLoaderData();
	const organizationRole = workspace.organizations.find(
		(organization) => organization.id === workspace.activeOrganizationId,
	)?.role;

	const canManage =
		organizationRole === "owner" || organizationRole === "admin";
	if (!canManage)
		return (
			<DashboardShell
				organizationRole={organizationRole}
				pageTitle="Dashboard"
				user={user}
			>
				<div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
					<section>
						<p className="text-sm text-muted-foreground">Candidate portal</p>
						<h1 className="mt-1 text-2xl font-semibold tracking-tight">
							My examinations
						</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							Only examinations assigned to you appear here.
						</p>
					</section>
					<Card>
						<CardContent className="divide-y p-0">
							{dashboard.assignments.length ? (
								dashboard.assignments.map((assignment: any) => (
									<div
										className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
										key={assignment.id}
									>
										<div>
											<p className="font-medium">{assignment.title}</p>
											<p className="text-sm text-muted-foreground">
												{assignment.organizationName} ·{" "}
												{assignment.durationMinutes} minutes
											</p>
											{assignment.attemptStatus === "submitted" &&
											assignment.resultsPublishedAt ? (
												<p className="mt-1 text-sm text-primary">
													Result: {assignment.score}/{assignment.maxScore}
												</p>
											) : null}
										</div>
										<Button asChild>
											<Link
												to="/take/$assignmentId"
												params={{ assignmentId: assignment.id }}
											>
												{assignment.attemptStatus === "in_progress"
													? "Resume"
													: assignment.attemptStatus === "submitted"
														? "View submission"
														: "Start examination"}
											</Link>
										</Button>
									</div>
								))
							) : (
								<div className="p-10 text-center text-sm text-muted-foreground">
									No examination has been assigned to you yet.
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</DashboardShell>
		);
	return (
		<DashboardShell
			organizationRole={organizationRole}
			pageTitle="Dashboard"
			user={user}
		>
			<div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
				<section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Activity className="size-4" /> Workspace overview
						</div>
						<h1 className="mt-2 text-2xl font-semibold tracking-tight">
							Welcome back, {user.name.split(" ")[0]}.
						</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							Track your organisation's examination activity here.
						</p>
					</div>
					<Badge className="w-fit" variant="secondary">
						System active
					</Badge>
				</section>

				<section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<Metric
						icon={<Users />}
						label="Registered candidates"
						value={String(dashboard.metrics.candidateCount)}
						helper="Assigned across your workspaces"
					/>
					<Metric
						icon={<CalendarDays />}
						label="Active examinations"
						value={String(dashboard.metrics.examinationCount)}
						helper="Drafts, published and closed"
					/>
					<Metric
						icon={<BarChart3 />}
						label="Reports generated"
						value={String(dashboard.metrics.attemptCount)}
						helper="Candidate submissions"
					/>
				</section>

				<section className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-base">
								<Gauge className="size-4" /> Examination performance
							</CardTitle>
							<CardDescription>
								System activity over the past 24 hours.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid min-h-64 place-items-center rounded-lg border border-dashed bg-muted/40 p-6 text-center">
								<div className="max-w-sm">
									<Activity className="mx-auto size-6 text-muted-foreground" />
									<p className="mt-3 text-sm font-medium">
										Recent examinations
									</p>
									<p className="mt-1 text-sm text-muted-foreground">
										{dashboard.managed.length
											? dashboard.managed
													.map(
														(exam: any) =>
															`${exam.title} (${exam.candidateCount} candidates)`,
													)
													.join(" · ")
											: "Create your first examination to begin."}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Quick actions</CardTitle>
							</CardHeader>
							<CardContent className="grid gap-2">
								<Button asChild className="justify-start" variant="ghost">
									<Link to="/examinations">
										<FilePlus2 /> Create examination
									</Link>
								</Button>
								<Button asChild className="justify-start" variant="ghost">
									<Link to="/organizations#members">
										<ShieldCheck /> Manage candidates
									</Link>
								</Button>
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<CardTitle className="text-base">
									Organisation workspace
								</CardTitle>
								<CardDescription>
									Manage your organisation, members and invitations.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<Button asChild variant="outline">
									<Link to="/organizations">
										Manage organisations <ArrowRight />
									</Link>
								</Button>
							</CardContent>
						</Card>
					</div>
				</section>

				<Card>
					<CardHeader>
						<CardTitle className="text-base">Next steps</CardTitle>
						<CardDescription>Complete your workspace setup.</CardDescription>
					</CardHeader>
					<CardContent className="grid gap-3 sm:grid-cols-3">
						<Step done title="Account created" />
						<Step title="Create your first examination" />
						<Step title="Add examination candidates" />
					</CardContent>
				</Card>
			</div>
		</DashboardShell>
	);
}

function Metric({
	icon,
	label,
	value,
	helper,
}: {
	icon: React.ReactNode;
	label: string;
	value: string;
	helper: string;
}) {
	return (
		<Card>
			<CardContent className="flex items-center gap-4 p-5">
				<span className="grid size-10 place-items-center rounded-md bg-muted">
					{icon}
				</span>
				<div>
					<p className="text-2xl font-semibold tracking-tight">{value}</p>
					<p className="text-sm font-medium">{label}</p>
					<p className="text-xs text-muted-foreground">{helper}</p>
				</div>
			</CardContent>
		</Card>
	);
}

function Step({ title, done = false }: { title: string; done?: boolean }) {
	return (
		<div className="flex items-center gap-2 rounded-md border p-3 text-sm">
			<CheckCircle2
				className={
					done ? "size-4 text-primary" : "size-4 text-muted-foreground"
				}
			/>
			{title}
		</div>
	);
}

function QuickAction({
	icon,
	label,
}: {
	icon: React.ReactNode;
	label: string;
}) {
	return (
		<Button className="justify-start" type="button" variant="ghost">
			{icon}
			{label}
		</Button>
	);
}
