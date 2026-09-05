import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "#/components/dashboard-shell";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { getSession } from "#/lib/auth.functions";
import {
	getCandidateAttempt,
	saveCandidateAnswer,
	submitCandidateAttempt,
} from "#/lib/examination.functions";
export const Route = createFileRoute("/take/$assignmentId")({
	beforeLoad: async () => {
		const session = await getSession();
		if (!session) throw redirect({ to: "/login" });
		return { user: session.user };
	},
	loader: ({ params }) =>
		getCandidateAttempt({ data: { assignmentId: params.assignmentId } }),
	component: AttemptPage,
});
function AttemptPage() {
	const { user } = Route.useRouteContext();
	const data = Route.useLoaderData() as any;
	const router = useRouter();
	const save = useServerFn(saveCandidateAnswer);
	const submit = useServerFn(submitCandidateAttempt);
	const [answers, setAnswers] = useState<Record<string, string>>(() =>
		Object.fromEntries(
			data.answers.map((answer: any) => [answer.questionId, answer.optionId]),
		),
	);
	const [notice, setNotice] = useState("");
	const [now, setNow] = useState(Date.now());
	useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(timer);
	}, []);
	const remaining = Math.max(
		0,
		Number(data.assignment.startedAt) +
			Number(data.assignment.durationMinutes) * 60000 -
			now,
	);
	const options = useMemo(
		() =>
			data.options.reduce(
				(all: Record<string, any[]>, option: any) => ({
					...all,
					[option.questionId]: [...(all[option.questionId] ?? []), option],
				}),
				{},
			),
		[data.options],
	);
	async function choose(questionId: string, optionId: string) {
		setAnswers({ ...answers, [questionId]: optionId });
		try {
			await save({
				data: { attemptId: data.assignment.attemptId, questionId, optionId },
			});
		} catch (error) {
			setNotice(
				error instanceof Error ? error.message : "Unable to save answer.",
			);
		}
	}
	async function finish() {
		try {
			await submit({ data: { attemptId: data.assignment.attemptId } });
			setNotice("Your answers have been submitted.");
			await router.invalidate({ sync: true });
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Unable to submit.");
		}
	}
	return (
		<DashboardShell user={user} pageTitle="Take examination">
			<div className="mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-6">
				<section className="flex items-center justify-between gap-3">
					<div>
						<p className="text-sm text-muted-foreground">
							{data.assignment.title}
						</p>
						<h1 className="text-2xl font-semibold">Your examination</h1>
					</div>
					<p className="font-mono text-sm">
						{Math.floor(remaining / 60000)}:
						{String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0")}
					</p>
				</section>
				{notice ? (
					<p className="rounded-md border p-3 text-sm">{notice}</p>
				) : null}
				{data.assignment.attemptStatus === "submitted" ? (
					<Card>
						<CardContent className="p-6 text-center text-sm text-muted-foreground">
							Submitted. Your result will be available when your organisation
							publishes it.
						</CardContent>
					</Card>
				) : (
					data.questions.map((question: any) => (
						<Card key={question.id}>
							<CardHeader>
								<CardTitle className="text-base">
									{question.position}. {question.prompt}
								</CardTitle>
							</CardHeader>
							<CardContent className="grid gap-2">
								{(options[question.id] ?? []).map((option: any) => (
									<label
										className="flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm"
										key={option.id}
									>
										<input
											checked={answers[question.id] === option.id}
											name={question.id}
											onChange={() => choose(question.id, option.id)}
											type="radio"
										/>
										{option.label}
									</label>
								))}
							</CardContent>
						</Card>
					))
				)}
				{data.assignment.attemptStatus !== "submitted" ? (
					<Button className="w-full" onClick={finish}>
						Submit examination
					</Button>
				) : null}
			</div>
		</DashboardShell>
	);
}
