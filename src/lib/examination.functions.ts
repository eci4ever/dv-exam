import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import {
	requireActiveOrganizationPermission,
	requireOrganizationPermission,
	requireSession,
} from "#/server/auth/authorization";
import {
	assignCandidateSchema,
	assignmentIdSchema,
	attemptIdSchema,
	createExaminationSchema,
	examinationIdSchema,
	getExaminationsSchema,
	saveCandidateAnswerSchema,
	saveQuestionSchema,
	updateExaminationStatusSchema,
} from "#/server/validation/examination";
import {
	canSaveCandidateAnswer,
	canTransitionExamination,
	canUseOrganizationOperationally,
	canViewCandidateResult,
} from "#/server/examinations/lifecycle";
import { writeAuditEvent } from "#/server/audit/events.server";
import {
	forbidden,
	invalidInput,
	invalidState,
	notFound,
} from "#/server/errors";
import {
	findExaminationById,
	listExaminationsForOrganization,
	createExaminationForOrganization,
} from "#/server/repositories/examinations";

async function requireOrganisationManager(organizationId: string) {
	const { session } = await requireOrganizationPermission({
		organizationId,
		permission: "examination:manage",
	});
	return session;
}

async function getManagedExam(examinationId: string) {
	const exam = await findExaminationById(examinationId);
	if (!exam) throw notFound("Examination not found.");
	const session = await requireOrganisationManager(exam.organizationId);
	return { exam, session };
}

function clean(value: string, label: string) {
	const result = value.trim();
	if (!result) throw invalidInput(`${label} is required.`);
	return result;
}

export const getDashboardData = createServerFn({ method: "GET" }).handler(
	async () => {
		const session = await requireSession();
		const memberships = await env.DB.prepare(
			"SELECT organization.id, organization.name, member.role, COALESCE(platform_organization.status, 'active') AS status FROM member INNER JOIN organization ON organization.id = member.organizationId LEFT JOIN platform_organization ON platform_organization.organizationId = organization.id WHERE member.userId = ? ORDER BY organization.name",
		)
			.bind(session.user.id)
			.all<{ id: string; name: string; role: string; status: string }>();
		const managerOrganisationIds = memberships.results
			.filter(
				(membership) =>
					["owner", "admin"].includes(membership.role) &&
					membership.status === "active",
			)
			.map((membership) => membership.id);
		const assignments = await env.DB.prepare(
			`SELECT assignment.id, examination.id AS examinationId, examination.title, examination.durationMinutes, examination.status, examination.endsAt, examination.resultsPublishedAt, organization.name AS organizationName, attempt.id AS attemptId, attempt.status AS attemptStatus, attempt.score, attempt.maxScore
			 FROM examination_assignment assignment INNER JOIN examination ON examination.id = assignment.examinationId INNER JOIN organization ON organization.id = examination.organizationId LEFT JOIN platform_organization ON platform_organization.organizationId = examination.organizationId LEFT JOIN examination_attempt attempt ON attempt.assignmentId = assignment.id
			 WHERE assignment.userId = ? AND examination.status IN ('published', 'closed') AND COALESCE(platform_organization.status, 'active') = 'active' ORDER BY examination.endsAt IS NULL, examination.endsAt ASC, examination.createdAt DESC`,
		)
			.bind(session.user.id)
			.all();
		const managed = managerOrganisationIds.length
			? await env.DB.prepare(
					`SELECT examination.id, examination.title, examination.status, examination.createdAt, organization.name AS organizationName, COUNT(DISTINCT examination_assignment.id) AS candidateCount, COUNT(DISTINCT examination_attempt.id) AS attemptCount
				 FROM examination INNER JOIN organization ON organization.id = examination.organizationId LEFT JOIN examination_assignment ON examination_assignment.examinationId = examination.id LEFT JOIN examination_attempt ON examination_attempt.assignmentId = examination_assignment.id
				 WHERE examination.organizationId IN (${managerOrganisationIds.map(() => "?").join(",")}) GROUP BY examination.id ORDER BY examination.updatedAt DESC LIMIT 8`,
				)
					.bind(...managerOrganisationIds)
					.all()
			: { results: [] };
		const metrics = managerOrganisationIds.length
			? await env.DB.prepare(
					`SELECT COUNT(DISTINCT examination.id) AS examinationCount, COUNT(DISTINCT examination_assignment.userId) AS candidateCount, COUNT(DISTINCT examination_attempt.id) AS attemptCount
				 FROM examination LEFT JOIN examination_assignment ON examination_assignment.examinationId = examination.id LEFT JOIN examination_attempt ON examination_attempt.assignmentId = examination_assignment.id
				 WHERE examination.organizationId IN (${managerOrganisationIds.map(() => "?").join(",")})`,
				)
					.bind(...managerOrganisationIds)
					.first<{
						examinationCount: number;
						candidateCount: number;
						attemptCount: number;
					}>()
			: null;
		return {
			memberships: memberships.results,
			assignments: assignments.results.map((assignment) =>
				canViewCandidateResult(assignment.resultsPublishedAt)
					? assignment
					: { ...assignment, score: null, maxScore: null },
			),
			managed: managed.results,
			metrics: metrics ?? {
				examinationCount: 0,
				candidateCount: 0,
				attemptCount: 0,
			},
		};
	},
);

