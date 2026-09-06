import { env } from "cloudflare:workers";

export type ManagedExamination = {
	id: string;
	organizationId: string;
	status: string;
	resultsPublishedAt: number | null;
};

export async function findExaminationById(examinationId: string) {
	return env.DB.prepare("SELECT * FROM examination WHERE id = ?")
		.bind(examinationId)
		.first<ManagedExamination>();
}

export async function listExaminationsForOrganization(organizationId: string) {
	return env.DB.prepare(
		"SELECT examination.*, COUNT(DISTINCT examination_assignment.id) AS candidateCount FROM examination LEFT JOIN examination_assignment ON examination_assignment.examinationId = examination.id WHERE examination.organizationId = ? GROUP BY examination.id ORDER BY examination.updatedAt DESC",
	)
		.bind(organizationId)
		.all();
}
