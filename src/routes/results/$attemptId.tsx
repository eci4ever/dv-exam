import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getMyExamResult } from "@/lib/exam-delivery";
import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/results/$attemptId")({
	beforeLoad: async () => {
		const data = await getDashboardSession();
		if (!data) throw redirect({ to: "/login" });
		if (!data.organizationRole?.split(",").includes("student"))
			throw redirect({ to: "/dashboard" });
		return data;
	},
	component: ResultPage,
});

function ResultPage() {
	const data = Route.useRouteContext();
	const { attemptId } = Route.useParams();
	const [result, setResult] = useState<Awaited<
		ReturnType<typeof getMyExamResult>
	> | null>(null);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		void getMyExamResult({ data: { attemptId } })
			.then(setResult)
			.catch((caught) =>
				setError(
					caught instanceof Error ? caught.message : "Unable to load result.",
				),
			);
	}, [attemptId]);
	return (
		<WorkspaceShell data={data} activeItem="results" title="Exam result">
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
					{result ? (
						<>
							<div className="rounded-xl border bg-card p-6">
								<div className="flex flex-wrap items-center justify-between gap-3">
									<div>
										<p className="text-sm text-muted-foreground">Exam result</p>
										<h1 className="mt-1 text-2xl font-semibold">
											{result.title}
										</h1>
									</div>
									<Badge
										variant={result.attempt.passed ? "default" : "secondary"}
									>
										{result.attempt.passed ? "Passed" : "Not passed"}
									</Badge>
								</div>
								<div className="mt-6 grid grid-cols-3 gap-4">
									<div>
										<p className="text-2xl font-semibold">
											{result.attempt.score}/{result.attempt.maxScore}
										</p>
										<p className="text-xs text-muted-foreground">Score</p>
									</div>
									<div>
										<p className="text-2xl font-semibold">
											{result.attempt.percentage}%
										</p>
										<p className="text-xs text-muted-foreground">Percentage</p>
									</div>
									<div>
										<p className="text-2xl font-semibold capitalize">
											{result.attempt.status.replace("_", " ")}
										</p>
										<p className="text-xs text-muted-foreground">Status</p>
									</div>
								</div>
							</div>
							{result.reviewAvailable ? (
								<div className="space-y-4">
									{result.items.map((item, index) => (
										<article
											className="rounded-xl border bg-card p-5"
											key={item.id}
										>
											<div className="flex items-start justify-between gap-4">
												<p className="font-medium">
													{index + 1}. {item.prompt}
												</p>
												<span className="text-sm text-muted-foreground">
													{item.earnedMarks}/{item.marks}
												</span>
											</div>
											<div className="mt-4 grid gap-2">
												{item.options.map((option) => {
													const selected = option.id === item.selectedOptionId;
													const correct = option.id === item.correctOptionId;
													return (
														<div
															className="flex items-center justify-between rounded-lg border p-3 text-sm"
															key={option.id}
														>
															<span>{option.text}</span>
															<span
																className={
																	correct
																		? "text-foreground"
																		: "text-muted-foreground"
																}
															>
																{correct
																	? "Correct answer"
																	: selected
																		? "Your answer"
																		: ""}
															</span>
														</div>
													);
												})}
											</div>
											{item.explanation ? (
												<div className="mt-4 rounded-lg bg-muted p-3">
													<p className="text-xs font-medium">Explanation</p>
													<p className="mt-1 text-sm text-muted-foreground">
														{item.explanation}
													</p>
												</div>
											) : null}
										</article>
									))}
								</div>
							) : (
								<div className="rounded-xl border bg-card p-6">
									<p className="font-medium">
										Detailed review is not available yet
									</p>
									<p className="mt-1 text-sm text-muted-foreground">
										Correct answers and explanations will be available after the
										exam closes on {new Date(result.closesAt).toLocaleString()}.
									</p>
								</div>
							)}
						</>
					) : (
						<p className="text-sm text-muted-foreground">Loading result…</p>
					)}
					{error ? <p className="text-sm text-destructive">{error}</p> : null}
				</div>
			</main>
		</WorkspaceShell>
	);
}
