import { describe, expect, it } from "vitest";
import { canSaveCandidateAnswer, canTransitionExamination } from "./lifecycle";

describe("examination lifecycle", () => {
	it("allows a draft examination to be published", () => {
		expect(canTransitionExamination("draft", "publish")).toBe(true);
	});

	it("does not allow a draft examination to close", () => {
		expect(canTransitionExamination("draft", "close")).toBe(false);
	});

	it("allows a published examination to close", () => {
		expect(canTransitionExamination("published", "close")).toBe(true);
	});

	it("allows results only after an examination is closed", () => {
		expect(canTransitionExamination("published", "publish-results")).toBe(
			false,
		);
		expect(canTransitionExamination("closed", "publish-results")).toBe(true);
	});

	it("does not allow archived examinations to transition", () => {
		expect(canTransitionExamination("archived", "publish")).toBe(false);
	});

	it("allows answers before a deadline and blocks them at the deadline", () => {
		expect(canSaveCandidateAnswer(null, 1_000)).toBe(true);
		expect(canSaveCandidateAnswer(1_001, 1_000)).toBe(true);
		expect(canSaveCandidateAnswer(1_000, 1_000)).toBe(false);
	});
});
