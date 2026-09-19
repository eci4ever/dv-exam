import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkspaceShell } from "@/components/workspace-shell";
import {
	archiveAcademicClass,
	getAcademicClass,
	updateAcademicClass,
} from "@/lib/academic-classes";
import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/workspace/classes/$classId")({
	beforeLoad: async () => {
		const data = await getDashboardSession();
		if (!data) throw redirect({ to: "/login" });
		if (
			!data.organizationRole
				?.split(",")
				.some((role) => role === "owner" || role === "admin") ||
			data.entitlement?.status === "suspended"
		)
			throw redirect({ to: "/dashboard" });
		return data;
	},
	loader: ({ params }) =>
		getAcademicClass({ data: { classId: params.classId } }),
	component: ClassPage,
});

function ClassPage() {
	const shell = Route.useRouteContext();
	const initial = Route.useLoaderData();
	const navigate = useNavigate();
	const [name, setName] = useState(initial.name);
	const [code, setCode] = useState(initial.code);
	const [description, setDescription] = useState(initial.description ?? "");
	const [pending, setPending] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	return (
		<WorkspaceShell
			data={shell}
			activeItem="workspace-classes"
			title={initial.name}
		>
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto w-full max-w-3xl space-y-6">
					<div className="flex items-start justify-between gap-4">
						<div>
							<div className="flex items-center gap-2">
								<h1 className="text-2xl font-semibold">{initial.name}</h1>
								<Badge
									variant={
										initial.status === "active" ? "default" : "secondary"
									}
								>
									{initial.status}
								</Badge>
							</div>
							<p className="mt-1 text-sm text-muted-foreground">
								Manage class details and roster.
							</p>
						</div>
						<Button
							variant="outline"
							onClick={() => navigate({ to: "/workspace/classes" })}
						>
							Back
						</Button>
					</div>
					<form
						className="space-y-4 rounded-xl border bg-card p-5 sm:p-6"
						onSubmit={async (event) => {
							event.preventDefault();
							setPending(true);
							setMessage(null);
							try {
								await updateAcademicClass({
									data: { classId: initial.id, name, code, description },
								});
								setMessage("Class details updated.");
							} catch (caught) {
								setMessage(
									caught instanceof Error
										? caught.message
										: "Unable to update class.",
								);
							} finally {
								setPending(false);
							}
						}}
					>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<label className="text-sm font-medium" htmlFor="detail-name">
									Name
								</label>
								<Input
									id="detail-name"
									value={name}
									onValueChange={setName}
									disabled={initial.status === "archived"}
								/>
							</div>
							<div className="space-y-2">
								<label className="text-sm font-medium" htmlFor="detail-code">
									Code
								</label>
								<Input
									id="detail-code"
									value={code}
									onValueChange={setCode}
									disabled={initial.status === "archived"}
								/>
							</div>
						</div>
						<div className="space-y-2">
							<label
								className="text-sm font-medium"
								htmlFor="detail-description"
							>
								Description
							</label>
							<Input
								id="detail-description"
								value={description}
								onValueChange={setDescription}
								disabled={initial.status === "archived"}
							/>
						</div>
						{message ? (
							<output className="block text-sm text-muted-foreground">
								{message}
							</output>
						) : null}
						<Button
							type="submit"
							disabled={pending || initial.status === "archived"}
						>
							{pending ? "Saving…" : "Save changes"}
						</Button>
					</form>
					{initial.status === "active" ? (
						<section className="rounded-xl border border-destructive/40 p-5">
							<h2 className="font-medium">Archive class</h2>
							<p className="mt-1 text-sm text-muted-foreground">
								Archived classes cannot receive new members or schedules.
							</p>
							<AlertDialog>
								<AlertDialogTrigger
									render={<Button className="mt-4" variant="destructive" />}
								>
									Archive class
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>Archive {initial.name}?</AlertDialogTitle>
										<AlertDialogDescription>
											This class will remain available for historical records.
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>Cancel</AlertDialogCancel>
										<AlertDialogAction
											onClick={async () => {
												await archiveAcademicClass({
													data: { classId: initial.id },
												});
												await navigate({ to: "/workspace/classes" });
											}}
										>
											Archive class
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						</section>
					) : null}
				</div>
			</main>
		</WorkspaceShell>
	);
}
