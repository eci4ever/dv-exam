import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("Worker D1 test harness", () => {
	it("applies the application migrations to isolated D1 storage", async () => {
		const result = await env.DB.prepare(
			"SELECT name FROM sqlite_schema WHERE type = 'table' AND name = ?",
		)
			.bind("auditEvent")
			.first<{ name: string }>();

		expect(result?.name).toBe("auditEvent");
	});

	it("enforces one open draft per exam series", async () => {
		const now = Date.now();
		await env.DB.batch([
			env.DB.prepare(
				'INSERT INTO "user" (id,name,email,emailVerified,createdAt,updatedAt) VALUES (?,?,?,?,?,?)',
			).bind("exam-user", "Exam User", "exam@example.test", 1, now, now),
			env.DB.prepare(
				"INSERT INTO organization (id,name,slug,createdAt) VALUES (?,?,?,?)",
			).bind("exam-org", "Exam Org", "exam-org", now),
			env.DB.prepare(
				"INSERT INTO exam (id,organizationId,seriesId,version,title,durationMinutes,passingPercentage,shuffleQuestions,status,createdBy,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
			).bind(
				"exam-v1",
				"exam-org",
				"series-1",
				1,
				"Foundations",
				60,
				50,
				0,
				"draft",
				"exam-user",
				now,
				now,
			),
		]);
		await expect(
			env.DB.prepare(
				"INSERT INTO exam (id,organizationId,seriesId,version,title,durationMinutes,passingPercentage,shuffleQuestions,status,createdBy,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
			)
				.bind(
					"exam-v2",
					"exam-org",
					"series-1",
					2,
					"Foundations",
					60,
					50,
					0,
					"draft",
					"exam-user",
					now,
					now,
				)
				.run(),
		).rejects.toThrow();
	});

	it("keeps an exam snapshot when its source question is deleted", async () => {
		const now = Date.now();
		await env.DB.batch([
			env.DB.prepare(
				"INSERT INTO question (id,organizationId,authorId,type,prompt,difficulty,defaultMarks,status,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)",
			).bind(
				"question-1",
				"exam-org",
				"exam-user",
				"single_choice",
				"Original prompt",
				"easy",
				1,
				"active",
				now,
				now,
			),
			env.DB.prepare(
				"INSERT INTO examItem (id,examId,sourceQuestionId,type,prompt,difficulty,marks,position) VALUES (?,?,?,?,?,?,?,?)",
			).bind(
				"item-1",
				"exam-v1",
				"question-1",
				"single_choice",
				"Original prompt",
				"easy",
				1,
				0,
			),
		]);
		await env.DB.prepare("DELETE FROM question WHERE id = ?")
			.bind("question-1")
			.run();
		const snapshot = await env.DB.prepare(
			"SELECT sourceQuestionId, prompt FROM examItem WHERE id = ?",
		)
			.bind("item-1")
			.first<{ sourceQuestionId: string | null; prompt: string }>();
		expect(snapshot).toEqual({
			sourceQuestionId: null,
			prompt: "Original prompt",
		});
	});
});
