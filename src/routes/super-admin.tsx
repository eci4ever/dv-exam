import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
	Activity,
	Ban,
	Building2,
	CheckCircle2,
	CirclePlus,
	LayoutDashboard,
	Sparkles,
	UserCog,
	Users,
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
	createOrganization,
	getSuperAdminOverview,
	setOrganizationOwner,
	updateUserAccess,
} from "#/lib/super-admin.functions";

export const Route = createFileRoute("/super-admin")({
	beforeLoad: async () => {
		const session = await getSession();
		if (!session) throw redirect({ to: "/login" });
		if (session.user.role !== "admin") throw redirect({ to: "/dashboard" });
		return { user: session.user };
	},
	loader: () => getSuperAdminOverview(),
	component: SuperAdminPage,
});

function SuperAdminPage() {
	const { user } = Route.useRouteContext();
	const { metrics, organizations, users } = Route.useLoaderData();
	const router = useRouter();
	const createOrganizationFn = useServerFn(createOrganization);
	const updateUserAccessFn = useServerFn(updateUserAccess);
	const setOrganizationOwnerFn = useServerFn(setOrganizationOwner);
	const [organizationName, setOrganizationName] = useState("");
	const [adminEmail, setAdminEmail] = useState("");
	const [ownerOrganizationId, setOwnerOrganizationId] = useState("");
	const [ownerEmail, setOwnerEmail] = useState("");
	const [notice, setNotice] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [workingUserId, setWorkingUserId] = useState("");
	const refresh = () => router.invalidate({ sync: true });

	async function handleCreateOrganization(
		event: React.FormEvent<HTMLFormElement>,
	) {
		event.preventDefault();
		setNotice("");
		setIsSaving(true);
		try {
			const created = await createOrganizationFn({
				data: { name: organizationName, adminEmail },
			});
			setOrganizationName("");
			setAdminEmail("");
			setNotice(`${created.name} has been added to the platform.`);
			await refresh();
		} catch (error) {
			setNotice(
				error instanceof Error
					? error.message
					: "Unable to add the organisation.",
			);
		} finally {
			setIsSaving(false);
		}
	}

	async function handleUserAction(
		userId: string,
		action: "ban" | "unban" | "make-admin" | "make-user",
	) {
		setNotice("");
		setWorkingUserId(userId);
		try {
			await updateUserAccessFn({ data: { userId, action } });
			setNotice("User access has been updated.");
			await refresh();
		} catch (error) {
			setNotice(
				error instanceof Error
					? error.message
					: "Unable to update user access.",
			);
		} finally {
			setWorkingUserId("");
		}
	}

	async function handleSetOwner(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setNotice("");
		setIsSaving(true);
		try {
			const owner = await setOrganizationOwnerFn({
				data: { organizationId: ownerOrganizationId, email: ownerEmail },
			});
			setOwnerEmail("");
			setNotice(`${owner.name} is now the owner of this organisation.`);
			await refresh();
		} catch (error) {
			setNotice(
				error instanceof Error ? error.message : "Unable to assign the owner.",
			);
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<DashboardShell pageTitle="Super Admin" user={user}>
			<div className="mx-auto w-full max-w-[1440px] space-y-5 px-4 py-5 pb-10 sm:px-6 sm:py-6 lg:px-8">
				<section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
					<div>
						<p className="text-sm font-medium text-muted-foreground">
							PLATFORM CONTROL
						</p>
						<h1 className="mt-1 flex items-center gap-2 text-3xl font-bold tracking-tight">
							Welcome back, {user.name.split(" ")[0]}{" "}
							<Sparkles className="size-5 text-amber-500" />
						</h1>
						<p className="mt-2 text-sm text-muted-foreground">
							Manage organisations, users and administrative access from one
							workspace.
						</p>
					</div>
					<Badge className="w-fit" variant="outline">
						<Activity className="mr-1 size-3" /> System operational
					</Badge>
				</section>
				<section className="grid gap-4 md:grid-cols-3">
					<Metric
						icon={<Building2 />}
						value={metrics.organizations}
						label="Active organisations"
					/>
					<Metric icon={<Users />} value={metrics.users} label="Total users" />
					<Metric
						icon={<Activity />}
						value={metrics.activeSessions}
						label="Active sessions"
					/>
				</section>
				{notice && (
					<div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
						<CheckCircle2 className="size-4" />
						{notice}
					</div>
				)}
				<section className="grid gap-6 lg:grid-cols-[380px_1fr]">
					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<CirclePlus className="size-5 text-primary" />
								<div>
									<CardTitle>New organisation</CardTitle>
									<CardDescription>
										Create a workspace and invite an administrator.
									</CardDescription>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<form className="space-y-4" onSubmit={handleCreateOrganization}>
								<label
									className="grid gap-2 text-sm font-medium"
									htmlFor="organization-name"
								>
									Organisation name
									<Input
										id="organization-name"
										onChange={(event) =>
											setOrganizationName(event.target.value)
										}
										placeholder="Kolej Maju"
										required
										value={organizationName}
									/>
								</label>
								<label
									className="grid gap-2 text-sm font-medium"
									htmlFor="organization-admin-email"
								>
									Administrator email{" "}
									<span className="font-normal text-muted-foreground">
										(optional)
									</span>
									<Input
										id="organization-admin-email"
										onChange={(event) => setAdminEmail(event.target.value)}
										placeholder="admin@organisasi.edu.my"
										type="email"
										value={adminEmail}
									/>
								</label>
								<Button className="w-full" disabled={isSaving} type="submit">
									{isSaving ? "Saving…" : "Create organisation"}
								</Button>
							</form>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Building2 className="size-5 text-primary" /> Organisasi terkini
							</CardTitle>
							<CardDescription>
								Keahlian dan jemputan yang memerlukan perhatian.
							</CardDescription>
						</CardHeader>
						<CardContent>
							{organizations.length ? (
								<div className="divide-y">
									{organizations.map((organization) => (
										<div
											className="flex items-center gap-3 py-3"
											key={organization.id}
										>
											<div className="grid size-9 place-items-center rounded-md bg-muted font-semibold text-muted-foreground">
												{organization.name.slice(0, 1).toUpperCase()}
											</div>
											<div className="min-w-0 flex-1">
												<p className="truncate text-sm font-medium">
													{organization.name}
												</p>
												<p className="text-xs text-muted-foreground">
													{organization.memberCount} ahli ·{" "}
													{organization.pendingInvitationCount} jemputan
													menunggu
												</p>
												<p className="mt-1 text-xs text-muted-foreground">
													Owner: {organization.ownerName ?? "Belum ditetapkan"}
												</p>
											</div>
											<Badge variant="outline">{organization.slug}</Badge>
										</div>
									))}
								</div>
							) : (
								<EmptyState
									icon={<Building2 />}
									text="Belum ada organisasi. Cipta organisasi pertama anda."
								/>
							)}
						</CardContent>
					</Card>
				</section>
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<UserCog className="size-5 text-primary" /> Tetapkan Owner
							organisasi
						</CardTitle>
						<CardDescription>
							Owner mengurus ahli, jemputan dan tetapan untuk organisasi
							terpilih. Ia tidak memberikan akses Super Admin platform.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form
							className="grid gap-4 md:grid-cols-[1fr_1fr_auto]"
							onSubmit={handleSetOwner}
						>
							<label
								className="grid gap-2 text-sm font-medium"
								htmlFor="owner-organization"
							>
								Organisasi
								<select
									className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
									id="owner-organization"
									onChange={(event) =>
										setOwnerOrganizationId(event.target.value)
									}
									required
									value={ownerOrganizationId}
								>
									<option value="">Pilih organisasi</option>
									{organizations.map((organization) => (
										<option key={organization.id} value={organization.id}>
											{organization.name}
										</option>
									))}
								</select>
							</label>
							<label
								className="grid gap-2 text-sm font-medium"
								htmlFor="owner-email"
							>
								E-mel pengguna berdaftar
								<Input
									id="owner-email"
									onChange={(event) => setOwnerEmail(event.target.value)}
									placeholder="owner@organisasi.edu.my"
									required
									type="email"
									value={ownerEmail}
								/>
							</label>
							<Button
								className="self-end"
								disabled={isSaving || !organizations.length}
								type="submit"
							>
								Tetapkan Owner
							</Button>
						</form>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex-row items-center justify-between space-y-0">
						<div>
							<CardTitle className="flex items-center gap-2">
								<UserCog className="size-5 text-primary" /> Pengguna terbaru
							</CardTitle>
							<CardDescription>
								Urus peranan Super Admin dan status akses akaun.
							</CardDescription>
						</div>
						<Badge variant="secondary">{metrics.users} pengguna</Badge>
					</CardHeader>
					<CardContent>
						<div className="overflow-x-auto">
							<div className="min-w-[760px]">
								<div className="grid grid-cols-[minmax(230px,1.5fr)_120px_100px_260px] gap-4 px-3 pb-2 text-xs font-medium text-muted-foreground">
									<span>Pengguna</span>
									<span>Peranan</span>
									<span>Status</span>
									<span className="text-right">Tindakan</span>
								</div>
								<Separator />
								{users.map((listedUser) => (
									<div
										className="grid min-h-16 grid-cols-[minmax(230px,1.5fr)_120px_100px_260px] items-center gap-4 px-3"
										key={listedUser.id}
									>
										<div className="flex min-w-0 items-center gap-3">
											<div className="grid size-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
												{listedUser.name.slice(0, 1).toUpperCase()}
											</div>
											<div className="min-w-0">
												<p className="truncate text-sm font-medium">
													{listedUser.name}
												</p>
												<p className="truncate text-xs text-muted-foreground">
													{listedUser.email}
												</p>
											</div>
										</div>
										<Badge
											className="w-fit"
											variant={
												listedUser.role === "admin" ? "default" : "secondary"
											}
										>
											{listedUser.role === "admin" ? "Super Admin" : "Pengguna"}
										</Badge>
										<Badge
											className="w-fit"
											variant={listedUser.banned ? "destructive" : "outline"}
										>
											{listedUser.banned ? "Disekat" : "Aktif"}
										</Badge>
										<div className="flex justify-end gap-2">
											{listedUser.id !== user.id && (
												<>
													<Button
														disabled={workingUserId === listedUser.id}
														onClick={() =>
															handleUserAction(
																listedUser.id,
																listedUser.role === "admin"
																	? "make-user"
																	: "make-admin",
															)
														}
														size="sm"
														variant="outline"
													>
														{listedUser.role === "admin"
															? "Tarik admin"
															: "Jadikan admin"}
													</Button>
													<Button
														disabled={workingUserId === listedUser.id}
														onClick={() =>
															handleUserAction(
																listedUser.id,
																listedUser.banned ? "unban" : "ban",
															)
														}
														size="sm"
														variant={
															listedUser.banned ? "outline" : "destructive"
														}
													>
														{listedUser.banned ? (
															"Pulihkan"
														) : (
															<>
																<Ban /> Sekat
															</>
														)}
													</Button>
												</>
											)}
										</div>
									</div>
								))}
							</div>
						</div>
						{!users.length && (
							<EmptyState
								icon={<Users />}
								text="Pengguna berdaftar akan muncul di sini."
							/>
						)}
					</CardContent>
				</Card>
				<p className="flex items-center gap-2 text-xs text-muted-foreground">
					<LayoutDashboard className="size-4" /> Jemputan direkodkan dalam
					platform; e-mel transaksi boleh diaktifkan sebelum produksi.
				</p>
			</div>
		</DashboardShell>
	);
}

function Metric({
	icon,
	value,
	label,
}: {
	icon: React.ReactNode;
	value: number;
	label: string;
}) {
	return (
		<Card>
			<CardContent className="flex items-center gap-4 p-5">
				<span className="rounded-md bg-primary/10 p-2 text-primary">
					{icon}
				</span>
				<div>
					<p className="text-2xl font-bold">{value}</p>
					<p className="text-sm text-muted-foreground">{label}</p>
				</div>
			</CardContent>
		</Card>
	);
}
function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
	return (
		<div className="grid min-h-32 place-items-center gap-2 py-6 text-center text-sm text-muted-foreground">
			{icon}
			<p>{text}</p>
		</div>
	);
}
