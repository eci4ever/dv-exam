import { describe, expect, it } from "vitest";
import { createExaminationSchema } from "./examination";

describe("create examination input", () => {
	it("trims a valid title and accepts a valid duration", () => {
		expect(
			createExaminationSchema.parse({
				organizationId: "org_123",
				title: "  Science assessment  ",
				durationMinutes: 60,
			}),
		).toEqual({
			organizationId: "org_123",
			title: "Science assessment",
			durationMinutes: 60,
		});
	});

	it("rejects an invalid duration", () => {
		expect(() =>
			createExaminationSchema.parse({
				organizationId: "org_123",
				title: "Science assessment",
				durationMinutes: 0,
			}),
		).toThrow();
	});
});
