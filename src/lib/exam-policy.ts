export type QuestionType = "single_choice" | "true_false";
export type QuestionDifficulty = "easy" | "medium" | "hard";
export type QuestionStatus = "active" | "archived";
export type ExamStatus = "draft" | "published" | "archived";

export interface QuestionOptionInput {
	text: string;
	isCorrect: boolean;
}

export interface QuestionInput {
	type: QuestionType;
	prompt: string;
	explanation?: string | null;
	difficulty: QuestionDifficulty;
	defaultMarks: number;
	tags: string[];
	options: QuestionOptionInput[];
}

function boundedText(
	value: string,
	label: string,
	minimum: number,
	maximum: number,
) {
	const text = value.trim();
	if (text.length < minimum || text.length > maximum) {
		throw new Error(
			`${label} must be between ${minimum} and ${maximum} characters.`,
		);
	}
	return text;
}

function positiveInteger(
	value: number,
	label: string,
	minimum: number,
	maximum: number,
) {
	if (!Number.isInteger(value) || value < minimum || value > maximum) {
		throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
	}
	return value;
}

export function normalizeQuestionInput(input: QuestionInput): QuestionInput {
	if (!(["single_choice", "true_false"] as const).includes(input.type)) {
		throw new Error("Select a supported question type.");
	}
	if (!(["easy", "medium", "hard"] as const).includes(input.difficulty)) {
		throw new Error("Select a valid difficulty.");
	}
	const expectedOptions =
		input.type === "true_false" ? 2 : input.options.length;
	if (
		expectedOptions < 2 ||
		expectedOptions > 6 ||
		input.options.length !== expectedOptions
	) {
		throw new Error("Questions must have between 2 and 6 options.");
	}
	const options = input.options.map((option) => ({
		text: boundedText(option.text, "Option", 1, 500),
		isCorrect: Boolean(option.isCorrect),
	}));
	if (options.filter((option) => option.isCorrect).length !== 1) {
		throw new Error("Questions must have exactly one correct answer.");
	}
	if (
		input.type === "true_false" &&
		(options[0]?.text.toLowerCase() !== "true" ||
			options[1]?.text.toLowerCase() !== "false")
	) {
		throw new Error("True/False questions must use True and False options.");
	}
	const tags = Array.from(
		new Set(input.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)),
	);
	if (tags.length > 10) throw new Error("Questions can have up to 10 tags.");
	for (const tag of tags) boundedText(tag, "Tag", 2, 30);

	return {
		type: input.type,
		prompt: boundedText(input.prompt, "Prompt", 3, 2_000),
		explanation: input.explanation?.trim()
			? boundedText(input.explanation, "Explanation", 1, 2_000)
			: null,
		difficulty: input.difficulty,
		defaultMarks: positiveInteger(input.defaultMarks, "Marks", 1, 100),
		tags,
		options,
	};
}

export interface ExamSettingsInput {
	title: string;
	description?: string | null;
	durationMinutes: number;
	passingPercentage: number;
	shuffleQuestions: boolean;
}

export function normalizeExamSettings(input: ExamSettingsInput) {
	return {
		title: boundedText(input.title, "Title", 2, 120),
		description: input.description?.trim()
			? boundedText(input.description, "Description", 1, 1_000)
			: null,
		durationMinutes: positiveInteger(input.durationMinutes, "Duration", 1, 300),
		passingPercentage: positiveInteger(
			input.passingPercentage,
			"Passing percentage",
			1,
			100,
		),
		shuffleQuestions: Boolean(input.shuffleQuestions),
	};
}

export function validatePublishableExam(items: Array<{ marks?: number }>) {
	if (items.length === 0)
		throw new Error("Add at least one question before publishing.");
	for (const item of items) positiveInteger(item.marks ?? 0, "Marks", 1, 100);
	return true;
}
