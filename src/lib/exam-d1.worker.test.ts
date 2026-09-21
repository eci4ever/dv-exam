import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("Worker D1 test harness", () => {
	it("applies the application migrations to isolated D1 storage", async () => {
		const result = await env.DB.prepare(
			"SELECT name FROM sqlite_schema WHERE type = 'table' AND name = ?",
		)
			.bind("examSchedule")
			.first<{ name: string }>();

		expect(result?.name).toBe("examSchedule");
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

	it("enforces one attempt for each scheduled student", async () => {
		const now = Date.now();
		await env.DB.batch([
			env.DB.prepare(
				'INSERT INTO "user" (id,name,email,emailVerified,createdAt,updatedAt) VALUES (?,?,?,?,?,?)',
			).bind(
				"student-user",
				"Student User",
				"student@example.test",
				1,
				now,
				now,
			),
			env.DB.prepare(
				"INSERT INTO examSchedule (id,organizationId,examId,opensAt,closesAt,createdBy,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?)",
			).bind(
				"schedule-1",
				"exam-org",
				"exam-v1",
				now - 1_000,
				now + 60_000,
				"exam-user",
				now,
				now,
			),
			env.DB.prepare(
				"INSERT INTO examScheduleRecipient (id,scheduleId,userId,assignedAt) VALUES (?,?,?,?)",
			).bind("recipient-1", "schedule-1", "student-user", now),
			env.DB.prepare(
				"INSERT INTO examAttempt (id,scheduleId,examId,userId,status,startedAt,deadlineAt,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)",
			).bind(
				"attempt-1",
				"schedule-1",
				"exam-v1",
				"student-user",
				"in_progress",
				now,
				now + 60_000,
				now,
				now,
			),
		]);

		await expect(
			env.DB.prepare(
				"INSERT INTO examAttempt (id,scheduleId,examId,userId,status,startedAt,deadlineAt,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)",
			)
				.bind(
					"attempt-2",
					"schedule-1",
					"exam-v1",
					"student-user",
					"in_progress",
					now,
					now + 60_000,
					now,
					now,
				)
				.run(),
		).rejects.toThrow();
	});

	it("keeps a response unique per attempt question", async () => {
		const now = Date.now();
		await env.DB.batch([
			env.DB.prepare(
				"INSERT INTO examItemOption (id,examItemId,text,isCorrect,position) VALUES (?,?,?,?,?)",
			).bind("item-option-1", "item-1", "Answer", 1, 0),
			env.DB.prepare(
				"INSERT INTO examResponse (id,attemptId,examItemId,selectedOptionId,updatedAt) VALUES (?,?,?,?,?)",
			).bind("response-1", "attempt-1", "item-1", "item-option-1", now),
		]);

		await expect(
			env.DB.prepare(
				"INSERT INTO examResponse (id,attemptId,examItemId,selectedOptionId,updatedAt) VALUES (?,?,?,?,?)",
			)
				.bind("response-2", "attempt-1", "item-1", "item-option-1", now)
				.run(),
		).rejects.toThrow();
	});

	it("stores class sources without changing the recipient snapshot", async () => {
		const now = Date.now();
		const legacySchedule = await env.DB.prepare(
			"SELECT classSnapshotCapturedAt FROM examSchedule WHERE id = ?",
		)
			.bind("schedule-1")
			.first<{ classSnapshotCapturedAt: number | null }>();
		expect(legacySchedule?.classSnapshotCapturedAt).toBeNull();
		await env.DB.batch([
			env.DB.prepare(
				"INSERT INTO member (id,organizationId,userId,role,createdAt) VALUES (?,?,?,?,?)",
			).bind("student-member", "exam-org", "student-user", "student", now),
			env.DB.prepare(
				"INSERT INTO academicClass (id,organizationId,code,name,status,createdBy,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?)",
			).bind(
				"class-1",
				"exam-org",
				"CLASS-1",
				"Class One",
				"active",
				"exam-user",
				now,
				now,
			),
			env.DB.prepare(
				"INSERT INTO academicClassMember (id,classId,memberId,role,createdAt) VALUES (?,?,?,?,?)",
			).bind("class-student", "class-1", "student-member", "student", now),
			env.DB.prepare(
				"INSERT INTO examScheduleClass (id,scheduleId,classId) VALUES (?,?,?)",
			).bind("schedule-class-1", "schedule-1", "class-1"),
			env.DB.prepare(
				"INSERT INTO examScheduleRecipientClass (id,recipientId,classId) VALUES (?,?,?)",
			).bind("recipient-class-1", "recipient-1", "class-1"),
			env.DB.prepare(
				"UPDATE examSchedule SET classSnapshotCapturedAt = ? WHERE id = ?",
			).bind(now, "schedule-1"),
		]);

		await env.DB.prepare("DELETE FROM academicClassMember WHERE id = ?")
			.bind("class-student")
			.run();
		const recipient = await env.DB.prepare(
			"SELECT userId FROM examScheduleRecipient WHERE scheduleId = ?",
		)
			.bind("schedule-1")
			.first<{ userId: string }>();
		const snapshotClass = await env.DB.prepare(
			"SELECT classId FROM examScheduleRecipientClass WHERE recipientId = ?",
		)
			.bind("recipient-1")
			.first<{ classId: string }>();

		expect(recipient?.userId).toBe("student-user");
		expect(snapshotClass?.classId).toBe("class-1");
		await expect(
			env.DB.prepare(
				"INSERT INTO examScheduleClass (id,scheduleId,classId) VALUES (?,?,?)",
			)
				.bind("schedule-class-duplicate", "schedule-1", "class-1")
				.run(),
		).rejects.toThrow();
	});
});
