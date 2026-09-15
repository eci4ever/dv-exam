import { createFileRoute, redirect } from "@tanstack/react-router";
import { ExamEditor } from "@/components/exam-editor";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getExam, listExamQuestionChoices } from "@/lib/exams";
import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/exams/$examId")({
	beforeLoad: async () => {
		const data = await getDashboardSession();
		if (!data) throw redirect({ to: "/login" });
		if (
			!data.organizationRole
				?.split(",")
				.some((role) => ["owner", "admin", "teacher"].includes(role))
		)
			throw redirect({ to: "/dashboard" });
		return data;
	},
	loader: async ({ params }) =>
		Promise.all([
			getExam({ data: { examId: params.examId } }),
			listExamQuestionChoices(),
		]),
	component: ExamPage,
});
function ExamPage() {
	const data = Route.useRouteContext();
	const [exam, choices] = Route.useLoaderData();
	return (
		<WorkspaceShell
			data={data}
			activeItem="exams"
			title={exam.status === "draft" ? "Edit exam" : "Exam details"}
		>
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto w-full max-w-7xl space-y-6">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight">
							{exam.title}
						</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							Version {exam.version} · {exam.status}
						</p>
					</div>
					<ExamEditor initial={exam} choices={choices} />
				</div>
			</main>
		</WorkspaceShell>
	);
}
