import {
	createFileRoute,
	Link,
	redirect,
	useRouter,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus, ClipboardList } from "lucide-react";
import { useState } from "react";
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
import { Input } from "#/components/ui/input";
import { getSession } from "#/lib/auth.functions";
import {
	createExamination,
	getExaminations,
} from "#/lib/examination.functions";
import { getOrganizationWorkspace } from "#/lib/organization.functions";

export const Route = createFileRoute("/examinations")({
	beforeLoad: async () => {
		const session = await getSession();
		if (!session) throw redirect({ to: "/login" });
		return { user: session.user };
	},
	loader: async () => {
		const workspace = await getOrganizationWorkspace();
		const active = workspace.organizations.find(
			(item) => item.id === workspace.activeOrganizationId,
		);
		if (!active || !["owner", "admin"].includes(active.role))
			throw redirect({ to: "/dashboard" });
		return {
			workspace,
			active,
			examinations: await getExaminations({
				data: { organizationId: active.id },
			}),
		};
	},
	component: ExaminationsPage,
});

function ExaminationsPage() {
	const { user } = Route.useRouteContext();
	const { workspace, active, examinations } = Route.useLoaderData();
	const router = useRouter();
	const create = useServerFn(createExamination);
	const [title, setTitle] = useState("");
	const [duration, setDuration] = useState("60");
	const [notice, setNotice] = useState("");
	const [saving, setSaving] = useState(false);
	async function submit(event: React.FormEvent) {
		event.preventDefault();
		setSaving(true);
		try {
			const result = await create({
				data: {
					title,
					durationMinutes: Number(duration),
				},
			});
			await router.navigate({
				to: "/examinations/$examId",
				params: { examId: result.id },
			});
		} catch (error) {
			setNotice(
				error instanceof Error
					? error.message
					: "Unable to create examination.",
			);
			setSaving(false);
		}
	}
	return (
		<DashboardShell
			user={user}
			organizationRole={active.role}
			pageTitle="Examinations"
		>
			<div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
				<section>
					<p className="text-sm text-muted-foreground">{active.name}</p>
					<h1 className="mt-1 text-2xl font-semibold tracking-tight">
						Examinations
					</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Create and publish MCQ examinations for your candidates.
					</p>
				</section>
				{notice ? (
					<p className="rounded-md border p-3 text-sm">{notice}</p>
				) : null}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Plus className="size-4" /> New examination
						</CardTitle>
					</CardHeader>
					<CardContent>
						<form
							className="grid gap-3 sm:grid-cols-[1fr_140px_auto]"
							onSubmit={submit}
						>
							<Input
								onChange={(event) => setTitle(event.target.value)}
								placeholder="Examination title"
								required
								value={title}
							/>
							<Input
								min="1"
								onChange={(event) => setDuration(event.target.value)}
								type="number"
								value={duration}
							/>
							<Button disabled={saving} type="submit">
								{saving ? "Creating…" : "Create draft"}
							</Button>
						</form>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>All examinations</CardTitle>
						<CardDescription>
							Drafts stay private until published.
						</CardDescription>
					</CardHeader>
					<CardContent className="divide-y">
						{examinations.length ? (
							examinations.map((exam: any) => (
								<Link
									className="flex items-center justify-between gap-3 py-4 transition-colors hover:text-primary"
									key={exam.id}
									params={{ examId: exam.id }}
									to="/examinations/$examId"
								>
									<span>
										<span className="block font-medium">{exam.title}</span>
										<span className="text-sm text-muted-foreground">
											{exam.candidateCount} candidates
										</span>
									</span>
									<Badge
										variant={
											exam.status === "published" ? "default" : "secondary"
										}
									>
										{exam.status}
									</Badge>
								</Link>
							))
						) : (
							<div className="grid place-items-center gap-2 py-12 text-center text-sm text-muted-foreground">
								<ClipboardList className="size-6" /> No examinations yet.
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</DashboardShell>
	);
}
