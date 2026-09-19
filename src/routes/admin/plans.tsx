import { createFileRoute, redirect } from "@tanstack/react-router";
import { BoxesIcon, PencilIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { PlatformAdminShell } from "@/components/platform-admin-shell";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	assignOrganizationPlan,
	createPlan,
	listPlanOrganizations,
	listPlans,
	setPlanActive,
	updatePlan,
} from "@/lib/platform-admin";
import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/admin/plans")({
	beforeLoad: async () => {
		const dashboard = await getDashboardSession();
		if (!dashboard) throw redirect({ to: "/login" });
		if (!dashboard.session.user.role?.split(",").includes("admin"))
			throw redirect({ to: "/dashboard" });
		return dashboard;
	},
	loader: async () => ({
		plans: await listPlans(),
		organizations: await listPlanOrganizations({ data: {} }),
	}),
	component: PlansAndUsage,
});

type Plan = Awaited<ReturnType<typeof listPlans>>["plans"][number];
const emptyForm = {
	name: "",
	slug: "",
	description: "",
	memberLimit: 10,
	activeExamLimit: 5,
	monthlyAttemptLimit: 100,
};

function PlansAndUsage() {
	const context = Route.useRouteContext();
	const initial = Route.useLoaderData();
	const [plansData, setPlansData] = useState(initial.plans);
	const [organizations, setOrganizations] = useState(initial.organizations);
	const [search, setSearch] = useState("");
	const [planFilter, setPlanFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState("all");
	const [page, setPage] = useState(1);
	const [editing, setEditing] = useState<Plan | null>(null);
	const [form, setForm] = useState(emptyForm);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [togglePlan, setTogglePlan] = useState<Plan | null>(null);

	async function reloadPlans() {
		setPlansData(await listPlans());
	}
	async function reloadOrganizations(nextPage = page) {
		setOrganizations(
			await listPlanOrganizations({
				data: {
					search,
					planId: planFilter,
					status: statusFilter,
					page: nextPage,
				},
			}),
		);
	}
	// This effect intentionally reruns when the filter values captured by the loader change.
	// biome-ignore lint/correctness/useExhaustiveDependencies: debounced server-side filtering
	useEffect(() => {
		const timeout = window.setTimeout(
			() => void reloadOrganizations(1).then(() => setPage(1)),
			300,
		);
		return () => window.clearTimeout(timeout);
	}, [search, planFilter, statusFilter]);

	function openPlan(plan?: Plan) {
		setEditing(plan ?? null);
		setForm(
			plan
				? {
						name: plan.name,
						slug: plan.slug,
						description: plan.description,
						memberLimit: plan.memberLimit,
						activeExamLimit: plan.activeExamLimit,
						monthlyAttemptLimit: plan.monthlyAttemptLimit,
					}
				: emptyForm,
		);
		setError(null);
		setDialogOpen(true);
	}

	async function savePlan(event: React.FormEvent) {
		event.preventDefault();
		setPending(true);
		setError(null);
		try {
			if (editing) await updatePlan({ data: { id: editing.id, ...form } });
			else await createPlan({ data: form });
			await reloadPlans();
			setDialogOpen(false);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Unable to save plan.");
		} finally {
			setPending(false);
		}
	}

	async function confirmToggle() {
		if (!togglePlan) return;
		setPending(true);
		setError(null);
		try {
			await setPlanActive({
				data: { planId: togglePlan.id, isActive: !togglePlan.isActive },
			});
			await reloadPlans();
			setTogglePlan(null);
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "Unable to update plan.",
			);
			setTogglePlan(null);
		} finally {
			setPending(false);
		}
	}

	return (
		<PlatformAdminShell
			context={context}
			activeItem="plans"
			title="Plans & Usage"
		>
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
					<div className="flex items-start gap-3">
						<div className="flex size-10 items-center justify-center rounded-lg border bg-card">
							<BoxesIcon className="size-5" />
						</div>
						<div>
							<p className="text-sm text-muted-foreground">Platform Admin</p>
							<h1 className="text-2xl font-semibold tracking-tight">
								Plans & usage
							</h1>
							<p className="mt-1 text-sm text-muted-foreground">
								Manage limits and workspace access without billing workflows.
							</p>
						</div>
					</div>
					{error ? (
						<div
							className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
							role="alert"
						>
							{error}
						</div>
					) : null}
					<Tabs defaultValue="plans">
						<TabsList>
							<TabsTrigger value="plans">Plans</TabsTrigger>
							<TabsTrigger value="organizations">Organizations</TabsTrigger>
						</TabsList>
						<TabsContent value="plans" className="mt-4 space-y-4">
							<div className="flex justify-end">
								<Button onClick={() => openPlan()}>
									<PlusIcon />
									Create plan
								</Button>
							</div>
							<div className="grid gap-4 lg:grid-cols-3">
								{plansData.plans.map((plan) => (
									<section
										key={plan.id}
										className="rounded-xl border bg-card p-5"
									>
										<div className="flex items-start justify-between gap-3">
											<div>
												<div className="flex items-center gap-2">
													<h2 className="font-semibold">{plan.name}</h2>
													{plan.id === plansData.defaultPlanId ? (
														<Badge>Default</Badge>
													) : null}
												</div>
												<p className="mt-1 text-sm text-muted-foreground">
													{plan.description || "No description"}
												</p>
											</div>
											<Badge variant={plan.isActive ? "secondary" : "outline"}>
												{plan.isActive ? "Active" : "Inactive"}
											</Badge>
										</div>
										<dl className="mt-5 grid grid-cols-3 gap-2 text-center">
											<div className="rounded-lg bg-muted p-3">
												<dt className="text-xs text-muted-foreground">
													Members
												</dt>
												<dd className="mt-1 font-semibold">
													{plan.memberLimit}
												</dd>
											</div>
											<div className="rounded-lg bg-muted p-3">
												<dt className="text-xs text-muted-foreground">Exams</dt>
												<dd className="mt-1 font-semibold">
													{plan.activeExamLimit}
												</dd>
											</div>
											<div className="rounded-lg bg-muted p-3">
												<dt className="text-xs text-muted-foreground">
													Attempts
												</dt>
												<dd className="mt-1 font-semibold">
													{plan.monthlyAttemptLimit.toLocaleString()}
												</dd>
											</div>
										</dl>
										<p className="mt-4 text-xs text-muted-foreground">
											{plan.organizationCount} organizations · largest workspace{" "}
											{plan.largestMemberUsage} members
										</p>
										<div className="mt-4 flex gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() => openPlan(plan)}
											>
												<PencilIcon />
												Edit
											</Button>
											<Button
												variant="outline"
												size="sm"
												onClick={() => setTogglePlan(plan)}
											>
												{plan.isActive ? "Deactivate" : "Activate"}
											</Button>
										</div>
									</section>
								))}
							</div>
						</TabsContent>
						<TabsContent value="organizations" className="mt-4">
							<section className="overflow-hidden rounded-xl border bg-card">
								<div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
									<Input
										value={search}
										onValueChange={setSearch}
										placeholder="Search organizations"
										className="sm:max-w-xs"
									/>
									<select
										value={planFilter}
										onChange={(e) => setPlanFilter(e.target.value)}
										className="h-9 rounded-md border bg-transparent px-3 text-sm"
									>
										<option value="all">All plans</option>
										{plansData.plans.map((plan) => (
											<option key={plan.id} value={plan.id}>
												{plan.name}
											</option>
										))}
									</select>
									<select
										value={statusFilter}
										onChange={(e) => setStatusFilter(e.target.value)}
										className="h-9 rounded-md border bg-transparent px-3 text-sm"
									>
										<option value="all">All statuses</option>
										<option value="active">Active</option>
										<option value="suspended">Suspended</option>
									</select>
									<Button
										variant="outline"
										size="icon"
										onClick={() => void reloadOrganizations()}
									>
										<RefreshCwIcon />
									</Button>
								</div>
								<div className="overflow-x-auto">
									<table className="w-full min-w-200 text-sm">
										<thead className="border-b bg-muted/50 text-left">
											<tr>
												<th className="p-4">Organization</th>
												<th className="p-4">Plan</th>
												<th className="p-4">Status</th>
												<th className="p-4">Member usage</th>
												<th className="p-4">Active exams</th>
												<th className="p-4">Monthly attempts</th>
											</tr>
										</thead>
										<tbody className="divide-y">
											{organizations.rows.map((org) => (
												<tr key={org.id}>
													<td className="p-4">
														<p className="font-medium">{org.name}</p>
														<p className="text-xs text-muted-foreground">
															{org.slug}
														</p>
													</td>
													<td className="p-4">
														<select
															value={org.planId}
															disabled={pending}
															onChange={async (e) => {
																setPending(true);
																try {
																	await assignOrganizationPlan({
																		data: {
																			organizationId: org.id,
																			planId: e.target.value,
																		},
																	});
																	await reloadOrganizations();
																} catch (cause) {
																	setError(
																		cause instanceof Error
																			? cause.message
																			: "Unable to assign plan.",
																	);
																} finally {
																	setPending(false);
																}
															}}
															className="h-9 rounded-md border bg-transparent px-2"
														>
															{plansData.plans
																.filter(
																	(plan) =>
																		plan.isActive || plan.id === org.planId,
																)
																.map((plan) => (
																	<option key={plan.id} value={plan.id}>
																		{plan.name}
																		{plan.isActive ? "" : " (inactive)"}
																	</option>
																))}
														</select>
													</td>
													<td className="p-4">
														<Badge
															variant={
																org.status === "active"
																	? "secondary"
																	: "destructive"
															}
														>
															{org.status}
														</Badge>
													</td>
													<td className="p-4">
														<span
															className={
																org.memberCount / org.memberLimit >= 0.8
																	? "font-medium text-destructive"
																	: ""
															}
														>
															{org.memberCount} / {org.memberLimit}
														</span>
													</td>
													<td className="p-4">
														{org.activeExamCount} / {org.activeExamLimit}
													</td>
													<td className="p-4">
														<span
															className={
																org.monthlyAttemptCount /
																	org.monthlyAttemptLimit >=
																0.8
																	? "font-medium text-destructive"
																	: ""
															}
														>
															{org.monthlyAttemptCount.toLocaleString()} /{" "}
															{org.monthlyAttemptLimit.toLocaleString()}
														</span>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
								<div className="flex items-center justify-between border-t p-4">
									<p className="text-sm text-muted-foreground">
										{organizations.total} organizations
									</p>
									<div className="flex gap-2">
										<Button
											variant="outline"
											size="sm"
											disabled={page <= 1}
											onClick={() => {
												const next = page - 1;
												setPage(next);
												void reloadOrganizations(next);
											}}
										>
											Previous
										</Button>
										<Button
											variant="outline"
											size="sm"
											disabled={page >= organizations.pageCount}
											onClick={() => {
												const next = page + 1;
												setPage(next);
												void reloadOrganizations(next);
											}}
										>
											Next
										</Button>
									</div>
								</div>
							</section>
						</TabsContent>
					</Tabs>
				</div>
			</main>
			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent>
					<form onSubmit={savePlan}>
						<DialogHeader>
							<DialogTitle>{editing ? "Edit plan" : "Create plan"}</DialogTitle>
							<DialogDescription>
								Limits must be positive integers. Existing workspaces cannot be
								pushed below current usage.
							</DialogDescription>
						</DialogHeader>
						<div className="grid gap-4 py-5">
							<label
								htmlFor="plan-name"
								className="space-y-2 text-sm font-medium"
							>
								Name
								<Input
									id="plan-name"
									value={form.name}
									onValueChange={(name) => setForm({ ...form, name })}
								/>
							</label>
							<label
								htmlFor="plan-slug"
								className="space-y-2 text-sm font-medium"
							>
								Slug
								<Input
									id="plan-slug"
									value={form.slug}
									onValueChange={(slug) => setForm({ ...form, slug })}
								/>
							</label>
							<label
								htmlFor="plan-description"
								className="space-y-2 text-sm font-medium"
							>
								Description
								<Input
									id="plan-description"
									value={form.description}
									onValueChange={(description) =>
										setForm({ ...form, description })
									}
									maxLength={160}
								/>
							</label>
							<div className="grid grid-cols-3 gap-3">
								<label
									htmlFor="plan-members"
									className="space-y-2 text-sm font-medium"
								>
									Members
									<Input
										id="plan-members"
										type="number"
										value={String(form.memberLimit)}
										onValueChange={(v) =>
											setForm({ ...form, memberLimit: Number(v) })
										}
									/>
								</label>
								<label
									htmlFor="plan-exams"
									className="space-y-2 text-sm font-medium"
								>
									Exams
									<Input
										id="plan-exams"
										type="number"
										value={String(form.activeExamLimit)}
										onValueChange={(v) =>
											setForm({ ...form, activeExamLimit: Number(v) })
										}
									/>
								</label>
								<label
									htmlFor="plan-attempts"
									className="space-y-2 text-sm font-medium"
								>
									Attempts
									<Input
										id="plan-attempts"
										type="number"
										value={String(form.monthlyAttemptLimit)}
										onValueChange={(v) =>
											setForm({ ...form, monthlyAttemptLimit: Number(v) })
										}
									/>
								</label>
							</div>
							{error ? (
								<p className="text-sm text-destructive">{error}</p>
							) : null}
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setDialogOpen(false)}
							>
								Cancel
							</Button>
							<Button disabled={pending}>
								{pending ? "Saving…" : "Save plan"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
			<AlertDialog
				open={Boolean(togglePlan)}
				onOpenChange={(open) => {
					if (!open) setTogglePlan(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{togglePlan?.isActive ? "Deactivate plan?" : "Activate plan?"}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{togglePlan?.isActive
								? "Existing organizations keep this plan, but it cannot be newly assigned."
								: "This plan will become available for assignment."}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={() => void confirmToggle()}>
							Continue
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</PlatformAdminShell>
	);
}
