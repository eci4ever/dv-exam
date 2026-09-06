import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Send, Users } from "lucide-react";
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
import { Textarea } from "#/components/ui/textarea";
import { getSession } from "#/lib/auth.functions";
import {
	assignCandidate,
	getExaminationEditor,
	saveQuestion,
	updateExaminationStatus,
} from "#/lib/examination.functions";

export const Route = createFileRoute("/examinations/$examId")({
	beforeLoad: async () => {
		const session = await getSession();
		if (!session) throw redirect({ to: "/login" });
		return { user: session.user };
	},
	loader: ({ params }) =>
		getExaminationEditor({ data: { examinationId: params.examId } }),
	component: EditorPage,
});

function EditorPage() {
	const { user } = Route.useRouteContext();
	const data = Route.useLoaderData();
	const router = useRouter();
	const save = useServerFn(saveQuestion);
	const assign = useServerFn(assignCandidate);
	const status = useServerFn(updateExaminationStatus);
	const [prompt, setPrompt] = useState("");
	const [points, setPoints] = useState("1");
	const [options, setOptions] = useState(["", ""]);
	const [correct, setCorrect] = useState("0");
	const [candidateId, setCandidateId] = useState("");
	const [notice, setNotice] = useState("");
	const [working, setWorking] = useState(false);
	async function refresh(work: () => Promise<unknown>, success: string) {
		setWorking(true);
		setNotice("");
		try {
			await work();
			setNotice(success);
			await router.invalidate({ sync: true });
		} catch (error) {
			setNotice(
				error instanceof Error ? error.message : "Unable to save changes.",
			);
		} finally {
			setWorking(false);
		}
	}
	return (
		<DashboardShell user={user} pageTitle="Examination editor">
			<div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
				<section className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<p className="text-sm text-muted-foreground">MCQ examination</p>
						<h1 className="mt-1 text-2xl font-semibold tracking-tight">
							{(data.exam as any).title}
						</h1>
					</div>
					<Badge>{(data.exam as any).status}</Badge>
				</section>
				{notice ? (
					<p className="rounded-md border p-3 text-sm">{notice}</p>
				) : null}
				<div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle>Questions</CardTitle>
								<CardDescription>
									Add one correct option for every question.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								<Textarea
									onChange={(event) => setPrompt(event.target.value)}
									placeholder="Question prompt"
									value={prompt}
								/>
								{options.map((option, index) => (
									<div className="flex items-center gap-2" key={option}>
										<input
											checked={correct === String(index)}
											name="correct"
											onChange={() => setCorrect(String(index))}
											type="radio"
										/>
										<Input
											onChange={(event) =>
												setOptions(
													options.map((item, itemIndex) =>
														itemIndex === index ? event.target.value : item,
													),
												)
											}
											placeholder={`Option ${index + 1}`}
											value={option}
										/>
									</div>
								))}
								<div className="flex gap-2">
									<Button
										onClick={() => setOptions([...options, ""])}
										type="button"
										variant="outline"
									>
										<Plus /> Option
									</Button>
									<Input
										className="w-24"
										min="1"
										onChange={(event) => setPoints(event.target.value)}
										type="number"
										value={points}
									/>
									<Button
										disabled={working || (data.exam as any).status !== "draft"}
										onClick={() =>
											refresh(async () => {
												await save({
													data: {
														examinationId: (data.exam as any).id,
														prompt,
														points: Number(points),
														options: options.map((label, index) => ({
															label,
															isCorrect: String(index) === correct,
														})),
													},
												});
												setPrompt("");
												setOptions(["", ""]);
											}, "Question saved.")
										}
										type="button"
									>
										Save question
									</Button>
								</div>
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<CardTitle>Saved questions</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								{(data.questions as any[]).map((question) => (
									<div className="rounded-md border p-3" key={question.id}>
										<p className="font-medium">
											{question.position}. {question.prompt}
										</p>
										<p className="text-sm text-muted-foreground">
											{question.points} point(s)
										</p>
									</div>
								))}
								{!(data.questions as any[]).length ? (
									<p className="text-sm text-muted-foreground">
										No questions yet.
									</p>
								) : null}
							</CardContent>
						</Card>
					</div>
					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Users className="size-4" /> Candidates
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								<select
									className="h-9 w-full rounded-md border bg-background px-3 text-sm"
									onChange={(event) => setCandidateId(event.target.value)}
									value={candidateId}
								>
									<option value="">Choose an organisation member</option>
									{(data.members as any[]).map((member) => (
										<option key={member.id} value={member.id}>
											{member.name} · {member.email}
										</option>
									))}
								</select>
								<Button
									disabled={
										!candidateId ||
										working ||
										(data.exam as any).status !== "draft"
									}
									onClick={() =>
										refresh(
											() =>
												assign({
													data: {
														examinationId: (data.exam as any).id,
														userId: candidateId,
													},
												}),
											"Candidate assigned.",
										)
									}
									type="button"
									variant="outline"
								>
									Assign candidate
								</Button>
								<div className="space-y-2">
									{(data.assignments as any[]).map((candidate) => (
										<p className="text-sm" key={candidate.id}>
											{candidate.name}{" "}
											<span className="text-muted-foreground">
												{candidate.email}
											</span>
										</p>
									))}
								</div>
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<CardTitle>Publication</CardTitle>
								<CardDescription>
									Publishing makes the examination available to assigned
									candidates.
								</CardDescription>
							</CardHeader>
							<CardContent className="flex flex-wrap gap-2">
								<Button
									disabled={working || (data.exam as any).status !== "draft"}
									onClick={() =>
										refresh(
											() =>
												status({
													data: {
														examinationId: (data.exam as any).id,
														action: "publish",
													},
												}),
											"Examination published.",
										)
									}
									type="button"
								>
									<Send /> Publish
								</Button>
								<Button
									disabled={
										working || (data.exam as any).status !== "published"
									}
									onClick={() =>
										refresh(
											() =>
												status({
													data: {
														examinationId: (data.exam as any).id,
														action: "close",
													},
												}),
											"Examination closed.",
										)
									}
									type="button"
									variant="outline"
								>
									Close
								</Button>
								<Button
									disabled={working || (data.exam as any).status !== "closed"}
									onClick={() =>
										refresh(
											() =>
												status({
													data: {
														examinationId: (data.exam as any).id,
														action: "publish-results",
													},
												}),
											"Results published.",
										)
									}
									type="button"
									variant="outline"
								>
									Publish results
								</Button>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</DashboardShell>
	);
}
