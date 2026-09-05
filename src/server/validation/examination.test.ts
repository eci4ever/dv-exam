import { describe, expect, it } from "vitest";
import {
	assignCandidateSchema,
	createExaminationSchema,
	saveCandidateAnswerSchema,
	saveQuestionSchema,
	updateExaminationStatusSchema,
} from "./examination";

describe("create examination input", () => {
	it("trims a valid title and accepts a valid duration", () => {
		expect(
			createExaminationSchema.parse({
				title: "  Science assessment  ",
				durationMinutes: 60,
			}),
		).toEqual({
			title: "Science assessment",
			durationMinutes: 60,
		});
	});

	it("rejects an invalid duration", () => {
		expect(() =>
			createExaminationSchema.parse({
				title: "Science assessment",
				durationMinutes: 0,
			}),
		).toThrow();
	});
});

describe("examination workflow input", () => {
	it("requires exactly one correct option for a question", () => {
		expect(() =>
			saveQuestionSchema.parse({
				examinationId: "exam_123",
				prompt: "Which option is correct?",
				points: 2,
				options: [
					{ label: "A", isCorrect: true },
					{ label: "B", isCorrect: true },
				],
			}),
		).toThrow();
	});

	it("normalizes a candidate assignment", () => {
		expect(
			assignCandidateSchema.parse({
				examinationId: " exam_123 ",
				userId: " user_123 ",
			}),
		).toEqual({ examinationId: "exam_123", userId: "user_123" });
	});

	it("allows only known examination lifecycle actions", () => {
		expect(() =>
			updateExaminationStatusSchema.parse({
				examinationId: "exam_123",
				action: "delete",
			}),
		).toThrow();
	});

	it("requires complete answer identifiers", () => {
		expect(() =>
			saveCandidateAnswerSchema.parse({
				attemptId: "attempt_123",
				questionId: "question_123",
				optionId: " ",
			}),
		).toThrow();
	});
});
