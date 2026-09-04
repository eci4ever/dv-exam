import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
	Activity,
	ArrowRight,
	BarChart3,
	BookOpenCheck,
	CalendarDays,
	CheckCircle2,
	FilePlus2,
	Gauge,
	RefreshCw,
	ShieldCheck,
	Sparkles,
	Users,
	Wifi,
} from "lucide-react";
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
import { getSession } from "#/lib/auth.functions";

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
		<DashboardShell futuristic pageTitle="Pusat Kawalan" user={user}>
			<div className="mx-auto w-full max-w-[1440px] space-y-5 px-4 py-5 pb-10 sm:px-6 sm:py-6 lg:px-8">
				<section className="overflow-hidden rounded-xl border border-sky-400/15 bg-[#0a1020]/85 shadow-[0_0_40px_rgba(14,165,233,0.06)]">
					<div className="flex flex-col gap-4 border-b border-sky-400/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
						<div>
							<p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">
								<Activity className="size-3.5" /> Sistem overview
							</p>
							<h1 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
								Selamat datang kembali, {user.name.split(" ")[0]}.
							</h1>
						</div>
						<Badge className="w-fit border border-cyan-400/20 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/10">
							<span className="mr-1.5 size-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_currentColor]" />
							Sistem aktif
						</Badge>
					</div>
					<div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
						<Metric
							icon={<Users className="text-cyan-300" />}
							label="Calon berdaftar"
							value="0"
							helper="Belum ada calon"
						/>
						<Metric
							icon={<CalendarDays className="text-violet-300" />}
							label="Peperiksaan aktif"
							value="0"
							helper="Tiada peperiksaan berjalan"
						/>
						<Metric
							icon={<BarChart3 className="text-emerald-300" />}
							label="Laporan dijana"
							value="0"
							helper="Data akan muncul di sini"
						/>
					</div>
				</section>

				<section className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_320px]">
					<Card className="border-sky-400/15 bg-[#0a1020]/85 shadow-[0_0_32px_rgba(14,165,233,0.04)]">
						<CardHeader className="border-b border-sky-400/10">
							<div className="flex items-center justify-between gap-3">
								<div>
									<CardTitle className="flex items-center gap-2 text-base text-slate-100">
										<Gauge className="size-4 text-cyan-300" /> Prestasi
										peperiksaan
									</CardTitle>
									<CardDescription className="mt-1 text-slate-400">
										Aktiviti sistem bagi 24 jam terakhir.
									</CardDescription>
								</div>
								<Badge
									variant="outline"
									className="border-sky-400/20 text-cyan-300"
								>
									Langsung
								</Badge>
							</div>
						</CardHeader>
						<CardContent className="p-5">
							<div className="grid min-h-64 place-items-center overflow-hidden rounded-lg border border-sky-400/10 bg-[linear-gradient(rgba(56,189,248,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.05)_1px,transparent_1px)] bg-[size:2rem_2rem] p-6">
								<div className="max-w-md text-center">
									<Activity className="mx-auto size-7 text-cyan-300" />
									<p className="mt-4 text-sm font-medium text-slate-200">
										Menunggu data peperiksaan
									</p>
									<p className="mt-1 text-xs leading-5 text-slate-400">
										Graf aktiviti calon dan kadar penyelesaian akan muncul
										apabila peperiksaan pertama diterbitkan.
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
					<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
						<Card className="border-sky-400/15 bg-[#0a1020]/85">
							<CardContent className="p-5">
								<p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
									Status sistem
								</p>
								<p className="mt-3 font-mono text-3xl font-semibold tracking-tight text-cyan-300">
									ONLINE
								</p>
								<div className="mt-4 flex items-center justify-between border-t border-sky-400/10 pt-4 text-xs text-slate-400">
									<span className="flex items-center gap-2">
										<Wifi className="size-3.5 text-cyan-300" /> D1 database
									</span>
									<span className="text-emerald-300">Stabil</span>
								</div>
							</CardContent>
						</Card>
						<Card className="border-sky-400/15 bg-[#0a1020]/85">
							<CardContent className="grid grid-cols-2 gap-2 p-4">
								<QuickAction icon={<FilePlus2 />} label="Cipta peperiksaan" />
								<QuickAction icon={<BookOpenCheck />} label="Bank soalan" />
								<QuickAction icon={<RefreshCw />} label="Segar semula" />
								<QuickAction icon={<ShieldCheck />} label="Keselamatan" />
							</CardContent>
						</Card>
					</div>
				</section>

				<section className="grid gap-5 lg:grid-cols-2">
					<Card className="border-sky-400/15 bg-[#0a1020]/85">
						<CardHeader>
							<CardTitle className="text-base text-slate-100">
								Langkah seterusnya
							</CardTitle>
							<CardDescription className="text-slate-400">
								Lengkapkan persediaan ruang kerja anda.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-1">
							<Step done title="Akaun telah dicipta" />
							<Step title="Cipta peperiksaan pertama" />
							<Step title="Tambah calon peperiksaan" />
						</CardContent>
					</Card>
					<Card className="border-sky-400/15 bg-[#0a1020]/85">
						<CardContent className="flex h-full flex-col justify-between gap-5 p-6">
							<div>
								<p className="text-sm font-semibold text-slate-100">
									Ruang kerja organisasi
								</p>
								<p className="mt-2 text-sm leading-6 text-slate-400">
									Pilih organisasi aktif, lihat ahli dan urus jemputan dari satu
									tempat.
								</p>
							</div>
							<Button
								asChild
								variant="outline"
								className="w-fit border-sky-400/20 bg-sky-400/5 text-cyan-200 hover:bg-sky-400/10 hover:text-cyan-100"
							>
								<Link to="/organizations">
									Urus organisasi <ArrowRight />
								</Link>
							</Button>
						</CardContent>
					</Card>
				</section>
				{user.role === "admin" && (
					<Button
						asChild
						variant="ghost"
						className="text-slate-400 hover:bg-sky-400/10 hover:text-cyan-200"
					>
						<Link to="/super-admin">
							<Sparkles /> Buka konsol Super Admin <ArrowRight />
						</Link>
					</Button>
				)}
			</div>
		</DashboardShell>
	);
}