export const getExaminations = createServerFn({ method: "GET" })
	.validator((data: unknown) => getExaminationsSchema.parse(data))
	.handler(async () => {
		const { session } =
			await requireActiveOrganizationPermission("examination:manage");
		const organizationId = session.session.activeOrganizationId;
		if (!organizationId)
			throw invalidState("Choose an active organisation first.");
		return (await listExaminationsForOrganization(organizationId)).results;
	});

export const createExamination = createServerFn({ method: "POST" })
	.validator((data: unknown) => createExaminationSchema.parse(data))
	.handler(async ({ data }) => {
		const { session } =
			await requireActiveOrganizationPermission("examination:manage");
		const organizationId = session.session.activeOrganizationId;
		if (!organizationId)
			throw invalidState("Choose an active organisation first.");
		const title = clean(data.title, "Title");
		const id = crypto.randomUUID();
		const now = Date.now();
		await createExaminationForOrganization({
			id,
			organizationId,
			title,
			durationMinutes: data.durationMinutes,
			createdByUserId: session.user.id,
			now,
		});
		await writeAuditEvent({
			action: "examination.create",
			actorUserId: session.user.id,
			targetType: "examination",
			targetId: id,
			reason: "Examination created",
			metadata: { organizationId, title },
		});
		return { id };
	});

export const getExaminationEditor = createServerFn({ method: "GET" })
	.validator((data: unknown) => examinationIdSchema.parse(data))
	.handler(async ({ data }) => {
		const { exam } = await getManagedExam(data.examinationId);
		const [questions, members, assignments] = await Promise.all([
			env.DB.prepare(
				"SELECT * FROM examination_question WHERE examinationId = ? ORDER BY position",
			)
				.bind(exam.id)
				.all(),
			env.DB.prepare(
				"SELECT user.id, user.name, user.email FROM member INNER JOIN user ON user.id = member.userId WHERE member.organizationId = ? AND member.role = 'member' ORDER BY user.name",
			)
				.bind(exam.organizationId)
				.all(),
			env.DB.prepare(
				"SELECT assignment.id, assignment.userId, user.name, user.email FROM examination_assignment assignment INNER JOIN user ON user.id = assignment.userId WHERE assignment.examinationId = ? ORDER BY user.name",
			)
				.bind(exam.id)
				.all(),
		]);
		const options = questions.results.length
			? await env.DB.prepare(
					`SELECT * FROM examination_option WHERE questionId IN (${questions.results.map(() => "?").join(",")}) ORDER BY position`,
				)
					.bind(
						...questions.results.map((question: { id: string }) => question.id),
					)
					.all()
			: { results: [] };
		return {
			exam,
			questions: questions.results,
			options: options.results,
			members: members.results,
			assignments: assignments.results,
		};
	});

