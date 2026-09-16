import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkspaceShell } from "@/components/workspace-shell";
import {
	createExamSchedule,
	listPublishedExamChoices,
	userCanManageDelivery,
} from "@/lib/exam-delivery";
import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/schedule/new")({
	beforeLoad: async () => {
		const data = await getDashboardSession();
		if (!data) throw redirect({ to: "/login" });
		if (!userCanManageDelivery(data.organizationRole))
			throw redirect({ to: "/dashboard" });
		return data;
	},
	component: NewSchedulePage,
});

function NewSchedulePage() {
	const data = Route.useRouteContext();
	const navigate = useNavigate();
	const [exams, setExams] = useState<
		Awaited<ReturnType<typeof listPublishedExamChoices>>
	>([]);
	const [examId, setExamId] = useState("");
	const [opensAt, setOpensAt] = useState("");
	const [closesAt, setClosesAt] = useState("");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		void listPublishedExamChoices()
			.then(setExams)
			.catch((caught) =>
				setError(
					caught instanceof Error ? caught.message : "Unable to load exams.",
				),
			);
	}, []);
	const selected = exams.find((exam) => exam.id === examId);
	return (
		<WorkspaceShell data={data} activeItem="schedule" title="Schedule exam">
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto w-full max-w-2xl space-y-6">
					<div>
						<h1 className="text-2xl font-semibold">Schedule an exam</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							The current student roster will be captured when you create this
							schedule.
						</p>
					</div>
					<form
						className="space-y-5 rounded-xl border bg-card p-5 sm:p-6"
						onSubmit={async (event) => {
							event.preventDefault();
							setPending(true);
							setError(null);
							try {
								const result = await createExamSchedule({
									data: {
										examId,
										opensAt: new Date(opensAt).toISOString(),
										closesAt: new Date(closesAt).toISOString(),
									},
								});
								await navigate({
									to: "/schedule/$scheduleId",
									params: { scheduleId: result.id },
								});
							} catch (caught) {
								setError(
									caught instanceof Error
										? caught.message
										: "Unable to create schedule.",
								);
							} finally {
								setPending(false);
							}
						}}
					>
						<div className="space-y-2">
							<label className="text-sm font-medium" htmlFor="exam">
								Published exam
							</label>
							<select
								id="exam"
								required
								className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
								value={examId}
								onChange={(event) => setExamId(event.target.value)}
							>
								<option value="">Select an exam</option>
								{exams.map((exam) => (
									<option key={exam.id} value={exam.id}>
										{exam.title} · v{exam.version}
									</option>
								))}
							</select>
							{selected ? (
								<p className="text-xs text-muted-foreground">
									{selected.durationMinutes} minutes ·{" "}
									{selected.passingPercentage}% pass mark
								</p>
							) : null}
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<label className="text-sm font-medium" htmlFor="opens">
									Opens
								</label>
								<Input
									id="opens"
									type="datetime-local"
									required
									value={opensAt}
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
									required
									value={closesAt}
									onValueChange={setClosesAt}
								/>
							</div>
						</div>
						{error ? <p className="text-sm text-destructive">{error}</p> : null}
						<div className="flex gap-3">
							<Button type="submit" disabled={pending}>
								{pending ? "Scheduling…" : "Schedule exam"}
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={() => navigate({ to: "/schedule" })}
							>
								Cancel
							</Button>
						</div>
					</form>
				</div>
			</main>
		</WorkspaceShell>
	);
}
