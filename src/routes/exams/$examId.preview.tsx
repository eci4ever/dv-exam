import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getExam } from "@/lib/exams";
import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/exams/$examId/preview")({
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
	loader: ({ params }) => getExam({ data: { examId: params.examId } }),
	component: ExamPreview,
});
function ExamPreview() {
	const data = Route.useRouteContext();
	const exam = Route.useLoaderData();
	const navigate = useNavigate();
	return (
		<WorkspaceShell data={data} activeItem="exams" title="Exam preview">
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto w-full max-w-3xl space-y-6">
					<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
						<div>
							<Badge variant="secondary">Student preview</Badge>
							<h1 className="mt-3 text-2xl font-semibold">{exam.title}</h1>
							<p className="mt-1 text-sm text-muted-foreground">
								{exam.durationMinutes} minutes · Pass mark{" "}
								{exam.passingPercentage}% · {exam.items.length} questions
							</p>
						</div>
						<Button
							variant="outline"
							onClick={() =>
								navigate({ to: "/exams/$examId", params: { examId: exam.id } })
							}
						>
							Back to exam
						</Button>
					</div>
					{exam.description ? (
						<p className="rounded-xl border bg-card p-5 text-sm">
							{exam.description}
						</p>
					) : null}
					<div className="space-y-4">
						{exam.items.map((item, index) => (
							<section className="rounded-xl border bg-card p-5" key={item.id}>
								<div className="flex justify-between gap-4">
									<h2 className="font-medium">
										{index + 1}. {item.prompt}
									</h2>
									<span className="shrink-0 text-sm text-muted-foreground">
										{item.marks} marks
									</span>
								</div>
								<div className="mt-4 space-y-2">
									{item.options.map((option) => (
										<label
											className="flex items-center gap-3 rounded-lg border p-3 text-sm"
											key={option.id}
										>
											<input type="radio" name={item.id} disabled />
											{option.text}
										</label>
									))}
								</div>
							</section>
						))}
					</div>
				</div>
			</main>
		</WorkspaceShell>
	);
}
