import { createFileRoute, redirect } from "@tanstack/react-router";

import { QuestionEditor } from "@/components/question-editor";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getQuestion } from "@/lib/exam-authoring";
import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/questions/$questionId")({
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
	loader: ({ params }) =>
		getQuestion({ data: { questionId: params.questionId } }),
	component: EditQuestion,
});

function EditQuestion() {
	const data = Route.useRouteContext();
	const question = Route.useLoaderData();
	return (
		<WorkspaceShell data={data} activeItem="questions" title="Edit question">
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto w-full max-w-4xl space-y-6">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight">
							Edit question
						</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							Changes apply to the bank only, not existing exam snapshots.
						</p>
					</div>
					<QuestionEditor
						initial={{
							...question,
							options: question.options.map((option) => ({
								text: option.text,
								isCorrect: option.isCorrect,
							})),
						}}
					/>
				</div>
			</main>
		</WorkspaceShell>
	);
}