function Metric({
	icon,
	label,
	value,
	helper,
}: {
	icon: React.ReactNode;
	label: string;
	value: string;
	helper: string;
}) {
	return (
		<Card className="border-sky-400/10 bg-[#0e1628] shadow-none transition-colors hover:border-sky-400/25">
			<CardContent className="flex items-center gap-4 p-5">
				<span className="grid size-11 place-items-center rounded-lg bg-sky-400/10">
					{icon}
				</span>
				<div>
					<p className="text-2xl font-semibold tracking-tight text-slate-100">
						{value}
					</p>
					<p className="text-sm font-medium text-slate-200">{label}</p>
					<p className="mt-1 text-xs text-slate-500">{helper}</p>
				</div>
			</CardContent>
		</Card>
	);
}

function Step({ title, done = false }: { title: string; done?: boolean }) {
	return (
		<div className="flex items-center gap-3 rounded-lg p-3 hover:bg-sky-400/5">
			<span className={done ? "text-emerald-400" : "text-slate-500"}>
				<CheckCircle2 className="size-5" />
			</span>
			<span
				className={
					done ? "text-sm font-medium text-slate-200" : "text-sm text-slate-400"
				}
			>
				{title}
			</span>
		</div>
	);
}

function QuickAction({
	icon,
	label,
}: {
	icon: React.ReactNode;
	label: string;
}) {
	return (
		<button
			type="button"
			className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border border-sky-400/10 bg-sky-400/[0.03] px-2 text-center text-xs text-slate-300 transition-colors hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-200"
		>
			{icon}
			<span>{label}</span>
		</button>
	);
}
