import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	ArrowRight,
	GraduationCap,
	LockKeyhole,
	Mail,
	ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { Checkbox } from "#/components/ui/checkbox";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Separator } from "#/components/ui/separator";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/login")({
	validateSearch: (search: Record<string, unknown>) => ({
		redirect: sanitizeRedirect(search.redirect),
	}),
	component: LoginPage,
});

function LoginPage() {
	const [submitted, setSubmitted] = useState(false);
	const [error, setError] = useState("");
	const navigate = useNavigate();
	const { redirect } = Route.useSearch();

	return (
		<main className="auth-screen dark grid min-h-svh lg:grid-cols-[1fr_520px]">
			<section className="relative hidden overflow-hidden border-r border-sky-400/10 bg-[#050816] p-10 lg:flex lg:flex-col">
				<div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_35%,rgba(14,165,233,0.13),transparent_24rem)]" />
				<Link
					className="relative flex items-center gap-2 text-sm font-semibold text-slate-100"
					to="/"
				>
					<span className="grid size-9 place-items-center rounded-lg border border-sky-400/30 bg-sky-400/10 text-cyan-300">
						<GraduationCap className="size-5" />
					</span>
					CaknaExam
				</Link>
				<div className="relative my-auto max-w-lg">
					<p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">
						Pusat kawalan peperiksaan
					</p>
					<h1 className="mt-4 text-4xl font-semibold tracking-tight text-white xl:text-5xl">
						Setiap keputusan,{" "}
						<span className="text-cyan-300">lebih bermakna.</span>
					</h1>
					<p className="mt-5 max-w-md text-sm leading-7 text-slate-400">
						Urus peperiksaan, calon dan prestasi dalam ruang kerja yang sentiasa
						jelas dan selamat.
					</p>
				</div>
				<div className="relative flex items-center gap-3 border-t border-sky-400/10 pt-6 text-sm text-slate-400">
					<span className="grid size-9 place-items-center rounded-full bg-sky-400/10 text-cyan-300">
						<ShieldCheck className="size-4" />
					</span>
					<span>
						<b className="block text-slate-200">Data dilindungi</b>
						<small>Keselamatan bertaraf industri</small>
					</span>
				</div>
			</section>
			<section className="flex min-h-svh items-center justify-center bg-[#09101e] px-4 py-10 sm:px-6">
				<div className="w-full max-w-md">
					<Link
						className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-300"
						to="/"
					>
						<ArrowLeft className="size-4" /> Kembali ke laman utama
					</Link>
					<Card className="border-sky-400/15 bg-[#0a1020] shadow-[0_0_42px_rgba(14,165,233,0.06)]">
						<CardHeader>
							<p className="text-xs font-medium uppercase tracking-[0.16em] text-cyan-300">
								Selamat kembali
							</p>
							<CardTitle className="mt-2 text-2xl text-slate-100">
								Log masuk ke akaun anda
							</CardTitle>
							<CardDescription className="text-slate-400">
								Belum mempunyai akaun?{" "}
								<Link
									className="text-cyan-300 hover:underline"
									search={{ redirect }}
									to="/signup"
								>
									Daftar secara percuma
								</Link>
							</CardDescription>
						</CardHeader>
						<CardContent>
							<form
								className="space-y-4"
								onSubmit={async (event) => {
									event.preventDefault();
									setError("");
									const formData = new FormData(event.currentTarget);
									const result = await authClient.signIn.email({
										email: String(formData.get("email")),
										password: String(formData.get("password")),
									});
									if (result.error) {
										setError(
											result.error.message ?? "Log masuk tidak berjaya.",
										);
										return;
									}
									setSubmitted(true);
									navigate({ href: redirect });
								}}
							>
								<Field icon={<Mail />} id="login-email" label="Alamat e-mel">
									<Input
										className="pl-10"
										id="login-email"
										name="email"
										type="email"
										placeholder="anda@organisasi.my"
										required
									/>
								</Field>
								<Field
									icon={<LockKeyhole />}
									id="login-password"
									label="Kata laluan"
								>
									<Input
										className="pl-10"
										id="login-password"
										name="password"
										type="password"
										placeholder="Masukkan kata laluan"
										required
									/>
								</Field>
								<div className="flex items-center justify-between text-sm">
									<Label
										className="flex items-center gap-2 font-normal text-slate-400"
										htmlFor="remember-me"
									>
										<Checkbox id="remember-me" /> Ingat saya
									</Label>
									<a className="text-cyan-300 hover:underline" href="#lupa">
										Lupa kata laluan?
									</a>
								</div>
								<Button
									className="w-full bg-cyan-300 text-slate-950 hover:bg-cyan-200"
									type="submit"
								>
									Log masuk <ArrowRight />
								</Button>
								{error && (
									<p className="rounded-md border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">
										{error}
									</p>
								)}
								{submitted && (
									<p className="rounded-md border border-cyan-400/25 bg-cyan-400/10 p-3 text-sm text-cyan-200">
										Log masuk berjaya. Menghala ke dashboard anda…
									</p>
								)}
							</form>
							<div className="my-6 flex items-center gap-3">
								<Separator className="bg-sky-400/15" />
								<span className="text-xs text-slate-500">atau</span>
								<Separator className="bg-sky-400/15" />
							</div>
							<Button
								className="w-full border-sky-400/20 bg-sky-400/5 text-slate-200 hover:bg-sky-400/10"
								type="button"
								variant="outline"
							>
								<span className="font-semibold text-cyan-300">G</span> Google
								Workspace
							</Button>
						</CardContent>
					</Card>
				</div>
			</section>
		</main>
	);
}

function Field({
	children,
	icon,
	id,
	label,
}: {
	children: React.ReactNode;
	icon: React.ReactNode;
	id: string;
	label: string;
}) {
	return (
		<div className="space-y-2">
			<Label className="text-slate-300" htmlFor={id}>
				{label}
			</Label>
			<div className="relative">
				<span className="pointer-events-none absolute inset-y-0 left-3 z-10 grid place-items-center text-slate-500">
					{icon}
				</span>
				{children}
			</div>
		</div>
	);
}

function sanitizeRedirect(value: unknown) {
	return typeof value === "string" &&
		value.startsWith("/") &&
		!value.startsWith("//")
		? value
		: "/dashboard";
}
