import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	ArrowRight,
	Check,
	GraduationCap,
	LockKeyhole,
	Mail,
	UserRound,
} from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Checkbox } from "#/components/ui/checkbox";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/signup")({
	validateSearch: (search: Record<string, unknown>) => ({
		redirect: sanitizeRedirect(search.redirect),
	}),
	component: SignupPage,
});

function SignupPage() {
	const [submitted, setSubmitted] = useState(false);
	const [error, setError] = useState("");
	const navigate = useNavigate();
	const { redirect } = Route.useSearch();

	return (
		<main className="auth-screen dark grid min-h-svh lg:grid-cols-[1fr_520px]">
			<section className="relative hidden overflow-hidden border-r border-sky-400/10 bg-[#050816] p-10 lg:flex lg:flex-col">
				<div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_65%,rgba(14,165,233,0.14),transparent_25rem)]" />
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
						Mula dengan yakin
					</p>
					<h1 className="mt-4 text-4xl font-semibold tracking-tight text-white xl:text-5xl">
						Pengurusan yang{" "}
						<span className="text-cyan-300">lebih jelas bermula di sini.</span>
					</h1>
					<p className="mt-5 text-sm leading-7 text-slate-400">
						Sertai ruang kerja yang membantu pasukan anda mengurus setiap
						peperiksaan dengan teratur.
					</p>
				</div>
				<ul className="relative space-y-3 border-t border-sky-400/10 pt-6 text-sm text-slate-300">
					<li className="flex items-center gap-2">
						<Check className="size-4 text-cyan-300" /> Sediakan sesi peperiksaan
						dalam beberapa minit
					</li>
					<li className="flex items-center gap-2">
						<Check className="size-4 text-cyan-300" /> Jemput pasukan anda
						bila-bila masa
					</li>
					<li className="flex items-center gap-2">
						<Check className="size-4 text-cyan-300" /> Tiada kad kredit
						diperlukan
					</li>
				</ul>
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
							<CardTitle className="text-xl text-slate-100">
								Cipta akaun
							</CardTitle>
						</CardHeader>
						<CardContent>
							<form
								className="space-y-4"
								onSubmit={async (event) => {
									event.preventDefault();
									setError("");
									const formData = new FormData(event.currentTarget);
									const result = await authClient.signUp.email({
										name: String(formData.get("name")),
										email: String(formData.get("email")),
										password: String(formData.get("password")),
									});
									if (result.error) {
										setError(
											result.error.message ?? "Pendaftaran tidak berjaya.",
										);
										return;
									}
									setSubmitted(true);
									navigate({ href: redirect });
								}}
							>
								<Field icon={<UserRound />} id="signup-name" label="Nama penuh">
									<Input
										className="pl-10"
										id="signup-name"
										name="name"
										placeholder="Contoh: Nur Aisyah"
										required
									/>
								</Field>
								<Field icon={<Mail />} id="signup-email" label="Alamat e-mel">
									<Input
										className="pl-10"
										id="signup-email"
										name="email"
										type="email"
										placeholder="anda@organisasi.my"
										required
									/>
								</Field>
								<Field
									icon={<LockKeyhole />}
									id="signup-password"
									label="Cipta kata laluan"
								>
									<Input
										className="pl-10"
										id="signup-password"
										name="password"
										type="password"
										placeholder="Sekurang-kurangnya 8 aksara"
										minLength={8}
										required
									/>
								</Field>
								<Label
									className="flex items-center gap-2 text-sm font-normal text-slate-400"
									htmlFor="terms"
								>
									<Checkbox id="terms" required />
									Saya bersetuju untuk mencipta akaun.
								</Label>
								<Button
									className="w-full bg-cyan-300 text-slate-950 hover:bg-cyan-200"
									type="submit"
								>
									Cipta akaun percuma <ArrowRight />
								</Button>
								<p className="text-center text-sm text-slate-400">
									Sudah ada akaun?{" "}
									<Link
										className="text-cyan-300 hover:underline"
										search={{ redirect }}
										to="/login"
									>
										Log masuk
									</Link>
								</p>
								{error && (
									<p className="rounded-md border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">
										{error}
									</p>
								)}
								{submitted && (
									<p className="rounded-md border border-cyan-400/25 bg-cyan-400/10 p-3 text-sm text-cyan-200">
										Akaun berjaya dicipta. Menghala ke dashboard anda…
									</p>
								)}
							</form>
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
