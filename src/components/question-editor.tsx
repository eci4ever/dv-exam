import { useNavigate } from "@tanstack/react-router";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createQuestion, updateQuestion } from "@/lib/exam-authoring";
import type { QuestionDifficulty, QuestionType } from "@/lib/exam-policy";

interface EditorQuestion {
	id?: string;
	type: QuestionType;
	prompt: string;
	explanation?: string | null;
	difficulty: QuestionDifficulty;
	defaultMarks: number;
	tags: string[];
	options: Array<{ text: string; isCorrect: boolean }>;
}

export function QuestionEditor({ initial }: { initial?: EditorQuestion }) {
	const navigate = useNavigate();
	const [type, setType] = useState<QuestionType>(
		initial?.type ?? "single_choice",
	);
	const [prompt, setPrompt] = useState(initial?.prompt ?? "");
	const [explanation, setExplanation] = useState(initial?.explanation ?? "");
	const [difficulty, setDifficulty] = useState<QuestionDifficulty>(
		initial?.difficulty ?? "medium",
	);
	const [marks, setMarks] = useState(initial?.defaultMarks ?? 1);
	const [tags, setTags] = useState(initial?.tags.join(", ") ?? "");
	const [options, setOptions] = useState(() =>
		(
			initial?.options ?? [
				{ text: "", isCorrect: true },
				{ text: "", isCorrect: false },
			]
		).map((option) => ({ ...option, clientId: crypto.randomUUID() })),
	);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	function changeType(next: QuestionType) {
		setType(next);
		if (next === "true_false")
			setOptions([
				{ clientId: crypto.randomUUID(), text: "True", isCorrect: true },
				{ clientId: crypto.randomUUID(), text: "False", isCorrect: false },
			]);
	}

	async function save(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setPending(true);
		setError(null);
		const question = {
			type,
			prompt,
			explanation,
			difficulty,
			defaultMarks: marks,
			tags: tags
				.split(",")
				.map((tag) => tag.trim())
				.filter(Boolean),
			options: options.map(({ text, isCorrect }) => ({ text, isCorrect })),
		};
		try {
			if (initial?.id)
				await updateQuestion({ data: { questionId: initial.id, question } });
			else await createQuestion({ data: question });
			await navigate({ to: "/questions" });
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "Unable to save question.",
			);
		} finally {
			setPending(false);
		}
	}

	return (
		<form
			className="space-y-6 rounded-xl border bg-card p-5 sm:p-6"
			onSubmit={save}
		>
			<div className="grid gap-5 sm:grid-cols-3">
				<div className="space-y-2">
					<label className="text-sm font-medium" htmlFor="question-type">
						Question type
					</label>
					<select
						id="question-type"
						className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
						value={type}
						onChange={(event) => changeType(event.target.value as QuestionType)}
					>
						<option value="single_choice">Single choice</option>
						<option value="true_false">True / False</option>
					</select>
				</div>
				<div className="space-y-2">
					<label className="text-sm font-medium" htmlFor="question-difficulty">
						Difficulty
					</label>
					<select
						id="question-difficulty"
						className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
						value={difficulty}
						onChange={(event) =>
							setDifficulty(event.target.value as QuestionDifficulty)
						}
					>
						<option value="easy">Easy</option>
						<option value="medium">Medium</option>
						<option value="hard">Hard</option>
					</select>
				</div>
				<div className="space-y-2">
					<label className="text-sm font-medium" htmlFor="question-marks">
						Default marks
					</label>
					<Input
						id="question-marks"
						type="number"
						min={1}
						max={100}
						value={String(marks)}
						onValueChange={(value) => setMarks(Number(value))}
						required
					/>
				</div>
			</div>
			<div className="space-y-2">
				<label className="text-sm font-medium" htmlFor="question-prompt">
					Prompt
				</label>
				<textarea
					id="question-prompt"
					className="min-h-28 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
					value={prompt}
					onChange={(event) => setPrompt(event.target.value)}
					maxLength={2000}
					required
				/>
			</div>
			<div className="space-y-3">
				<div>
					<p className="text-sm font-medium">Answer options</p>
					<p className="text-xs text-muted-foreground">
						Select exactly one correct answer.
					</p>
				</div>
				{options.map((option, index) => (
					<div className="flex items-center gap-3" key={option.clientId}>
						<input
							type="radio"
							name="correct-option"
							aria-label={`Mark option ${index + 1} correct`}
							checked={option.isCorrect}
							onChange={() =>
								setOptions(
									options.map((item, optionIndex) => ({
										...item,
										isCorrect: optionIndex === index,
									})),
								)
							}
						/>
						<Input
							aria-label={`Option ${index + 1}`}
							value={option.text}
							onValueChange={(value) =>
								setOptions(
									options.map((item, optionIndex) =>
										optionIndex === index ? { ...item, text: value } : item,
									),
								)
							}
							disabled={type === "true_false"}
							required
						/>
						<Button
							type="button"
							size="icon"
							variant="ghost"
							aria-label={`Remove option ${index + 1}`}
							disabled={type === "true_false" || options.length <= 2}
							onClick={() =>
								setOptions(
									options.filter((_, optionIndex) => optionIndex !== index),
								)
							}
						>
							<Trash2Icon />
						</Button>
					</div>
				))}
				{type === "single_choice" && options.length < 6 ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() =>
							setOptions([
								...options,
								{ clientId: crypto.randomUUID(), text: "", isCorrect: false },
							])
						}
					>
						<PlusIcon />
						Add option
					</Button>
				) : null}
			</div>
			<div className="space-y-2">
				<label className="text-sm font-medium" htmlFor="question-explanation">
					Explanation <span className="text-muted-foreground">(optional)</span>
				</label>
				<textarea
					id="question-explanation"
					className="min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
					value={explanation ?? ""}
					onChange={(event) => setExplanation(event.target.value)}
					maxLength={2000}
				/>
			</div>
			<div className="space-y-2">
				<label className="text-sm font-medium" htmlFor="question-tags">
					Tags
				</label>
				<Input
					id="question-tags"
					placeholder="algebra, foundation"
					value={tags}
					onValueChange={setTags}
				/>
				<p className="text-xs text-muted-foreground">
					Separate up to 10 tags with commas.
				</p>
			</div>
			{error ? (
				<p className="text-sm text-destructive" role="alert">
					{error}
				</p>
			) : null}
			<div className="flex justify-end gap-2">
				<Button
					type="button"
					variant="outline"
					onClick={() => navigate({ to: "/questions" })}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={pending}>
					{pending ? "Saving…" : "Save question"}
				</Button>
			</div>
		</form>
	);
}
