import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspaceShell } from "@/components/workspace-shell";
import {
	addAcademicClassMember,
	archiveAcademicClass,
	getAcademicClass,
	listAcademicClassMembers,
	removeAcademicClassMember,
	searchAvailableClassMembers,
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
				.some((role) => ["owner", "admin", "teacher"].includes(role)) ||
			data.entitlement?.status === "suspended"
		)
			throw redirect({ to: "/dashboard" });
		return data;
	},
	loader: ({ params }) =>
		getAcademicClass({ data: { classId: params.classId } }),
	component: ClassPage,
});

type ClassRole = "student" | "teacher";
type MemberResult = Awaited<ReturnType<typeof listAcademicClassMembers>>;
type MemberRow = MemberResult["rows"][number];
type Candidate = Awaited<
	ReturnType<typeof searchAvailableClassMembers>
>[number];

function Roster({
	classId,
	memberRole,
	manager,
	active,
}: {
	classId: string;
	memberRole: ClassRole;
	manager: boolean;
	active: boolean;
}) {
	const role = memberRole;
	const canManage = active && (role === "student" || manager);
	const [result, setResult] = useState<MemberResult | null>(null);
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [addOpen, setAddOpen] = useState(false);
	const [candidateSearch, setCandidateSearch] = useState("");
	const [candidates, setCandidates] = useState<Candidate[]>([]);
	const [removeTarget, setRemoveTarget] = useState<MemberRow | null>(null);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const load = useCallback(
		async (next = page) => {
			try {
				setError(null);
				setResult(
					await listAcademicClassMembers({
						data: { classId, role, search, page: next },
					}),
				);
			} catch (caught) {
				setError(
					caught instanceof Error
						? caught.message
						: "Unable to load class members.",
				);
			}
		},
		[classId, page, role, search],
	);
	useEffect(() => {
		const timer = window.setTimeout(() => {
			setPage(1);
			void load(1);
		}, 300);
		return () => window.clearTimeout(timer);
	}, [load]);
	useEffect(() => {
		if (!addOpen || candidateSearch.trim().length < 2) {
			setCandidates([]);
			return;
		}
		const timer = window.setTimeout(
			() =>
				void searchAvailableClassMembers({
					data: { classId, role, search: candidateSearch },
				})
					.then(setCandidates)
					.catch((caught) =>
						setError(
							caught instanceof Error
								? caught.message
								: "Unable to search members.",
						),
					),
			300,
		);
		return () => window.clearTimeout(timer);
	}, [addOpen, candidateSearch, classId, role]);
	async function add(memberId: string) {
		setPending(true);
		try {
			await addAcademicClassMember({ data: { classId, memberId, role } });
			setAddOpen(false);
			setCandidateSearch("");
			await load(1);
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "Unable to add member.",
			);
		} finally {
			setPending(false);
		}
	}
	async function remove() {
		if (!removeTarget) return;
		setPending(true);
		try {
			await removeAcademicClassMember({
				data: { classId, assignmentId: removeTarget.id },
			});
			setRemoveTarget(null);
			await load();
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "Unable to remove member.",
			);
		} finally {
			setPending(false);
		}
	}
	return (
		<div className="space-y-4">
			<div className="flex gap-3">
				<Input
					placeholder={`Search ${role}s…`}
					value={search}
					onValueChange={setSearch}
				/>
				{canManage ? (
					<Button onClick={() => setAddOpen(true)}>
						<PlusIcon />
						Add {role}
					</Button>
				) : null}
			</div>
			{error ? (
				<p className="text-sm text-destructive" role="alert">
					{error}
				</p>
			) : null}
			<div className="overflow-hidden rounded-xl border">
				<table className="w-full text-sm">
					<thead className="border-b bg-muted/40">
						<tr>
							<th className="p-3 text-left font-medium">Name</th>
							<th className="p-3 text-left font-medium">Email</th>
							<th className="p-3 text-right font-medium">Action</th>
						</tr>
					</thead>
					<tbody>
						{result?.rows.length ? (
							result.rows.map((member) => (
								<tr className="border-b last:border-0" key={member.id}>
									<td className="p-3 font-medium">{member.name}</td>
									<td className="p-3 text-muted-foreground">{member.email}</td>
									<td className="p-3 text-right">
										{canManage ? (
											<Button
												size="icon-sm"
												variant="ghost"
												aria-label={`Remove ${member.name}`}
												onClick={() => setRemoveTarget(member)}
											>
												<Trash2Icon />
											</Button>
										) : null}
									</td>
								</tr>
							))
						) : (
							<tr>
								<td
									className="p-8 text-center text-muted-foreground"
									colSpan={3}
								>
									No {role}s assigned.
								</td>
							</tr>
						)}
					</tbody>
				</table>
				<div className="flex items-center justify-between border-t p-3">
					<span className="text-xs text-muted-foreground">
						{result?.total ?? 0} {role}s
					</span>
					<div className="flex gap-2">
						<Button
							size="sm"
							variant="outline"
							disabled={page <= 1}
							onClick={() => {
								const next = page - 1;
								setPage(next);
								void load(next);
							}}
						>
							Previous
						</Button>
						<Button
							size="sm"
							variant="outline"
							disabled={!result || page >= result.pageCount}
							onClick={() => {
								const next = page + 1;
								setPage(next);
								void load(next);
							}}
						>
							Next
						</Button>
					</div>
				</div>
			</div>
			<Dialog open={addOpen} onOpenChange={setAddOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add {role}</DialogTitle>
						<DialogDescription>
							Search existing workspace {role}s.
						</DialogDescription>
					</DialogHeader>
					<Input
						placeholder="Search name or email…"
						value={candidateSearch}
						onValueChange={setCandidateSearch}
					/>
					<div className="space-y-2">
						{candidates.map((candidate) => (
							<div
								className="flex items-center justify-between rounded-lg border p-3"
								key={candidate.memberId}
							>
								<div>
									<p className="text-sm font-medium">{candidate.name}</p>
									<p className="text-xs text-muted-foreground">
										{candidate.email}
									</p>
								</div>
								<Button
									size="sm"
									disabled={pending}
									onClick={() => void add(candidate.memberId)}
								>
									Add
								</Button>
							</div>
						))}
						{candidateSearch.length >= 2 && !candidates.length ? (
							<p className="py-4 text-center text-sm text-muted-foreground">
								No available members found.
							</p>
						) : null}
					</div>
				</DialogContent>
			</Dialog>
			<AlertDialog
				open={Boolean(removeTarget)}
				onOpenChange={(open) => {
					if (!open) setRemoveTarget(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Remove from class?</AlertDialogTitle>
						<AlertDialogDescription>
							{removeTarget?.name} will lose access to this class. Existing exam
							recipient snapshots are unchanged.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction disabled={pending} onClick={() => void remove()}>
							Remove
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

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
				<div className="mx-auto w-full max-w-4xl space-y-6">
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
					{initial.canManageClass ? (
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
					) : (
						<section className="rounded-xl border bg-card p-5">
							<p className="font-medium">{initial.code}</p>
							<p className="mt-1 text-sm text-muted-foreground">
								{initial.description || "No description provided."}
							</p>
						</section>
					)}
					<Tabs defaultValue="students">
						<TabsList>
							{initial.canManageClass ? (
								<TabsTrigger value="teachers">Teachers</TabsTrigger>
							) : null}
							<TabsTrigger value="students">Students</TabsTrigger>
						</TabsList>
						{initial.canManageClass ? (
							<TabsContent value="teachers" className="mt-4">
								<Roster
									classId={initial.id}
									memberRole="teacher"
									manager
									active={initial.status === "active"}
								/>
							</TabsContent>
						) : null}
						<TabsContent value="students" className="mt-4">
							<Roster
								classId={initial.id}
								memberRole="student"
								manager={initial.canManageClass}
								active={initial.status === "active"}
							/>
						</TabsContent>
					</Tabs>
					{initial.canManageClass && initial.status === "active" ? (
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
