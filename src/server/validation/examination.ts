import { z } from "zod";

const idSchema = z.string().trim().min(1);

export const createExaminationSchema = z.object({
	title: z.string().trim().min(1).max(200),
	durationMinutes: z.number().int().min(1).max(480),
});

export const getExaminationsSchema = z.object({}).default({});
export const examinationIdSchema = z.object({ examinationId: idSchema });
export const assignmentIdSchema = z.object({ assignmentId: idSchema });
export const attemptIdSchema = z.object({ attemptId: idSchema });

export const saveQuestionSchema = z
	.object({
		examinationId: idSchema,
		questionId: idSchema.optional(),
		prompt: z.string().trim().min(1).max(5_000),
		points: z.number().int().min(1).max(1_000),
		options: z
			.array(
				z.object({
					id: idSchema.optional(),
					label: z.string().trim().min(1).max(1_000),
					isCorrect: z.boolean(),
				}),
			)
			.min(2)
			.max(10),
	})
	.refine(
		(data) => data.options.filter((option) => option.isCorrect).length === 1,
		{ message: "Provide exactly one correct answer." },
	);

export const assignCandidateSchema = z.object({
	examinationId: idSchema,
	userId: idSchema,
});

export const updateExaminationStatusSchema = z.object({
	examinationId: idSchema,
	action: z.enum(["publish", "close", "archive", "publish-results"]),
});

export const saveCandidateAnswerSchema = z.object({
	attemptId: idSchema,
	questionId: idSchema,
	optionId: idSchema,
});

export type CreateExaminationInput = z.infer<typeof createExaminationSchema>;
export type SaveQuestionInput = z.infer<typeof saveQuestionSchema>;
export type AssignCandidateInput = z.infer<typeof assignCandidateSchema>;
export type UpdateExaminationStatusInput = z.infer<
	typeof updateExaminationStatusSchema
>;
export type SaveCandidateAnswerInput = z.infer<
	typeof saveCandidateAnswerSchema
>;