export const saveQuestion = createServerFn({ method: "POST" })
	.validator((data: unknown) => saveQuestionSchema.parse(data))
	.handler(async ({ data }) => {
		const { exam, session } = await getManagedExam(data.examinationId);
		if (exam.status !== "draft")
			throw invalidState("Only draft examinations can be edited.");
		const prompt = data.prompt;
		const questionId = data.questionId ?? crypto.randomUUID();
		const existing = data.questionId
			? await env.DB.prepare(
					"SELECT id FROM examination_question WHERE id = ? AND examinationId = ?",
				)
					.bind(questionId, exam.id)
					.first()
			: null;
		const position = existing
			? 0
			: ((
					await env.DB.prepare(
						"SELECT COALESCE(MAX(position), 0) AS position FROM examination_question WHERE examinationId = ?",
					)
						.bind(exam.id)
						.first<{ position: number }>()
				)?.position ?? 0) + 1;
		if (existing)
			await env.DB.prepare(
				"UPDATE examination_question SET prompt = ?, points = ? WHERE id = ?",
			)
				.bind(prompt, data.points, questionId)
				.run();
		else
			await env.DB.prepare(
				"INSERT INTO examination_question (id, examinationId, prompt, points, position) VALUES (?, ?, ?, ?, ?)",
			)
				.bind(questionId, exam.id, prompt, data.points, position)
				.run();
		await env.DB.prepare("DELETE FROM examination_option WHERE questionId = ?")
			.bind(questionId)
			.run();
		await env.DB.batch(
			data.options.map((option, positionIndex) =>
				env.DB.prepare(
					"INSERT INTO examination_option (id, questionId, label, isCorrect, position) VALUES (?, ?, ?, ?, ?)",
				).bind(
					crypto.randomUUID(),
					questionId,
					option.label.trim(),
					option.isCorrect ? 1 : 0,
					positionIndex + 1,
				),
			),
		);
		await env.DB.prepare("UPDATE examination SET updatedAt = ? WHERE id = ?")
			.bind(Date.now(), exam.id)
			.run();
		await writeAuditEvent({
			action: "examination.question.save",
			actorUserId: session.user.id,
			targetType: "examination_question",
			targetId: questionId,
			reason: "Question saved",
			metadata: { examinationId: exam.id, organizationId: exam.organizationId },
		});
		return { id: questionId };
	});

export const assignCandidate = createServerFn({ method: "POST" })
	.validator((data: unknown) => assignCandidateSchema.parse(data))
	.handler(async ({ data }) => {
		const { exam, session } = await getManagedExam(data.examinationId);
		if (exam.status !== "draft")
			throw invalidState(
				"Candidates can only be changed while the examination is a draft.",
			);
		const member = await env.DB.prepare(
			"SELECT id FROM member WHERE organizationId = ? AND userId = ? AND role = 'member'",
		)
			.bind(exam.organizationId, data.userId)
			.first();
		if (!member) throw forbidden("Candidate must be an organisation member.");
		const assignmentId = crypto.randomUUID();
		await env.DB.prepare(
			"INSERT OR IGNORE INTO examination_assignment (id, examinationId, userId, assignedByUserId, createdAt) VALUES (?, ?, ?, ?, ?)",
		)
			.bind(assignmentId, exam.id, data.userId, session.user.id, Date.now())
			.run();
		await writeAuditEvent({
			action: "examination.candidate.assign",
			actorUserId: session.user.id,
			targetType: "examination_assignment",
			targetId: assignmentId,
			reason: "Candidate assigned",
			metadata: {
				examinationId: exam.id,
				organizationId: exam.organizationId,
				userId: data.userId,
			},
		});
		return { success: true };
	});

