import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkspaceShell } from "@/components/workspace-shell";
import { createExamDraft } from "@/lib/exams";
import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/exams/new")({
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
	component: NewExam,
});
function NewExam() {
	const data = Route.useRouteContext();
	const navigate = useNavigate();
	const [title, setTitle] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	return (
		<WorkspaceShell data={data} activeItem="exams" title="New exam">
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto w-full max-w-2xl space-y-6">
					<div>
						<h1 className="text-2xl font-semibold">Create an exam</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							Start with the basics, then add questions in the composer.
						</p>
					</div>
					<form
						className="space-y-5 rounded-xl border bg-card p-5 sm:p-6"
						onSubmit={async (event) => {
							event.preventDefault();
							setPending(true);
							setError(null);
							try {
								const result = await createExamDraft({
									data: {
										title,
										description: "",
										durationMinutes: 60,
										passingPercentage: 50,
										shuffleQuestions: false,
									},
								});
								await navigate({
									to: "/exams/$examId",
									params: { examId: result.id },
								});
							} catch (caught) {
								setError(
									caught instanceof Error
										? caught.message
										: "Unable to create exam.",
								);
							} finally {
								setPending(false);
							}
						}}
					>
						<div className="space-y-2">
							<label className="text-sm font-medium" htmlFor="new-exam-title">
								Exam title
							</label>
							<Input
								id="new-exam-title"
								value={title}
								onValueChange={setTitle}
								required
								autoFocus
							/>
						</div>
						{error ? <p className="text-sm text-destructive">{error}</p> : null}
						<div className="flex gap-3">
							<Button type="submit" disabled={pending}>
								Continue to composer
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={() => navigate({ to: "/exams" })}
							>
								Cancel
							</Button>
						</div>
					</form>
				</div>
			</main>
		</WorkspaceShell>
	);
}
