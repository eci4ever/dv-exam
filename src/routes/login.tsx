import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	ArrowRight,
	Eye,
	GraduationCap,
	LockKeyhole,
	Mail,
	ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
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
		<main className="auth-page">
			<section className="auth-aside">
				<Link className="auth-brand" to="/">
					<span>
						<GraduationCap />
					</span>
					Cakna<em>Exam</em>
				</Link>
				<div className="auth-aside-copy">
					<p className="kicker">— Ruang kerja pendidik</p>
					<h1>
						Setiap keputusan,
						<br />
						<i>lebih bermakna.</i>
					</h1>
					<p>
						Urus peperiksaan dan lihat perkembangan pelajar anda dalam satu
						tempat yang teratur.
					</p>
				</div>
				<div className="auth-proof">
					<span>
						<ShieldCheck />
					</span>
					<p>
						<b>Data anda dilindungi</b>
						<small>Keselamatan bertaraf industri</small>
					</p>
				</div>
			</section>
			<section className="auth-form-wrap">
				<Link className="back-link" to="/">
					<ArrowLeft /> Kembali ke laman utama
				</Link>
				<div className="auth-form">
					<p className="kicker">— Selamat kembali</p>
					<h2>Log masuk ke akaun anda</h2>
					<p className="auth-subtitle">
						Belum mempunyai akaun?{" "}
						<Link search={{ redirect }} to="/signup">
							Daftar secara percuma
						</Link>
					</p>
					<form
						onSubmit={async (event) => {
							event.preventDefault();
							setError("");
							const formData = new FormData(event.currentTarget);
							const result = await authClient.signIn.email({
								email: String(formData.get("email")),
								password: String(formData.get("password")),
							});
							if (result.error) {
								setError(result.error.message ?? "Log masuk tidak berjaya.");
								return;
							}
							setSubmitted(true);
							navigate({ href: redirect });
						}}
					>
						<Label htmlFor="login-email">
							Alamat e-mel
							<div className="input-wrap">
								<Mail />
								<Input
									id="login-email"
									name="email"
									type="email"
									placeholder="anda@sekolah.edu.my"
									required
								/>
							</div>
						</Label>
						<Label htmlFor="login-password">
							Kata laluan
							<div className="input-wrap">
								<LockKeyhole />
								<Input
									id="login-password"
									name="password"
									type="password"
									placeholder="Masukkan kata laluan"
									required
								/>
								<Eye />
							</div>
						</Label>
						<div className="form-options">
							<div className="check">
								<Checkbox id="remember-me" />
								<Label htmlFor="remember-me">Ingat saya</Label>
							</div>
							<a href="#lupa">Lupa kata laluan?</a>
						</div>
						<Button className="auth-submit" type="submit">
							Log masuk <ArrowRight />
						</Button>
						{error && <p className="auth-error">{error}</p>}
						{submitted && (
							<p className="mock-notice">
								Log masuk berjaya. Menghala ke dashboard anda…
							</p>
						)}
					</form>
					<div className="form-divider">
						<span>atau teruskan dengan</span>
					</div>
					<Button className="sso-button" type="button" variant="outline">
						<span className="google-mark">G</span> Google Workspace
					</Button>
				</div>
			</section>
		</main>
	);
}

function sanitizeRedirect(value: unknown) {
	return typeof value === "string" &&
		value.startsWith("/") &&
		!value.startsWith("//")
		? value
		: "/dashboard";
}