export const updateExaminationStatus = createServerFn({ method: "POST" })
	.validator((data: unknown) => updateExaminationStatusSchema.parse(data))
	.handler(async ({ data }) => {
		const { exam, session } = await getManagedExam(data.examinationId);
		if (!canTransitionExamination(exam.status, data.action))
			throw invalidState(
				`The ${data.action} action is not available while this examination is ${exam.status}.`,
			);
		if (data.action === "publish-results" && exam.resultsPublishedAt)
			throw invalidState("Results have already been published.");
		if (data.action === "publish") {
			const readiness = await env.DB.prepare(
				"SELECT (SELECT COUNT(*) FROM examination_question WHERE examinationId = ?) AS questions, (SELECT COUNT(*) FROM examination_assignment WHERE examinationId = ?) AS candidates",
			)
				.bind(exam.id, exam.id)
				.first<{ questions: number; candidates: number }>();
			if (!readiness?.questions || !readiness.candidates)
				throw invalidState(
					"Add at least one question and one candidate before publishing.",
				);
			await env.DB.prepare(
				"UPDATE examination SET status = 'published', updatedAt = ? WHERE id = ?",
			)
				.bind(Date.now(), exam.id)
				.run();
		} else if (data.action === "close")
			await env.DB.prepare(
				"UPDATE examination SET status = 'closed', updatedAt = ? WHERE id = ?",
			)
				.bind(Date.now(), exam.id)
				.run();
		else if (data.action === "archive")
			await env.DB.prepare(
				"UPDATE examination SET status = 'archived', updatedAt = ? WHERE id = ?",
			)
				.bind(Date.now(), exam.id)
				.run();
		else {
			if (exam.status !== "closed")
				throw invalidState("Close the examination before publishing results.");
			await env.DB.prepare(
				"UPDATE examination SET resultsPublishedAt = ?, updatedAt = ? WHERE id = ?",
			)
				.bind(Date.now(), Date.now(), exam.id)
				.run();
		}
		await writeAuditEvent({
			action: `examination.${data.action}`,
			actorUserId: session.user.id,
			targetType: "examination",
			targetId: exam.id,
			reason: "Examination lifecycle action",
			metadata: { organizationId: exam.organizationId },
		});
		return { success: true };
	});

export const getCandidateAttempt = createServerFn({ method: "GET" })
	.validator((data: unknown) => assignmentIdSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await requireSession();
		const assignment = await env.DB.prepare(
			"SELECT assignment.id, examination.id AS examinationId, examination.title, examination.durationMinutes, examination.status, examination.endsAt, attempt.id AS attemptId, attempt.status AS attemptStatus, attempt.startedAt, attempt.score, attempt.maxScore, examination.resultsPublishedAt, platform_organization.status AS organizationStatus FROM examination_assignment assignment INNER JOIN examination ON examination.id = assignment.examinationId LEFT JOIN platform_organization ON platform_organization.organizationId = examination.organizationId LEFT JOIN examination_attempt attempt ON attempt.assignmentId = assignment.id WHERE assignment.id = ? AND assignment.userId = ?",
		)
			.bind(data.assignmentId, session.user.id)
			.first<Record<string, unknown>>();
		if (
			!assignment ||
			!["published", "closed"].includes(String(assignment.status)) ||
			!canUseOrganizationOperationally(
				(assignment.organizationStatus as string | null) ?? null,
			)
		)
			throw invalidState("This examination is not available.");
		if (!assignment.attemptId && assignment.status !== "published")
			throw invalidState("This examination is closed.");
		if (
			!assignment.attemptId &&
			!canSaveCandidateAnswer(
				(assignment.endsAt as number | null) ?? null,
				Date.now(),
			)
		)
			throw invalidState("This examination has reached its deadline.");
		let attemptId = assignment.attemptId as string | null;
		if (!attemptId) {
			attemptId = crypto.randomUUID();
			await env.DB.prepare(
				"INSERT INTO examination_attempt (id, assignmentId, startedAt) VALUES (?, ?, ?)",
			)
				.bind(attemptId, data.assignmentId, Date.now())
				.run();
			assignment.attemptId = attemptId;
			assignment.attemptStatus = "in_progress";
			assignment.startedAt = Date.now();
		}
		const questions = await env.DB.prepare(
			"SELECT id, prompt, points, position FROM examination_question WHERE examinationId = ? ORDER BY position",
		)
			.bind(assignment.examinationId)
			.all();
		const options = questions.results.length
			? await env.DB.prepare(
					`SELECT id, questionId, label, position FROM examination_option WHERE questionId IN (${questions.results.map(() => "?").join(",")}) ORDER BY position`,
				)
					.bind(
						...questions.results.map((question: { id: string }) => question.id),
					)
					.all()
			: { results: [] };
		const answers = await env.DB.prepare(
			"SELECT questionId, optionId FROM examination_answer WHERE attemptId = ?",
		)
			.bind(attemptId)
			.all();
		if (
			!canViewCandidateResult(assignment.resultsPublishedAt as number | null)
		) {
			delete assignment.score;
			delete assignment.maxScore;
		}
		return {
			assignment,
			questions: questions.results,
			options: options.results,
			answers: answers.results,
		};
	});

