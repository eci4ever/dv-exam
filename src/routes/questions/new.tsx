import { createFileRoute, redirect } from "@tanstack/react-router";

import { QuestionEditor } from "@/components/question-editor";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/questions/new")({
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
	component: NewQuestion,
});

function NewQuestion() {
	const data = Route.useRouteContext();
	return (
		<WorkspaceShell data={data} activeItem="questions" title="New question">
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto w-full max-w-4xl space-y-6">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight">
							New question
						</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							Add a reusable question to your workspace bank.
						</p>
					</div>
					<QuestionEditor />
				</div>
			</main>
		</WorkspaceShell>
	);
}
