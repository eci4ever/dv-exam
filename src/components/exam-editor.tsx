import { useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	archiveExam,
	createExamVersion,
	type listExamQuestionChoices,
	publishExam,
	saveExamDraft,
} from "@/lib/exams";

type ExamData = Awaited<ReturnType<typeof import("@/lib/exams").getExam>>;
type Choice = Awaited<ReturnType<typeof listExamQuestionChoices>>[number];

export function ExamEditor({
	initial,
	choices,
}: {
	initial: ExamData;
	choices: Choice[];
}) {
	const navigate = useNavigate();
	const router = useRouter();
	const [title, setTitle] = useState(initial.title);
	const [description, setDescription] = useState(initial.description ?? "");
	const [duration, setDuration] = useState(initial.durationMinutes);
	const [passing, setPassing] = useState(initial.passingPercentage);
	const [shuffle, setShuffle] = useState(initial.shuffleQuestions);
	const [items, setItems] = useState(
		initial.items.map((item) => ({
			questionId: item.sourceQuestionId ?? item.id,
			marks: item.marks,
		})),
	);
	const [query, setQuery] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const editable = initial.status === "draft";
	const available = useMemo(
		() =>
			choices.filter(
				(choice) =>
					!items.some((item) => item.questionId === choice.id) &&
					choice.prompt.toLowerCase().includes(query.toLowerCase()),
			),
		[choices, items, query],
	);

	function move(index: number, direction: -1 | 1) {
		const next = [...items];
		const target = index + direction;
		if (target < 0 || target >= next.length) return;
		const currentItem = next[index];
		const targetItem = next[target];
		if (!currentItem || !targetItem) return;
		next[index] = targetItem;
		next[target] = currentItem;
		setItems(next);
	}

	async function run(action: () => Promise<unknown>) {
		setPending(true);
		setError(null);
		try {
			await action();
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "Unable to update exam.",
			);
		} finally {
			setPending(false);
		}
	}

	async function save() {
		await run(async () => {
			await saveExamDraft({
				data: {
					examId: initial.id,
					settings: {
						title,
						description,
						durationMinutes: duration,
						passingPercentage: passing,
						shuffleQuestions: shuffle,
					},
					items,
				},
			});
			await router.invalidate();
			await navigate({ to: "/exams" });
		});
	}

	return (
		<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
			<div className="space-y-6">
				<section className="space-y-5 rounded-xl border bg-card p-5 sm:p-6">
					<div className="grid gap-5 sm:grid-cols-2">
						<div className="space-y-2 sm:col-span-2">
							<label className="text-sm font-medium" htmlFor="exam-title">
								Title
							</label>
							<Input
								id="exam-title"
								value={title}
								onValueChange={setTitle}
								disabled={!editable}
							/>
						</div>
						<div className="space-y-2 sm:col-span-2">
							<label className="text-sm font-medium" htmlFor="exam-description">
								Description
							</label>
							<textarea
								id="exam-description"
								className="min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-sm"
								value={description}
								onChange={(event) => setDescription(event.target.value)}
								disabled={!editable}
							/>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium" htmlFor="exam-duration">
								Duration (minutes)
							</label>
							<Input
								id="exam-duration"
								type="number"
								min={1}
								max={300}
								value={String(duration)}
								onValueChange={(value) => setDuration(Number(value))}
								disabled={!editable}
							/>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium" htmlFor="exam-passing">
								Passing score (%)
							</label>
							<Input
								id="exam-passing"
								type="number"
								min={1}
								max={100}
								value={String(passing)}
								onValueChange={(value) => setPassing(Number(value))}
								disabled={!editable}
							/>
						</div>
					</div>
					<label className="flex items-center gap-3 text-sm">
						<input
							type="checkbox"
							checked={shuffle}
							onChange={(event) => setShuffle(event.target.checked)}
							disabled={!editable}
						/>
						Shuffle questions for students
					</label>
				</section>
				<section className="rounded-xl border bg-card">
					<div className="border-b p-5">
						<h2 className="font-semibold">Questions</h2>
						<p className="text-sm text-muted-foreground">
							{items.length} questions ·{" "}
							{items.reduce((sum, item) => sum + item.marks, 0)} total marks
						</p>
					</div>
					<div className="divide-y">
						{items.length ? (
							items.map((item, index) => {
								const choice = choices.find(
									(entry) => entry.id === item.questionId,
								);
								const snapshot = initial.items.find(
									(entry) =>
										(entry.sourceQuestionId ?? entry.id) === item.questionId,
								);
								return (
									<div
										className="flex items-start gap-3 p-4"
										key={item.questionId}
									>
										<span className="mt-2 text-sm text-muted-foreground">
											{index + 1}
										</span>
										<div className="min-w-0 flex-1">
											<p className="font-medium">
												{choice?.prompt ??
													snapshot?.prompt ??
													"Archived question"}
											</p>
											<div className="mt-2 flex items-center gap-2">
												<Badge variant="secondary">
													{choice?.difficulty ?? snapshot?.difficulty}
												</Badge>
												<Input
													className="w-24"
													aria-label={`Marks for question ${index + 1}`}
													type="number"
													min={1}
													max={100}
													value={String(item.marks)}
													onValueChange={(value) =>
														setItems(
															items.map((entry, itemIndex) =>
																itemIndex === index
																	? { ...entry, marks: Number(value) }
																	: entry,
															),
														)
													}
													disabled={!editable}
												/>
											</div>
										</div>
										{editable ? (
											<div className="flex gap-1">
												<Button
													size="icon"
													variant="ghost"
													aria-label="Move question up"
													onClick={() => move(index, -1)}
													disabled={index === 0}
												>
													<ArrowUpIcon />
												</Button>
												<Button
													size="icon"
													variant="ghost"
													aria-label="Move question down"
													onClick={() => move(index, 1)}
													disabled={index === items.length - 1}
												>
													<ArrowDownIcon />
												</Button>
												<Button
													size="icon"
													variant="ghost"
													aria-label="Remove question"
													onClick={() =>
														setItems(
															items.filter(
																(_, itemIndex) => itemIndex !== index,
															),
														)
													}
												>
													<Trash2Icon />
												</Button>
											</div>
										) : null}
									</div>
								);
							})
						) : (
							<p className="p-8 text-center text-sm text-muted-foreground">
								No questions added yet.
							</p>
						)}
					</div>
				</section>
				{error ? (
					<p className="text-sm text-destructive" role="alert">
						{error}
					</p>
				) : null}
				<div className="flex flex-wrap gap-3">
					{editable ? (
						<>
							<Button disabled={pending} onClick={save}>
								Save draft
							</Button>
							<Button
								variant="outline"
								onClick={() =>
									navigate({
										to: "/exams/$examId/preview",
										params: { examId: initial.id },
									})
								}
							>
								Preview
							</Button>
							<AlertDialog>
								<AlertDialogTrigger
									render={<Button variant="outline" disabled={pending} />}
								>
									Publish
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>Publish this exam?</AlertDialogTitle>
										<AlertDialogDescription>
											The published version becomes immutable. Future edits
											require a new version.
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>Cancel</AlertDialogCancel>
										<AlertDialogAction
											onClick={() =>
												run(async () => {
													await saveExamDraft({
														data: {
															examId: initial.id,
															settings: {
																title,
																description,
																durationMinutes: duration,
																passingPercentage: passing,
																shuffleQuestions: shuffle,
															},
															items,
														},
													});
													await publishExam({ data: { examId: initial.id } });
													await router.invalidate();
													await navigate({ to: "/exams" });
												})
											}
										>
											Publish exam
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						</>
					) : initial.status === "published" ? (
						<>
							<Button
								onClick={() =>
									run(async () => {
										const result = await createExamVersion({
											data: { examId: initial.id },
										});
										await router.invalidate();
										await navigate({
											to: "/exams/$examId",
											params: { examId: result.id },
										});
									})
								}
							>
								Create new version
							</Button>
							<Button
								variant="outline"
								onClick={() =>
									navigate({
										to: "/exams/$examId/preview",
										params: { examId: initial.id },
									})
								}
							>
								Preview
							</Button>
						</>
					) : (
						<Button
							variant="outline"
							onClick={() =>
								navigate({
									to: "/exams/$examId/preview",
									params: { examId: initial.id },
								})
							}
						>
							Preview
						</Button>
					)}
					<AlertDialog>
						<AlertDialogTrigger
							render={<Button variant="ghost" disabled={pending} />}
						>
							{editable ? "Delete draft" : "Archive"}
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>
									{editable ? "Delete this draft?" : "Archive this exam?"}
								</AlertDialogTitle>
								<AlertDialogDescription>
									This action removes the exam from active work.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<AlertDialogAction
									onClick={() =>
										run(async () => {
											await archiveExam({ data: { examId: initial.id } });
											await navigate({ to: "/exams" });
										})
									}
								>
									Continue
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</div>
			<aside className="space-y-4 rounded-xl border bg-card p-5 lg:sticky lg:top-20 lg:self-start">
				<div>
					<h2 className="font-semibold">Question Bank</h2>
					<p className="text-sm text-muted-foreground">
						Add active workspace questions.
					</p>
				</div>
				<Input
					placeholder="Find a question…"
					value={query}
					onValueChange={setQuery}
					disabled={!editable}
				/>
				<div className="max-h-[32rem] space-y-2 overflow-y-auto">
					{editable ? (
						available.map((choice) => (
							<button
								type="button"
								className="w-full rounded-lg border p-3 text-left hover:bg-muted"
								key={choice.id}
								onClick={() =>
									setItems([
										...items,
										{ questionId: choice.id, marks: choice.defaultMarks },
									])
								}
							>
								<p className="line-clamp-2 text-sm font-medium">
									{choice.prompt}
								</p>
								<div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
									<span>{choice.difficulty}</span>
									<span className="flex items-center gap-1">
										<PlusIcon className="size-3" />
										Add
									</span>
								</div>
							</button>
						))
					) : (
						<p className="text-sm text-muted-foreground">
							Published versions are read-only.
						</p>
					)}
				</div>
			</aside>
		</div>
	);
}
