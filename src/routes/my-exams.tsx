import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkspaceShell } from "@/components/workspace-shell";
import { listMyExamDeliveries, startExamAttempt } from "@/lib/exam-delivery";
import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/my-exams")({
	beforeLoad: async () => {
		const data = await getDashboardSession();
		if (!data) throw redirect({ to: "/login" });
		if (!data.organizationRole?.split(",").includes("student"))
			throw redirect({ to: "/dashboard" });
		return data;
	},
	component: MyExamsPage,
});

function MyExamsPage() {
	const data = Route.useRouteContext();
	const navigate = useNavigate();
	const [rows, setRows] = useState<
		Awaited<ReturnType<typeof listMyExamDeliveries>>
	>([]);
	const [loading, setLoading] = useState(true);
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		void listMyExamDeliveries()
			.then(setRows)
			.catch((caught) =>
				setError(
					caught instanceof Error ? caught.message : "Unable to load exams.",
				),
			)
			.finally(() => setLoading(false));
	}, []);
	const groups = useMemo(
		() => ({
			available: rows.filter(
				(row) =>
					row.scheduleStatus === "open" &&
					row.recipientStatus === "not_started",
			),
			inProgress: rows.filter((row) => row.recipientStatus === "in_progress"),
			upcoming: rows.filter((row) => row.scheduleStatus === "scheduled"),
			completed: rows.filter((row) =>
				["submitted", "timed_out"].includes(row.recipientStatus),
			),
			missed: rows.filter((row) => row.recipientStatus === "missed"),
		}),
		[rows],
	);
	const begin = async (scheduleId: string) => {
		setPendingId(scheduleId);
		setError(null);
		try {
			const attempt = await startExamAttempt({ data: { scheduleId } });
			await navigate({
				to: "/attempts/$attemptId",
				params: { attemptId: attempt.id },
			});
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "Unable to start exam.",
			);
		} finally {
			setPendingId(null);
		}
	};
	return (
		<WorkspaceShell data={data} activeItem="my-exams" title="My Exams">
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto flex w-full max-w-5xl flex-col gap-7">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight">My exams</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							View upcoming exams and continue your current attempt.
						</p>
					</div>
					{error ? (
						<p className="text-sm text-destructive" role="alert">
							{error}
						</p>
					) : null}
					{loading ? (
						<p className="text-sm text-muted-foreground">Loading exams…</p>
					) : (
						(Object.entries(groups) as Array<[string, typeof rows]>).map(
							([group, exams]) =>
								exams.length ? (
									<section className="space-y-3" key={group}>
										<h2 className="text-sm font-medium capitalize">
											{group.replace(/([A-Z])/g, " $1")}
										</h2>
										<div className="grid gap-3">
											{exams.map((exam) => (
												<article
													className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
													key={exam.id}
												>
													<div>
														<div className="flex items-center gap-2">
															<h3 className="font-medium">{exam.title}</h3>
															<Badge variant="secondary">
																{exam.recipientStatus.replace("_", " ")}
															</Badge>
														</div>
														<p className="mt-1 text-xs text-muted-foreground">
															Version {exam.version} · {exam.durationMinutes}{" "}
															min
														</p>
														<p className="mt-1 text-xs text-muted-foreground">
															{new Date(exam.opensAt).toLocaleString()} –{" "}
															{new Date(exam.closesAt).toLocaleString()}
														</p>
													</div>
													{exam.recipientStatus === "in_progress" &&
													exam.attempt ? (
														<Button
															onClick={() =>
																navigate({
																	to: "/attempts/$attemptId",
																	params: { attemptId: exam.attempt?.id ?? "" },
																})
															}
														>
															Continue
														</Button>
													) : exam.scheduleStatus === "open" &&
														exam.recipientStatus === "not_started" ? (
														<Button
															disabled={pendingId === exam.id}
															onClick={() => void begin(exam.id)}
														>
															{pendingId === exam.id
																? "Starting…"
																: "Start exam"}
														</Button>
													) : ["submitted", "timed_out"].includes(
															exam.recipientStatus,
														) && exam.attempt ? (
														<Button
															variant="outline"
															onClick={() =>
																navigate({
																	to: "/results/$attemptId",
																	params: { attemptId: exam.attempt?.id ?? "" },
																})
															}
														>
															View result
														</Button>
													) : null}
												</article>
											))}
										</div>
									</section>
								) : null,
						)
					)}
					{!loading && rows.length === 0 ? (
						<div className="rounded-xl border bg-card p-8 text-center">
							<p className="font-medium">No assigned exams</p>
							<p className="mt-1 text-sm text-muted-foreground">
								Scheduled exams will appear here.
							</p>
						</div>
					) : null}
				</div>
			</main>
		</WorkspaceShell>
	);
}
