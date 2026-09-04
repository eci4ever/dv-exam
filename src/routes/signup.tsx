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
		<main className="auth-page signup-page">
			<section className="auth-aside">
				<Link className="auth-brand" to="/">
					<span>
						<GraduationCap />
					</span>
					Cakna<em>Exam</em>
				</Link>
				<div className="auth-aside-copy">
					<p className="kicker">— Mula dengan yakin</p>
					<h1>
						Pengurusan yang
						<br />
						<i>lebih mudah bermula di sini.</i>
					</h1>
					<p>
						Sertai warga pendidik yang memilih cara lebih kemas untuk mengurus
						setiap peperiksaan.
					</p>
				</div>
				<ul className="auth-benefits">
					<li>
						<Check /> Sediakan sesi peperiksaan dalam beberapa minit
					</li>
					<li>
						<Check /> Jemput pasukan anda bila-bila masa
					</li>
					<li>
						<Check /> Tiada kad kredit diperlukan
					</li>
				</ul>
			</section>
			<section className="auth-form-wrap">
				<Link className="back-link" to="/">
					<ArrowLeft /> Kembali ke laman utama
				</Link>
				<div className="auth-form signup-form">
					<p className="kicker">— Cipta akaun anda</p>
					<h2>Mari mula bersama</h2>
					<p className="auth-subtitle">
						Sudah mempunyai akaun?{" "}
						<Link search={{ redirect }} to="/login">
							Log masuk
						</Link>
					</p>
					<form
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
								setError(result.error.message ?? "Pendaftaran tidak berjaya.");
								return;
							}
							setSubmitted(true);
							navigate({ href: redirect });
						}}
					>
						<Label htmlFor="signup-name">
							Nama penuh
							<div className="input-wrap">
								<UserRound />
								<Input
									id="signup-name"
									name="name"
									placeholder="Contoh: Nur Aisyah"
									required
								/>
							</div>
						</Label>
						<Label htmlFor="signup-email">
							Alamat e-mel
							<div className="input-wrap">
								<Mail />
								<Input
									id="signup-email"
									name="email"
									type="email"
									placeholder="anda@sekolah.edu.my"
									required
								/>
							</div>
						</Label>
						<Label htmlFor="signup-password">
							Cipta kata laluan
							<div className="input-wrap">
								<LockKeyhole />
								<Input
									id="signup-password"
									name="password"
									type="password"
									placeholder="Sekurang-kurangnya 8 aksara"
									minLength={8}
									required
								/>
							</div>
						</Label>
						<div className="check terms">
							<Checkbox id="terms" required />
							<Label htmlFor="terms">
								<span>
									Saya bersetuju dengan <a href="#terma">Terma Penggunaan</a>{" "}
									dan <a href="#privasi">Dasar Privasi</a>.
								</span>
							</Label>
						</div>
						<Button className="auth-submit" type="submit">
							Cipta akaun percuma <ArrowRight />
						</Button>
						{error && <p className="auth-error">{error}</p>}
						{submitted && (
							<p className="mock-notice">
								Akaun berjaya dicipta. Menghala ke dashboard anda…
							</p>
						)}
					</form>
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
