import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listMyResults } from "@/lib/exam-delivery";
import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/results/")({
	beforeLoad: async () => {
		const data = await getDashboardSession();
		if (!data) throw redirect({ to: "/login" });
		if (!data.organizationRole?.split(",").includes("student"))
			throw redirect({ to: "/dashboard" });
		throw redirect({ to: "/my-exams", search: { tab: "results" } });
	},
});

export function ResultsContent({ embedded = false }: { embedded?: boolean }) {
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
		<div
			className={
				embedded ? "flex flex-col gap-6" : "flex flex-1 p-4 sm:p-6 lg:p-8"
			}
		>
			<div
				className={
					embedded
						? "flex w-full flex-col gap-6"
						: "mx-auto flex w-full max-w-5xl flex-col gap-6"
				}
			>
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
									<Badge variant={row.attempt.passed ? "default" : "secondary"}>
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
		</div>
	);
}
