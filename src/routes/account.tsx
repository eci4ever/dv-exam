import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import {
	KeyRoundIcon,
	LaptopIcon,
	ShieldAlertIcon,
	UserRoundIcon,
} from "lucide-react";
import { useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";
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
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	changeAccountPassword,
	deleteOwnAccount,
	getAccountSessions,
	revokeAccountSession,
	revokeOtherAccountSessions,
	updateAccountProfile,
} from "@/lib/account";
import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/account")({
	beforeLoad: async () => {
		const dashboard = await getDashboardSession();
		if (!dashboard) throw redirect({ to: "/login" });
		return dashboard;
	},
	loader: () => getAccountSessions(),
	component: AccountSettings,
});

function messageFrom(error: unknown) {
	return error instanceof Error
		? error.message
		: "Something went wrong. Please try again.";
}

function formatDate(value: string | Date) {
	return new Intl.DateTimeFormat("en-MY", {
		dateStyle: "medium",
		timeStyle: "short",
		timeZone: "Asia/Kuala_Lumpur",
	}).format(new Date(value));
}

function SectionHeading({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<div className="space-y-1">
			<h2 className="font-medium">{title}</h2>
			<p className="text-sm leading-6 text-muted-foreground">{description}</p>
		</div>
	);
}

function AccountSettings() {
	const dashboard = Route.useRouteContext();
	const sessionData = Route.useLoaderData();
	const router = useRouter();
	const isImpersonating = Boolean(dashboard.session.session.impersonatedBy);
	const [name, setName] = useState(dashboard.session.user.name);
	const [profileState, setProfileState] = useState<string | null>(null);
	const [profilePending, setProfilePending] = useState(false);
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [securityState, setSecurityState] = useState<string | null>(null);
	const [securityPending, setSecurityPending] = useState(false);
	const [sessionState, setSessionState] = useState<string | null>(null);
	const [sessionPending, setSessionPending] = useState(false);
	const [deleteConfirmation, setDeleteConfirmation] = useState("");
	const [deletePassword, setDeletePassword] = useState("");
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [deletePending, setDeletePending] = useState(false);

	async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setProfilePending(true);
		setProfileState(null);
		try {
			await updateAccountProfile({ data: { name } });
			setProfileState("Profile updated successfully.");
			await router.invalidate();
		} catch (error) {
			setProfileState(messageFrom(error));
		} finally {
			setProfilePending(false);
		}
	}

	async function savePassword(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSecurityPending(true);
		setSecurityState(null);
		try {
			await changeAccountPassword({
				data: { currentPassword, newPassword, confirmPassword },
			});
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
			setSecurityState(
				"Password changed. Your other sessions were signed out.",
			);
			await router.invalidate();
		} catch (error) {
			setSecurityState(messageFrom(error));
		} finally {
			setSecurityPending(false);
		}
	}

	async function revokeSession(token?: string) {
		setSessionPending(true);
		setSessionState(null);
		try {
			if (token) await revokeAccountSession({ data: { token } });
			else await revokeOtherAccountSessions();
			setSessionState(
				token ? "Session revoked." : "All other sessions revoked.",
			);
			await router.invalidate();
		} catch (error) {
			setSessionState(messageFrom(error));
		} finally {
			setSessionPending(false);
		}
	}

	async function deleteAccount() {
		setDeletePending(true);
		setDeleteError(null);
		try {
			await deleteOwnAccount({
				data: { confirmation: deleteConfirmation, password: deletePassword },
			});
			window.location.assign("/");
		} catch (error) {
			setDeleteError(messageFrom(error));
			setDeletePending(false);
		}
	}

	return (
		<SidebarProvider>
			<AppSidebar
				user={dashboard.session.user}
				organizations={dashboard.organizations}
				activeOrganizationId={dashboard.activeOrganizationId}
				isOrganizationOwner={dashboard.isOrganizationOwner}
				organizationRole={dashboard.organizationRole}
				isImpersonating={isImpersonating}
			/>
			<SidebarInset>
				<header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
					<SidebarTrigger className="-ml-1" />
					<Separator
						orientation="vertical"
						className="mr-2 data-vertical:h-4 data-vertical:self-center"
					/>
					<p className="text-sm font-medium">Account settings</p>
				</header>
				{isImpersonating ? (
					<div
						className="border-b bg-destructive/10 px-4 py-3 text-center text-sm text-destructive"
						role="alert"
					>
						Support mode is read-only. Return to admin to make changes.
					</div>
				) : null}
				<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
					<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
						<div className="space-y-1">
							<h1 className="text-2xl font-semibold tracking-tight">
								Account settings
							</h1>
							<p className="text-sm leading-6 text-muted-foreground">
								Manage your identity, password, sessions, and account lifecycle.
							</p>
						</div>
						<Tabs defaultValue="profile" className="gap-5">
							<TabsList
								variant="line"
								className="w-full justify-start overflow-x-auto"
							>
								<TabsTrigger value="profile" className="flex-none">
									<UserRoundIcon />
									Profile
								</TabsTrigger>
								<TabsTrigger value="security" className="flex-none">
									<KeyRoundIcon />
									Security
								</TabsTrigger>
								<TabsTrigger value="sessions" className="flex-none">
									<LaptopIcon />
									Sessions
								</TabsTrigger>
								<TabsTrigger value="danger" className="flex-none">
									<ShieldAlertIcon />
									Danger Zone
								</TabsTrigger>
							</TabsList>

							<TabsContent
								value="profile"
								className="rounded-xl border bg-card p-5 sm:p-6"
							>
								<form className="space-y-6" onSubmit={saveProfile}>
									<SectionHeading
										title="Profile"
										description="Update the name shown across DV-EXAM."
									/>
									<div className="grid gap-5 sm:grid-cols-2">
										<div className="space-y-2">
											<label
												className="text-sm font-medium"
												htmlFor="account-name"
											>
												Display name
											</label>
											<Input
												id="account-name"
												value={name}
												onValueChange={setName}
												minLength={2}
												maxLength={80}
												required
											/>
										</div>
										<div className="space-y-2">
											<label
												className="text-sm font-medium"
												htmlFor="account-email"
											>
												Email address
											</label>
											<Input
												id="account-email"
												value={dashboard.session.user.email}
												disabled
											/>
										</div>
									</div>
									{profileState ? (
										<output className="block text-sm">{profileState}</output>
									) : null}
									<Button
										type="submit"
										disabled={profilePending || isImpersonating}
									>
										{profilePending ? "Saving…" : "Save changes"}
									</Button>
								</form>
							</TabsContent>

							<TabsContent
								value="security"
								className="rounded-xl border bg-card p-5 sm:p-6"
							>
								<form className="space-y-6" onSubmit={savePassword}>
									<SectionHeading
										title="Change password"
										description="Changing your password signs out every other device while keeping this session active."
									/>
									<div className="grid gap-5 sm:grid-cols-2">
										<div className="space-y-2 sm:col-span-2">
											<label
												className="text-sm font-medium"
												htmlFor="current-password"
											>
												Current password
											</label>
											<Input
												id="current-password"
												type="password"
												autoComplete="current-password"
												value={currentPassword}
												onValueChange={setCurrentPassword}
												required
											/>
										</div>
										<div className="space-y-2">
											<label
												className="text-sm font-medium"
												htmlFor="account-new-password"
											>
												New password
											</label>
											<Input
												id="account-new-password"
												type="password"
												autoComplete="new-password"
												value={newPassword}
												onValueChange={setNewPassword}
												minLength={8}
												maxLength={128}
												required
											/>
										</div>
										<div className="space-y-2">
											<label
												className="text-sm font-medium"
												htmlFor="account-confirm-password"
											>
												Confirm password
											</label>
											<Input
												id="account-confirm-password"
												type="password"
												autoComplete="new-password"
												value={confirmPassword}
												onValueChange={setConfirmPassword}
												minLength={8}
												maxLength={128}
												required
											/>
										</div>
									</div>
									{securityState ? (
										<output className="block text-sm">{securityState}</output>
									) : null}
									<Button
										type="submit"
										disabled={securityPending || isImpersonating}
									>
										{securityPending ? "Updating…" : "Update password"}
									</Button>
								</form>
							</TabsContent>

							<TabsContent
								value="sessions"
								className="space-y-4 rounded-xl border bg-card p-5 sm:p-6"
							>
								<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
									<SectionHeading
										title="Active sessions"
										description="Review devices currently signed in to your account."
									/>
									<AlertDialog>
										<AlertDialogTrigger
											render={
												<Button
													variant="outline"
													size="sm"
													disabled={
														isImpersonating || sessionData.sessions.length <= 1
													}
												/>
											}
										>
											Revoke other sessions
										</AlertDialogTrigger>
										<AlertDialogContent>
											<AlertDialogHeader>
												<AlertDialogTitle>
													Revoke all other sessions?
												</AlertDialogTitle>
												<AlertDialogDescription>
													Every other device will need to sign in again. This
													session stays active.
												</AlertDialogDescription>
											</AlertDialogHeader>
											<AlertDialogFooter>
												<AlertDialogCancel>Cancel</AlertDialogCancel>
												<AlertDialogAction
													onClick={() => revokeSession()}
													disabled={sessionPending}
												>
													Revoke sessions
												</AlertDialogAction>
											</AlertDialogFooter>
										</AlertDialogContent>
									</AlertDialog>
								</div>
								{sessionState ? (
									<output className="block text-sm">{sessionState}</output>
								) : null}
								<div className="divide-y rounded-lg border">
									{sessionData.sessions.map((item) => {
										const current = item.id === sessionData.currentSessionId;
										return (
											<div
												className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
												key={item.id}
											>
												<LaptopIcon className="size-5 shrink-0 text-muted-foreground" />
												<div className="min-w-0 flex-1">
													<div className="flex items-center gap-2">
														<p className="truncate text-sm font-medium">
															{item.userAgent ?? "Unknown device"}
														</p>
														{current ? (
															<Badge variant="secondary">Current</Badge>
														) : null}
													</div>
													<p className="mt-1 text-xs text-muted-foreground">
														Started {formatDate(item.createdAt)} · Expires{" "}
														{formatDate(item.expiresAt)}
													</p>
												</div>
												{!current ? (
													<AlertDialog>
														<AlertDialogTrigger
															render={
																<Button
																	variant="outline"
																	size="sm"
																	disabled={isImpersonating}
																/>
															}
														>
															Revoke
														</AlertDialogTrigger>
														<AlertDialogContent>
															<AlertDialogHeader>
																<AlertDialogTitle>
																	Revoke this session?
																</AlertDialogTitle>
																<AlertDialogDescription>
																	This device will be signed out of DV-EXAM.
																</AlertDialogDescription>
															</AlertDialogHeader>
															<AlertDialogFooter>
																<AlertDialogCancel>Cancel</AlertDialogCancel>
																<AlertDialogAction
																	onClick={() => revokeSession(item.token)}
																	disabled={sessionPending}
																>
																	Revoke session
																</AlertDialogAction>
															</AlertDialogFooter>
														</AlertDialogContent>
													</AlertDialog>
												) : null}
											</div>
										);
									})}
								</div>
							</TabsContent>

							<TabsContent
								value="danger"
								className="rounded-xl border border-destructive/40 bg-card p-5 sm:p-6"
							>
								<div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
									<SectionHeading
										title="Delete account"
										description="Permanently delete your account and memberships. Workspace owners must transfer ownership first."
									/>
									<AlertDialog>
										<AlertDialogTrigger
											render={
												<Button
													variant="destructive"
													disabled={isImpersonating}
												/>
											}
										>
											Delete account
										</AlertDialogTrigger>
										<AlertDialogContent>
											<AlertDialogHeader>
												<AlertDialogTitle>
													Delete your account permanently?
												</AlertDialogTitle>
												<AlertDialogDescription>
													This cannot be undone. Enter your current password and
													type DELETE to confirm.
												</AlertDialogDescription>
											</AlertDialogHeader>
											<div className="space-y-3">
												<Input
													type="password"
													autoComplete="current-password"
													placeholder="Current password"
													value={deletePassword}
													onValueChange={setDeletePassword}
												/>
												<Input
													placeholder="Type DELETE"
													value={deleteConfirmation}
													onValueChange={setDeleteConfirmation}
												/>
												{deleteError ? (
													<p className="text-sm text-destructive" role="alert">
														{deleteError}
													</p>
												) : null}
											</div>
											<AlertDialogFooter>
												<AlertDialogCancel>Cancel</AlertDialogCancel>
												<Button
													variant="destructive"
													onClick={deleteAccount}
													disabled={
														deletePending ||
														deleteConfirmation !== "DELETE" ||
														!deletePassword
													}
												>
													{deletePending ? "Deleting…" : "Delete permanently"}
												</Button>
											</AlertDialogFooter>
										</AlertDialogContent>
									</AlertDialog>
								</div>
							</TabsContent>
						</Tabs>
					</div>
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
