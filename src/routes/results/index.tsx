import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkspaceShell } from "@/components/workspace-shell";
import { listMyResults } from "@/lib/exam-delivery";
import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/results/")({
	beforeLoad: async () => {
		const data = await getDashboardSession();
		if (!data) throw redirect({ to: "/login" });
		if (!data.organizationRole?.split(",").includes("student"))
			throw redirect({ to: "/dashboard" });
		return data;
	},
	component: ResultsPage,
});

function ResultsPage() {
	const data = Route.useRouteContext();
	const navigate = useNavigate();
	const [rows, setRows] = useState<Awaited<ReturnType<typeof listMyResults>>>(
		[],
	);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		void listMyResults()
			.then(setRows)
			.catch((caught) =>
				setError(
					caught instanceof Error ? caught.message : "Unable to load results.",
				),
			);
	}, []);
	return (
		<WorkspaceShell data={data} activeItem="results" title="Results">
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
					<div>
						<h1 className="text-2xl font-semibold">Results</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							Scores from your completed exams.
						</p>
					</div>
					{error ? <p className="text-sm text-destructive">{error}</p> : null}
					<div className="grid gap-3">
						{rows.map((row) => (
							<article
								className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
								key={row.attempt.id}
							>
								<div>
									<div className="flex items-center gap-2">
										<p className="font-medium">{row.title}</p>
										<Badge
											variant={row.attempt.passed ? "default" : "secondary"}
										>
											{row.attempt.passed ? "Passed" : "Not passed"}
										</Badge>
									</div>
									<p className="mt-1 text-sm text-muted-foreground">
										{row.attempt.score}/{row.attempt.maxScore} ·{" "}
										{row.attempt.percentage}%
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										Submitted{" "}
										{row.attempt.submittedAt
											? new Date(row.attempt.submittedAt).toLocaleString()
											: "—"}
									</p>
								</div>
								<Button
									variant="outline"
									onClick={() =>
										navigate({
											to: "/results/$attemptId",
											params: { attemptId: row.attempt.id },
										})
									}
								>
									View result
								</Button>
							</article>
						))}
						{rows.length === 0 ? (
							<div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
								No completed exams yet.
							</div>
						) : null}
					</div>
				</div>
			</main>
		</WorkspaceShell>
	);
}
