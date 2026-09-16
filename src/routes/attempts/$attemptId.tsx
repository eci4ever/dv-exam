import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { WorkspaceShell } from "@/components/workspace-shell";
import {
	getLearnerAttempt,
	saveAttemptResponse,
	submitExamAttempt,
} from "@/lib/exam-delivery";
import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/attempts/$attemptId")({
	beforeLoad: async () => {
		const data = await getDashboardSession();
		if (!data) throw redirect({ to: "/login" });
		if (!data.organizationRole?.split(",").includes("student"))
			throw redirect({ to: "/dashboard" });
		return data;
	},
	component: AttemptPage,
});

function timeLabel(milliseconds: number) {
	const total = Math.max(0, Math.ceil(milliseconds / 1000));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = total % 60;
	return [hours, minutes, seconds]
		.filter((_, index) => hours > 0 || index > 0)
		.map((part) => String(part).padStart(2, "0"))
		.join(":");
}

function AttemptPage() {
	const data = Route.useRouteContext();
	const { attemptId } = Route.useParams();
	const navigate = useNavigate();
	const [result, setResult] = useState<Awaited<
		ReturnType<typeof getLearnerAttempt>
	> | null>(null);
	const [remaining, setRemaining] = useState(0);
	const [saveState, setSaveState] = useState("All answers saved");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const submitting = useRef(false);
	const finish = useCallback(async () => {
		if (submitting.current) return;
		submitting.current = true;
		setPending(true);
		try {
			await submitExamAttempt({ data: { attemptId } });
			await navigate({ to: "/results/$attemptId", params: { attemptId } });
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "Unable to submit exam.",
			);
			submitting.current = false;
			setPending(false);
		}
	}, [attemptId, navigate]);
	useEffect(() => {
		void getLearnerAttempt({ data: { attemptId } })
			.then((next) => {
				if (next.attempt.status !== "in_progress") {
					void navigate({ to: "/results/$attemptId", params: { attemptId } });
					return;
				}
				setResult(next);
				setRemaining(new Date(next.attempt.deadlineAt).getTime() - Date.now());
			})
			.catch((caught) =>
				setError(
					caught instanceof Error ? caught.message : "Unable to load attempt.",
				),
			);
	}, [attemptId, navigate]);
	useEffect(() => {
		if (!result) return;
		const timer = window.setInterval(() => {
			const next = new Date(result.attempt.deadlineAt).getTime() - Date.now();
			setRemaining(next);
			if (next <= 0) {
				window.clearInterval(timer);
				void finish();
			}
		}, 1000);
		return () => window.clearInterval(timer);
	}, [finish, result]);
	const choose = async (examItemId: string, selectedOptionId: string) => {
		setResult((current) =>
			current
				? {
						...current,
						items: current.items.map((item) =>
							item.id === examItemId ? { ...item, selectedOptionId } : item,
						),
					}
				: current,
		);
		setSaveState("Saving…");
		setError(null);
		try {
			await saveAttemptResponse({
				data: { attemptId, examItemId, selectedOptionId },
			});
			setSaveState("All answers saved");
		} catch (caught) {
			setSaveState("Save failed");
			setError(
				caught instanceof Error ? caught.message : "Unable to save answer.",
			);
		}
	};
	return (
		<WorkspaceShell data={data} activeItem="my-exams" title="Exam attempt">
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
					{result ? (
						<>
							<div className="sticky top-0 z-10 flex items-center justify-between rounded-xl border bg-card p-4">
								<div>
									<h1 className="font-semibold">{result.title}</h1>
									<p className="text-xs text-muted-foreground">{saveState}</p>
								</div>
								<div className="text-right">
									<p className="font-mono text-lg font-semibold tabular-nums">
										{timeLabel(remaining)}
									</p>
									<p className="text-xs text-muted-foreground">
										Time remaining
									</p>
								</div>
							</div>
							<div className="space-y-5">
								{result.items.map((item, index) => (
									<fieldset
										className="rounded-xl border bg-card p-5"
										key={item.id}
										disabled={pending}
									>
										<legend className="sr-only">Question {index + 1}</legend>
										<div className="flex gap-3">
											<span className="text-sm font-medium text-muted-foreground">
												{index + 1}.
											</span>
											<div className="flex-1">
												<p className="font-medium leading-6">{item.prompt}</p>
												<p className="mt-1 text-xs text-muted-foreground">
													{item.marks} {item.marks === 1 ? "mark" : "marks"}
												</p>
												<div className="mt-4 grid gap-2">
													{item.options.map((option) => (
														<label
															className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-checked:border-foreground has-checked:bg-muted/50"
															key={option.id}
														>
															<input
																className="mt-1"
																type="radio"
																name={item.id}
																checked={item.selectedOptionId === option.id}
																onChange={() => void choose(item.id, option.id)}
															/>
															<span className="text-sm">{option.text}</span>
														</label>
													))}
												</div>
											</div>
										</div>
									</fieldset>
								))}
							</div>
							<div className="flex items-center justify-between rounded-xl border bg-card p-4">
								<p className="text-sm text-muted-foreground">
									Review your answers before submitting.
								</p>
								<Button disabled={pending} onClick={() => void finish()}>
									{pending ? "Submitting…" : "Submit exam"}
								</Button>
							</div>
						</>
					) : (
						<p className="text-sm text-muted-foreground">Loading your exam…</p>
					)}
					{error ? (
						<p className="text-sm text-destructive" role="alert">
							{error}
						</p>
					) : null}
				</div>
			</main>
		</WorkspaceShell>
	);
}
