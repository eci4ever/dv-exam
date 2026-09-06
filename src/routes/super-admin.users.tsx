import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Search, Shield, Trash2 } from "lucide-react";
import { useState } from "react";
import { DashboardShell } from "#/components/dashboard-shell";
import { ReasonDialog } from "#/components/reason-dialog";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { getSession } from "#/lib/auth.functions";
import {
	getPlatformUsers,
	resendUserVerification,
	revokeUserSessions,
	updateUserAccess,
} from "#/lib/super-admin.functions";

export const Route = createFileRoute("/super-admin/users")({
	beforeLoad: async () => {
		const session = await getSession();
		if (!session) throw redirect({ to: "/login" });
		if (session.user.role !== "admin") throw redirect({ to: "/dashboard" });
		return { user: session.user };
	},
	loader: () => getPlatformUsers(),
	component: UsersPage,
});

function UsersPage() {
	const { user } = Route.useRouteContext();
	const initial = Route.useLoaderData() as { users: any[]; hasMore: boolean };
	const router = useRouter();
	const access = useServerFn(updateUserAccess);
	const getUsers = useServerFn(getPlatformUsers);
	const revoke = useServerFn(revokeUserSessions);
	const verify = useServerFn(resendUserVerification);
	const [query, setQuery] = useState("");
	const [users, setUsers] = useState(initial.users);
	const [hasMore, setHasMore] = useState(initial.hasMore);
	const [offset, setOffset] = useState(0);
	const [notice, setNotice] = useState("");
	async function loadUsers(nextOffset = 0) {
		try {
			const result = (await getUsers({
				data: { query: query || undefined, offset: nextOffset },
			})) as { users: any[]; hasMore: boolean };
			setUsers(result.users);
			setHasMore(result.hasMore);
			setOffset(nextOffset);
		} catch (error) {
			setNotice(
				error instanceof Error ? error.message : "Unable to load users.",
			);
		}
	}
	async function run(action: () => Promise<unknown>, success: string) {
		try {
			await action();
			setNotice(success);
			await router.invalidate({ sync: true });
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Action failed.");
		}
	}
	return (
		<DashboardShell user={user} pageTitle="Platform users">
			<div className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
				<section>
					<p className="text-sm text-muted-foreground">
						Platform administration
					</p>
					<h1 className="mt-1 text-2xl font-semibold">Users</h1>
				</section>
				{notice ? (
					<p className="rounded-md border p-3 text-sm">{notice}</p>
				) : null}
				<div className="relative max-w-md">
					<Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
					<Input
						className="pl-9"
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Search name or email"
						value={query}
					/>
				</div>
				<Button
					onClick={() => void loadUsers()}
					type="button"
					variant="outline"
				>
					<Search /> Search
				</Button>
				<Card>
					<CardContent className="divide-y p-0">
						{users.map((item) => (
							<div
								className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center"
								key={item.id}
							>
								<div className="min-w-0 flex-1">
									<p className="font-medium">{item.name}</p>
									<p className="truncate text-sm text-muted-foreground">
										{item.email}
									</p>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<Badge
										variant={item.role === "admin" ? "default" : "secondary"}
									>
										{item.role === "admin" ? "Platform admin" : "User"}
									</Badge>
									<Badge variant={item.banned ? "destructive" : "outline"}>
										{item.banned ? "Suspended" : "Active"}
									</Badge>
									{item.id !== user.id ? (
										<ReasonDialog
											confirmLabel={item.banned ? "Reactivate" : "Suspend"}
											description="This changes the user's access to the platform."
											onConfirm={(reason) =>
												run(
													() =>
														access({
															data: {
																userId: item.id,
																action: item.banned ? "unban" : "ban",
																reason,
															},
														}),
													"User access updated. Audit record created.",
												)
											}
											title={`${item.banned ? "Reactivate" : "Suspend"} ${item.name}`}
											trigger={
												<Button
													size="sm"
													variant={item.banned ? "outline" : "destructive"}
												>
													{item.banned ? "Reactivate" : "Suspend"}
												</Button>
											}
										/>
									) : null}
									{item.id !== user.id ? (
										<ReasonDialog
											confirmLabel={
												item.role === "admin" ? "Remove admin" : "Make admin"
											}
											description="Platform administrator access is global and audited."
											onConfirm={(reason) =>
												run(
													() =>
														access({
															data: {
																userId: item.id,
																action:
																	item.role === "admin"
																		? "make-user"
																		: "make-admin",
																reason,
															},
														}),
													"Platform role updated. Audit record created.",
												)
											}
											title="Change platform role"
											trigger={
												<Button size="sm" variant="outline">
													<Shield />
													{item.role === "admin"
														? "Remove admin"
														: "Make admin"}
												</Button>
											}
										/>
									) : null}
									{item.id !== user.id ? (
										<ReasonDialog
											confirmLabel="Revoke sessions"
											description="This signs the user out from all devices."
											onConfirm={(reason) =>
												run(
													() => revoke({ data: { userId: item.id, reason } }),
													"Sessions revoked. Audit record created.",
												)
											}
											title="Revoke all sessions"
											trigger={
												<Button size="sm" variant="ghost">
													<Trash2 /> Sessions
												</Button>
											}
										/>
									) : null}
									{!item.emailVerified ? (
										<ReasonDialog
											confirmLabel="Send verification"
											description="A new verification email will be sent to this user."
											onConfirm={(reason) =>
												run(
													() => verify({ data: { userId: item.id, reason } }),
													"Verification email sent. Audit record created.",
												)
											}
											title="Resend verification"
											trigger={
												<Button size="sm" variant="ghost">
													Verify
												</Button>
											}
										/>
									) : null}
								</div>
							</div>
						))}
					</CardContent>
				</Card>
				<div className="flex items-center justify-between gap-3">
					<Button
						disabled={offset === 0}
						onClick={() => void loadUsers(Math.max(0, offset - 50))}
						type="button"
						variant="outline"
					>
						Previous
					</Button>
					<Button
						disabled={!hasMore}
						onClick={() => void loadUsers(offset + 50)}
						type="button"
						variant="outline"
					>
						Next
					</Button>
				</div>
			</div>
		</DashboardShell>
	);
}
