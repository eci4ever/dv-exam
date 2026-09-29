import { createFileRoute, redirect } from "@tanstack/react-router";
import { CreditCardIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getDashboardSession } from "@/lib/session";
import { getWorkspaceBilling } from "@/lib/workspace-billing";

export const Route = createFileRoute("/workspace/billing")({
	beforeLoad: async () => {
		const dashboard = await getDashboardSession();
		if (!dashboard) throw redirect({ to: "/login" });
		if (!dashboard.organizationRole?.split(",").includes("owner")) {
			throw redirect({ to: "/workspace" });
		}
		return dashboard;
	},
	loader: () => getWorkspaceBilling(),
	component: WorkspaceBilling,
});

function WorkspaceBilling() {
	const shell = Route.useRouteContext();
	const { current, plans } = Route.useLoaderData();
	return (
		<WorkspaceShell
			data={shell}
			activeItem="workspace-billing"
			title="Billing & usage"
		>
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
					<div className="flex items-start gap-3">
						<div className="flex size-10 items-center justify-center rounded-lg border bg-card">
							<CreditCardIcon className="size-5" />
						</div>
						<div>
							<p className="text-sm text-muted-foreground">
								Organization owner
							</p>
							<h1 className="text-2xl font-semibold tracking-tight">
								Billing & usage
							</h1>
							<p className="mt-1 text-sm text-muted-foreground">
								Review the subscription owned by {current.organizationName}.
							</p>
						</div>
					</div>
					<section className="rounded-xl border bg-card p-5 sm:p-6">
						<div className="flex items-start justify-between gap-4">
							<div>
								<p className="text-sm text-muted-foreground">Current plan</p>
								<h2 className="mt-1 text-xl font-semibold">
									{current.planName}
								</h2>
								<p className="mt-1 text-sm text-muted-foreground">
									{current.description}
								</p>
							</div>
							<Badge
								variant={current.status === "active" ? "secondary" : "outline"}
							>
								{current.status.replace("_", " ")}
							</Badge>
						</div>
						<div className="mt-5 grid gap-3 sm:grid-cols-3">
							<div className="rounded-lg border p-4">
								<p className="text-sm text-muted-foreground">Members</p>
								<p className="mt-2 text-xl font-semibold">
									{current.memberLimit}
								</p>
							</div>
							<div className="rounded-lg border p-4">
								<p className="text-sm text-muted-foreground">Active exams</p>
								<p className="mt-2 text-xl font-semibold">
									{current.activeExamLimit}
								</p>
							</div>
							<div className="rounded-lg border p-4">
								<p className="text-sm text-muted-foreground">
									Monthly attempts
								</p>
								<p className="mt-2 text-xl font-semibold">
									{current.monthlyAttemptLimit}
								</p>
							</div>
						</div>
					</section>
					<section className="space-y-4">
						<div>
							<h2 className="font-medium">Available plans</h2>
							<p className="text-sm text-muted-foreground">
								Checkout will become available when a billing provider is
								configured.
							</p>
						</div>
						<div className="grid gap-4 md:grid-cols-3">
							{plans.map((plan) => (
								<div className="rounded-xl border bg-card p-5" key={plan.id}>
									<h3 className="font-semibold">{plan.name}</h3>
									<p className="mt-1 min-h-10 text-sm text-muted-foreground">
										{plan.description}
									</p>
									<Button className="mt-5 w-full" variant="outline" disabled>
										{plan.id === current.planId
											? "Current plan"
											: "Contact platform admin"}
									</Button>
								</div>
							))}
						</div>
					</section>
				</div>
			</main>
		</WorkspaceShell>
	);
}