export const saveCandidateAnswer = createServerFn({ method: "POST" })
	.validator((data: unknown) => saveCandidateAnswerSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await requireSession();
		const valid = await env.DB.prepare(
			"SELECT attempt.id FROM examination_attempt attempt INNER JOIN examination_assignment assignment ON assignment.id = attempt.assignmentId INNER JOIN examination ON examination.id = assignment.examinationId LEFT JOIN platform_organization ON platform_organization.organizationId = examination.organizationId INNER JOIN examination_option option ON option.id = ? AND option.questionId = ? WHERE attempt.id = ? AND assignment.userId = ? AND attempt.status = 'in_progress' AND examination.status = 'published' AND COALESCE(platform_organization.status, 'active') = 'active' AND (examination.endsAt IS NULL OR examination.endsAt > ?)",
		)
			.bind(
				data.optionId,
				data.questionId,
				data.attemptId,
				session.user.id,
				Date.now(),
			)
			.first();
		if (!valid) throw forbidden("Answer cannot be saved.");
		await env.DB.prepare(
			"INSERT INTO examination_answer (id, attemptId, questionId, optionId, updatedAt) VALUES (?, ?, ?, ?, ?) ON CONFLICT(attemptId, questionId) DO UPDATE SET optionId = excluded.optionId, updatedAt = excluded.updatedAt",
		)
			.bind(
				crypto.randomUUID(),
				data.attemptId,
				data.questionId,
				data.optionId,
				Date.now(),
			)
			.run();
		return { success: true };
	});

export const submitCandidateAttempt = createServerFn({ method: "POST" })
	.validator((data: unknown) => attemptIdSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await requireSession();
		const attempt = await env.DB.prepare(
			"SELECT attempt.id, examination.id AS examinationId, examination.resultsPublishedAt FROM examination_attempt attempt INNER JOIN examination_assignment assignment ON assignment.id = attempt.assignmentId INNER JOIN examination ON examination.id = assignment.examinationId LEFT JOIN platform_organization ON platform_organization.organizationId = examination.organizationId WHERE attempt.id = ? AND assignment.userId = ? AND attempt.status = 'in_progress' AND COALESCE(platform_organization.status, 'active') = 'active'",
		)
			.bind(data.attemptId, session.user.id)
			.first<{
				id: string;
				examinationId: string;
				resultsPublishedAt: number | null;
			}>();
		if (!attempt) throw forbidden("Attempt cannot be submitted.");
		const score = await env.DB.prepare(
			"SELECT COALESCE(SUM(CASE WHEN option.isCorrect = 1 THEN question.points ELSE 0 END), 0) AS score, COALESCE((SELECT SUM(points) FROM examination_question WHERE examinationId = ?), 0) AS maxScore FROM examination_answer answer INNER JOIN examination_question question ON question.id = answer.questionId LEFT JOIN examination_option option ON option.id = answer.optionId WHERE answer.attemptId = ?",
		)
			.bind(attempt.examinationId, attempt.id)
			.first<{ score: number; maxScore: number }>();
		await env.DB.prepare(
			"UPDATE examination_attempt SET status = 'submitted', submittedAt = ?, score = ?, maxScore = ? WHERE id = ?",
		)
			.bind(Date.now(), score?.score ?? 0, score?.maxScore ?? 0, attempt.id)
			.run();
		await writeAuditEvent({
			action: "examination.attempt.submit",
			actorUserId: session.user.id,
			targetType: "examination_attempt",
			targetId: attempt.id,
			reason: "Candidate submitted examination attempt",
			metadata: { examinationId: attempt.examinationId },
		});
		if (!canViewCandidateResult(attempt.resultsPublishedAt))
			return { submitted: true };
		return { score: score?.score ?? 0, maxScore: score?.maxScore ?? 0 };
	});
