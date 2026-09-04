import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	CheckCircle2,
	Mail,
	Monitor,
	ShieldCheck,
	Trash2,
	UserRound,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/account")({
	beforeLoad: async () => {
		const session = await getSession();
		if (!session) throw redirect({ to: "/login" });
		return { user: session.user, session: session.session };
	},
	component: AccountPage,
});

function AccountPage() {
	const { user, session } = Route.useRouteContext();
	const [name, setName] = useState(user.name);
	const [sessions, setSessions] = useState<
		Array<{
			token: string;
			userAgent?: string | null;
			ipAddress?: string | null;
			createdAt: Date | string;
		}>
	>([]);
	const [notice, setNotice] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [isLoadingSessions, setIsLoadingSessions] = useState(true);

	const loadSessions = useCallback(async () => {
		setIsLoadingSessions(true);
		const result = await authClient.listSessions();
		if (result.data) setSessions(result.data);
		setIsLoadingSessions(false);
	}, []);
	useEffect(() => {
		void loadSessions();
	}, [loadSessions]);

	async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setNotice("");
		setIsSaving(true);
		const result = await authClient.updateUser({ name });
		setNotice(
			result.error
				? (result.error.message ?? "Profil tidak dapat dikemas kini.")
				: "Profil anda telah dikemas kini.",
		);
		setIsSaving(false);
	}
	async function sendVerification() {
		setNotice("");
		const result = await authClient.sendVerificationEmail({
			email: user.email,
			callbackURL: "/account",
		});
		setNotice(
			result.error
				? (result.error.message ?? "E-mel verifikasi tidak dapat dihantar.")
				: "Pautan verifikasi telah dihantar ke e-mel anda.",
		);
	}
	async function revokeSession(token: string) {
		const result = await authClient.revokeSession({ token });
		setNotice(
			result.error
				? (result.error.message ?? "Sesi tidak dapat ditamatkan.")
				: "Sesi telah ditamatkan.",
		);
		await loadSessions();
	}
	async function revokeOthers() {
		const result = await authClient.revokeOtherSessions();
		setNotice(
			result.error
				? (result.error.message ?? "Sesi tidak dapat ditamatkan.")
				: "Semua sesi lain telah ditamatkan.",
		);
		await loadSessions();
	}

	return (
		<DashboardShell pageTitle="Tetapan akaun" user={user}>
			<div className="mx-auto w-full max-w-[1440px] space-y-5 px-4 py-5 pb-10 sm:px-6 sm:py-6 lg:px-8">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Tetapan akaun</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						Urus profil, pengesahan e-mel dan sesi peranti anda.
					</p>
				</div>
				{notice && (
					<p className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
						<CheckCircle2 className="size-4 text-primary" />
						{notice}
					</p>
				)}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<UserRound className="size-5 text-primary" /> Profil
						</CardTitle>
						<CardDescription>
							Nama anda akan digunakan dalam ruang kerja dan jemputan
							organisasi.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form
							className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]"
							onSubmit={saveProfile}
						>
							<label
								className="grid gap-2 text-sm font-medium"
								htmlFor="account-name"
							>
								Nama penuh
								<Input
									id="account-name"
									onChange={(event) => setName(event.target.value)}
									required
									value={name}
								/>
							</label>
							<label
								className="grid gap-2 text-sm font-medium"
								htmlFor="account-email"
							>
								E-mel
								<Input disabled id="account-email" value={user.email} />
							</label>
							<Button className="self-end" disabled={isSaving} type="submit">
								{isSaving ? "Menyimpan…" : "Simpan profil"}
							</Button>
						</form>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex-row items-center justify-between space-y-0">
						<div>
							<CardTitle className="flex items-center gap-2">
								<Mail className="size-5 text-primary" /> Pengesahan e-mel
							</CardTitle>
							<CardDescription>
								Alamat e-mel yang disahkan membantu melindungi akaun anda.
							</CardDescription>
						</div>
						<Badge variant={user.emailVerified ? "default" : "secondary"}>
							{user.emailVerified ? "Disahkan" : "Belum disahkan"}
						</Badge>
					</CardHeader>
					<CardContent className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
						<p className="text-sm text-muted-foreground">{user.email}</p>
						{user.emailVerified ? (
							<span className="flex items-center gap-2 text-sm font-medium text-emerald-700">
								<ShieldCheck className="size-4" /> E-mel telah disahkan
							</span>
						) : (
							<Button onClick={sendVerification} variant="outline">
								Hantar pautan verifikasi
							</Button>
						)}
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex-row items-center justify-between space-y-0">
						<div>
							<CardTitle className="flex items-center gap-2">
								<Monitor className="size-5 text-primary" /> Sesi aktif
							</CardTitle>
							<CardDescription>
								Semak peranti yang sedang mempunyai akses ke akaun anda.
							</CardDescription>
						</div>
						<Button onClick={revokeOthers} size="sm" variant="outline">
							Tamatkan sesi lain
						</Button>
					</CardHeader>
					<CardContent>
						<div className="divide-y">
							{isLoadingSessions ? (
								<p className="py-5 text-sm text-muted-foreground">
									Memuatkan sesi…
								</p>
							) : (
								sessions.map((listedSession) => (
									<div
										className="flex items-center justify-between gap-4 py-4"
										key={listedSession.token}
									>
										<div>
											<p className="text-sm font-medium">
												{listedSession.token === session.token
													? "Sesi semasa"
													: "Peranti lain"}
											</p>
											<p className="mt-1 max-w-xl truncate text-xs text-muted-foreground">
												{listedSession.userAgent ?? "Peranti tidak dikenali"}
												{listedSession.ipAddress
													? ` · ${listedSession.ipAddress}`
													: ""}
											</p>
										</div>
										{listedSession.token === session.token ? (
											<Badge variant="secondary">Semasa</Badge>
										) : (
											<Button
												onClick={() => revokeSession(listedSession.token)}
												size="sm"
												variant="ghost"
											>
												<Trash2 /> Tamatkan
											</Button>
										)}
									</div>
								))
							)}
						</div>
						<Separator className="mt-1" />
						<p className="pt-4 text-xs text-muted-foreground">
							Anda mungkin perlu log masuk semula jika sesi semasa ditamatkan.
						</p>
					</CardContent>
				</Card>
			</div>
		</DashboardShell>
	);
}
