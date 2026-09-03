import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
	BarChart3,
	CalendarDays,
	GraduationCap,
	LogOut,
	Users,
} from "lucide-react";
import { getSession } from "#/lib/auth.functions";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/dashboard")({
	beforeLoad: async () => {
		const session = await getSession();
		if (!session) throw redirect({ to: "/login" });
		return { user: session.user };
	},
	component: DashboardPage,
});

function DashboardPage() {
	const { user } = Route.useRouteContext();
	return (
		<main className="dashboard-page">
			<header className="dashboard-header">
				<a className="dashboard-brand" href="/">
					<GraduationCap /> Cakna<span>Exam</span>
				</a>
				<button
					type="button"
					onClick={() =>
						authClient.signOut({
							fetchOptions: { onSuccess: () => window.location.assign("/") },
						})
					}
				>
					<LogOut /> Log keluar
				</button>
			</header>
			<section className="dashboard-content">
				<p className="kicker">— Ruang pengurusan anda</p>
				<h1>Selamat datang, {user.name}.</h1>
				<p className="dashboard-lead">
					Semua yang anda perlukan untuk mengurus peperiksaan ada di sini.
				</p>
				<div className="dashboard-cards">
					<article>
						<Users />
						<b>0</b>
						<span>Calon berdaftar</span>
					</article>
					<article>
						<CalendarDays />
						<b>0</b>
						<span>Peperiksaan aktif</span>
					</article>
					<article>
						<BarChart3 />
						<b>0</b>
						<span>Laporan dijana</span>
					</article>
				</div>
				{user.role === "admin" && (
					<Link className="super-admin-link" to="/super-admin">
						Buka Super Admin →
					</Link>
				)}
			</section>
		</main>
	);
}
