import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkspaceShell } from "@/components/workspace-shell";
import { listExamSchedules, userCanManageDelivery } from "@/lib/exam-delivery";
import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/schedule/")({
	beforeLoad: async () => {
		const data = await getDashboardSession();
		if (!data) throw redirect({ to: "/login" });
		if (!userCanManageDelivery(data.organizationRole))
			throw redirect({ to: "/dashboard" });
		return data;
	},
	component: SchedulePage,
});

function dateTime(value: Date) {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function SchedulePage() {
	const data = Route.useRouteContext();
	const navigate = useNavigate();
	const [rows, setRows] = useState<
		Awaited<ReturnType<typeof listExamSchedules>>
	>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		void listExamSchedules()
			.then(setRows)
			.catch((caught) =>
				setError(
					caught instanceof Error
						? caught.message
						: "Unable to load schedules.",
				),
			)
			.finally(() => setLoading(false));
	}, []);
	return (
		<WorkspaceShell data={data} activeItem="schedule" title="Schedule">
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
					<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
						<div>
							<h1 className="text-2xl font-semibold tracking-tight">
								Exam schedule
							</h1>
							<p className="mt-1 text-sm text-muted-foreground">
								Deliver published exams to the current student roster.
							</p>
						</div>
						<Button onClick={() => navigate({ to: "/schedule/new" })}>
							<PlusIcon />
							Schedule exam
						</Button>
					</div>
					{error ? <p className="text-sm text-destructive">{error}</p> : null}
					<div className="overflow-hidden rounded-xl border bg-card">
						{loading ? (
							<p className="p-8 text-center text-sm text-muted-foreground">
								Loading schedules…
							</p>
						) : rows.length ? (
							rows.map((row) => (
								<button
									className="flex w-full flex-col gap-3 border-b p-4 text-left last:border-0 hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
									key={row.id}
									type="button"
									onClick={() =>
										navigate({
											to: "/schedule/$scheduleId",
											params: { scheduleId: row.id },
										})
									}
								>
									<div>
										<div className="flex items-center gap-2">
											<p className="font-medium">{row.examTitle}</p>
											<Badge
												variant={
													row.status === "open" ? "default" : "secondary"
												}
											>
												{row.status}
											</Badge>
										</div>
										<p className="mt-1 text-xs text-muted-foreground">
											Version {row.examVersion} · {row.durationMinutes} min ·{" "}
											{row.recipientCount} students
										</p>
									</div>
									<p className="text-sm text-muted-foreground">
										{dateTime(row.opensAt)} – {dateTime(row.closesAt)}
									</p>
								</button>
							))
						) : (
							<p className="p-8 text-center text-sm text-muted-foreground">
								No exams have been scheduled yet.
							</p>
						)}
					</div>
				</div>
			</main>
		</WorkspaceShell>
	);
}
