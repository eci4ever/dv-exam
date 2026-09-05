import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
	Building2,
	Check,
	Clock3,
	MailPlus,
	Trash2,
	UserCog,
	Users,
	X,
} from "lucide-react";
import { useState } from "react";
import { DashboardShell } from "#/components/dashboard-shell";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Separator } from "#/components/ui/separator";
import { getSession } from "#/lib/auth.functions";
import {
	cancelOrganizationInvitation,
	getOrganizationWorkspace,
	inviteOrganizationMember,
	removeOrganizationMember,
	respondToOrganizationInvitation,
	setActiveOrganization,
	updateOrganizationMember,
	updateOrganizationProfile,
} from "#/lib/organization.functions";

export const Route = createFileRoute("/organizations")({
	beforeLoad: async () => {
		const session = await getSession();
		if (!session) throw redirect({ to: "/login" });
		return { user: session.user };
	},
	loader: () => getOrganizationWorkspace(),
	component: OrganizationsPage,
});

function OrganizationsPage() {
	const { user } = Route.useRouteContext();
	const data = Route.useLoaderData();
	const router = useRouter();
	const setActiveFn = useServerFn(setActiveOrganization);
	const inviteFn = useServerFn(inviteOrganizationMember);
	const updateMemberFn = useServerFn(updateOrganizationMember);
	const removeMemberFn = useServerFn(removeOrganizationMember);
	const cancelInvitationFn = useServerFn(cancelOrganizationInvitation);
	const updateProfileFn = useServerFn(updateOrganizationProfile);
	const respondToInvitationFn = useServerFn(respondToOrganizationInvitation);
	const [email, setEmail] = useState("");
	const [organizationName, setOrganizationName] = useState("");
	const [role, setRole] = useState<"admin" | "member">("member");
	const [notice, setNotice] = useState("");
	const [isWorking, setIsWorking] = useState("");
	const activeOrganization = data.organizations.find(
		(organization) => organization.id === data.activeOrganizationId,
	);
	const currentMembership = activeOrganization?.role ?? null;
	const canManage =
		currentMembership === "owner" || currentMembership === "admin";

	async function runAction(
		key: string,
		action: () => Promise<unknown>,
		success: string,
	) {
		setNotice("");
		setIsWorking(key);
		try {
			await action();
			setNotice(success);
			await router.invalidate({ sync: true });
		} catch (error) {
			setNotice(
				error instanceof Error
					? error.message
					: "Tindakan tidak dapat diselesaikan.",
			);
		} finally {
			setIsWorking("");
		}
	}

	return (
		<DashboardShell
			organizationRole={currentMembership}
			pageTitle="Organisations"
			user={user}
		>
			<div className="mx-auto w-full max-w-[1440px] space-y-5 px-4 py-5 pb-10 sm:px-6 sm:py-6 lg:px-8">
				<section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
					<div>
						<Badge variant="secondary">
							<Building2 className="mr-1 size-3" /> Better Auth Organization
						</Badge>
						<h1 className="mt-3 text-3xl font-bold tracking-tight">
							Organisations
						</h1>
						<p className="mt-2 text-sm text-muted-foreground">
							Choose a workspace, manage members and respond to organisation
							invitations.
						</p>
					</div>
					{activeOrganization && (
						<Badge className="w-fit" variant="outline">
							{roleLabel(currentMembership)}
						</Badge>
					)}
				</section>

				{notice && (
					<div className="flex items-center gap-2 rounded-lg border bg-background p-3 text-sm shadow-sm">
						<Check className="size-4 text-emerald-600" /> {notice}
					</div>
				)}

				{data.receivedInvitations.length > 0 && (
					<Card className="border-primary/20 bg-primary/[0.03]">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<MailPlus className="size-5 text-primary" /> Your invitations
							</CardTitle>
							<CardDescription>
								{data.emailVerified
									? "Accept or decline active invitations."
									: "Verify your account email before accepting invitations."}
							</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-3">
							{data.receivedInvitations.map((invitation) => (
								<div
									className="flex flex-col justify-between gap-3 rounded-xl border bg-background p-4 sm:flex-row sm:items-center"
									key={invitation.id}
								>
									<div>
										<p className="font-medium">{invitation.organizationName}</p>
										<p className="mt-1 text-xs text-muted-foreground">
											Role: {roleLabel(invitation.role)} · Expires{" "}
											{formatDate(invitation.expiresAt)}
										</p>
									</div>
									<div className="flex gap-2">
										<Button
											disabled={
												!data.emailVerified || isWorking === invitation.id
											}
											onClick={() =>
												runAction(
													invitation.id,
													() =>
														respondToInvitationFn({
															data: {
																invitationId: invitation.id,
																response: "accept",
															},
														}),
													"Invitation accepted.",
												)
											}
											size="sm"
										>
											<Check /> Accept
										</Button>
										<Button
											disabled={
												!data.emailVerified || isWorking === invitation.id
											}
											onClick={() =>
												runAction(
													invitation.id,
													() =>
														respondToInvitationFn({
															data: {
																invitationId: invitation.id,
																response: "reject",
															},
														}),
													"Invitation declined.",
												)
											}
											size="sm"
											variant="outline"
										>
											<X /> Decline
										</Button>
									</div>
								</div>
							))}
						</CardContent>
					</Card>
				)}

				<section className="grid gap-6 lg:grid-cols-[280px_1fr]">
					<Card className="h-fit">
						<CardHeader>
							<CardTitle className="text-base">Workspaces</CardTitle>
							<CardDescription>
								{data.organizations.length} organisations
							</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-2">
							{data.organizations.map((organization) => (
								<button
									className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/60 ${
										organization.id === data.activeOrganizationId
											? "border-primary/30 bg-primary/5"
											: "bg-background"
									}`}
									disabled={isWorking === "switch"}
									key={organization.id}
									onClick={() =>
										runAction(
											"switch",
											() =>
												setActiveFn({
													data: { organizationId: organization.id },
												}),
											`${organization.name} kini ruang kerja aktif.`,
										)
									}
									type="button"
								>
									<span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 font-semibold text-primary">
										{organization.name.slice(0, 1).toUpperCase()}
									</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm font-medium">
											{organization.name}
										</span>
										<span className="block text-xs text-muted-foreground">
											{roleLabel(organization.role)}
										</span>
									</span>
									{organization.id === data.activeOrganizationId && (
										<Check className="size-4 text-primary" />
									)}
								</button>
							))}
							{!data.organizations.length && (
								<EmptyState text="You are not a member of any organisation yet." />
							)}
						</CardContent>
					</Card>

					<div className="space-y-6">
						{activeOrganization ? (
							<>
								<Card>
									<CardHeader>
										<CardTitle>Workspace details</CardTitle>
										<CardDescription>
											Update the name shown to members and candidates.
										</CardDescription>
									</CardHeader>
									<CardContent>
										<form
											className="flex flex-col gap-3 sm:flex-row"
											onSubmit={(event) => {
												event.preventDefault();
												void runAction(
													"workspace-name",
													() =>
														updateProfileFn({
															data: {
																organizationId: activeOrganization.id,
																name:
																	organizationName || activeOrganization.name,
															},
														}),
													"Workspace details updated.",
												).then(() => setOrganizationName(""));
											}}
										>
											<Input
												onChange={(event) =>
													setOrganizationName(event.target.value)
												}
												placeholder={activeOrganization.name}
												value={organizationName}
											/>
											<Button
												disabled={isWorking === "workspace-name"}
												type="submit"
											>
												Save details
											</Button>
										</form>
									</CardContent>
								</Card>
								<Card id="members">
									<CardHeader className="flex-row items-center justify-between space-y-0">
										<div>
											<CardTitle>{activeOrganization.name}</CardTitle>
											<CardDescription>
												/{activeOrganization.slug}
											</CardDescription>
										</div>
										<Badge variant="outline">
											<Users className="mr-1 size-3" /> {data.members.length}{" "}
											ahli
										</Badge>
									</CardHeader>
									<CardContent>
										<div className="divide-y">
											{data.members.map((member) => (
												<div
													className="flex items-center gap-3 py-4"
													key={member.id}
												>
													<span className="grid size-9 place-items-center rounded-full bg-muted text-sm font-semibold">
														{member.name.slice(0, 1).toUpperCase()}
													</span>
													<div className="min-w-0 flex-1">
														<p className="truncate text-sm font-medium">
															{member.name}
														</p>
														<p className="truncate text-xs text-muted-foreground">
															{member.email}
														</p>
													</div>
													{canManage && member.role !== "owner" ? (
														<div className="flex items-center gap-2">
															<select
																aria-label={`Peranan ${member.name}`}
																className="h-9 rounded-md border bg-background px-2 text-xs"
																disabled={isWorking === member.id}
																onChange={(event) =>
																	runAction(
																		member.id,
																		() =>
																			updateMemberFn({
																				data: {
																					organizationId: activeOrganization.id,
																					memberId: member.id,
																					role: event.target.value as
																						| "admin"
																						| "member",
																				},
																			}),
																		"Peranan ahli telah dikemas kini.",
																	)
																}
																value={member.role}
															>
																<option value="member">Ahli</option>
																<option value="admin">Admin</option>
															</select>
															<Button
																aria-label={`Keluarkan ${member.name}`}
																disabled={
																	isWorking === member.id ||
																	member.userId === user.id
																}
																onClick={() =>
																	runAction(
																		member.id,
																		() =>
																			removeMemberFn({
																				data: {
																					organizationId: activeOrganization.id,
																					memberIdOrEmail: member.id,
																				},
																			}),
																		"Ahli telah dikeluarkan.",
																	)
																}
																size="icon-sm"
																variant="ghost"
															>
																<Trash2 />
															</Button>
														</div>
													) : (
														<Badge
															variant={
																member.role === "owner"
																	? "default"
																	: "secondary"
															}
														>
															{roleLabel(member.role)}
														</Badge>
													)}
												</div>
											))}
										</div>
									</CardContent>
								</Card>

								{canManage && (
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center gap-2">
												<UserCog className="size-5 text-primary" /> Invite
												members
											</CardTitle>
											<CardDescription>
												Better Auth records and sends invitations through
												Resend.
											</CardDescription>
										</CardHeader>
										<CardContent>
											<form
												className="grid gap-3 sm:grid-cols-[1fr_150px_auto]"
												onSubmit={(event) => {
													event.preventDefault();
													void runAction(
														"invite",
														() =>
															inviteFn({
																data: {
																	organizationId: activeOrganization.id,
																	email,
																	role,
																},
															}),
														"Jemputan telah dihantar.",
													).then(() => setEmail(""));
												}}
											>
												<Input
													aria-label="Member email"
													onChange={(event) => setEmail(event.target.value)}
													placeholder="member@organisation.com"
													required
													type="email"
													value={email}
												/>
												<select
													aria-label="Invitation role"
													className="h-9 rounded-md border bg-background px-3 text-sm"
													onChange={(event) =>
														setRole(event.target.value as "admin" | "member")
													}
													value={role}
												>
													<option value="member">Member</option>
													<option value="admin">Admin</option>
												</select>
												<Button disabled={isWorking === "invite"} type="submit">
													<MailPlus />{" "}
													{isWorking === "invite"
														? "Sending…"
														: "Send invitation"}
												</Button>
											</form>
											{data.invitations.length > 0 && (
												<Separator className="my-5" />
											)}
											<div className="space-y-2">
												{data.invitations.map((invitation) => (
													<div
														className="flex items-center gap-3 rounded-lg bg-muted/40 p-3"
														key={invitation.id}
													>
														<Clock3 className="size-4 text-muted-foreground" />
														<div className="min-w-0 flex-1">
															<p className="truncate text-sm font-medium">
																{invitation.email}
															</p>
															<p className="text-xs text-muted-foreground">
																{roleLabel(invitation.role)} · expires{" "}
																{formatDate(invitation.expiresAt)}
															</p>
														</div>
														<Button
															aria-label="Cancel invitation"
															disabled={isWorking === invitation.id}
															onClick={() =>
																runAction(
																	invitation.id,
																	() =>
																		cancelInvitationFn({
																			data: { invitationId: invitation.id },
																		}),
																	"Invitation cancelled.",
																)
															}
															size="icon-sm"
															variant="ghost"
														>
															<X />
														</Button>
													</div>
												))}
											</div>
										</CardContent>
									</Card>
								)}
							</>
						) : (
							<Card>
								<CardContent className="py-14">
									<EmptyState text="A Super Admin must create an organisation and assign you as its owner first." />
								</CardContent>
							</Card>
						)}
					</div>
				</section>
			</div>
		</DashboardShell>
	);
}

function roleLabel(role?: string | null) {
	if (role === "owner") return "Owner";
	if (role === "admin") return "Organisation admin";
	return "Member";
}

function formatDate(value: number) {
	return new Intl.DateTimeFormat("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	}).format(new Date(value));
}

function EmptyState({ text }: { text: string }) {
	return (
		<div className="grid min-h-28 place-items-center text-center text-sm text-muted-foreground">
			<div>
				<Building2 className="mx-auto mb-3 size-7" />
				<p>{text}</p>
			</div>
		</div>
	);
}
