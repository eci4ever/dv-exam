import { describe, expect, it } from "vitest";

import {
	assertActiveExamCapacity,
	normalizeExamSettings,
	normalizeQuestionInput,
	validatePublishableExam,
} from "@/lib/exam-policy";

describe("exam authoring policy", () => {
	it("normalizes a valid single-choice question", () => {
		expect(
			normalizeQuestionInput({
				type: "single_choice",
				prompt: " Which answer is correct? ",
				explanation: " Because it is. ",
				difficulty: "easy",
				defaultMarks: 2,
				tags: [" Algebra ", "algebra", "MVP"],
				options: [
					{ text: "A", isCorrect: true },
					{ text: "B", isCorrect: false },
				],
			}),
		).toMatchObject({
			prompt: "Which answer is correct?",
			explanation: "Because it is.",
			tags: ["algebra", "mvp"],
		});
	});

	it("requires exactly one correct answer", () => {
		expect(() =>
			normalizeQuestionInput({
				type: "single_choice",
				prompt: "Choose one answer",
				difficulty: "medium",
				defaultMarks: 1,
				tags: [],
				options: [
					{ text: "A", isCorrect: true },
					{ text: "B", isCorrect: true },
				],
			}),
		).toThrow("exactly one correct answer");
	});

	it("normalizes core exam settings", () => {
		expect(
			normalizeExamSettings({
				title: " Algebra Basics ",
				description: " Foundation assessment ",
				durationMinutes: 45,
				passingPercentage: 60,
				shuffleQuestions: true,
			}),
		).toEqual({
			title: "Algebra Basics",
			description: "Foundation assessment",
			durationMinutes: 45,
			passingPercentage: 60,
			shuffleQuestions: true,
		});
	});

	it("requires at least one complete item before publishing", () => {
		expect(() => validatePublishableExam([])).toThrow(
			"Add at least one question",
		);
	});

	it("enforces active exam capacity without blocking version replacement", () => {
		expect(() =>
			assertActiveExamCapacity({
				activeCount: 5,
				limit: 5,
				replacesPublishedVersion: false,
			}),
		).toThrow("active exam limit");
		expect(() =>
			assertActiveExamCapacity({
				activeCount: 5,
				limit: 5,
				replacesPublishedVersion: true,
			}),
		).not.toThrow();
	});
});
