import { z } from "zod";

export const createExaminationSchema = z.object({
	title: z.string().trim().min(1).max(200),
	durationMinutes: z.number().int().min(1).max(480),
});
