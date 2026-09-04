import { createFileRoute } from "@tanstack/react-router";
import {
	ArrowRight,
	BarChart3,
	BookOpen,
	CalendarDays,
	Check,
	CheckCircle2,
	ClipboardCheck,
	Clock3,
	FileText,
	GraduationCap,
	LayoutDashboard,
	Menu,
	ShieldCheck,
	Sparkles,
	Users,
} from "lucide-react";

export const Route = createFileRoute("/")({ component: Home });

const features = [
	[
		CalendarDays,
		"Jadual tanpa konflik",
		"Susun tarikh, masa dan dewan dengan pengesanan pertindihan secara automatik.",
	],
	[
		ClipboardCheck,
		"Urus markah dengan tepat",
		"Rekod, semak dan sahkan markah dalam satu aliran kerja yang jelas.",
	],
	[
		BarChart3,
		"Analisis yang bermakna",
		"Kenal pasti trend prestasi dan bantu setiap pelajar mencapai potensi terbaik.",
	],
] as const;

function Brand() {
	return (
		<a className="brand" href="#utama">
			<span>
				<GraduationCap />
			</span>
			Cakna<em>Exam</em>
		</a>
	);
}

function Home() {
	return (
		<main className="marketing-page">
			<header>
				<div className="container nav">
					<Brand />
					<nav>
						<a href="#kelebihan">Kelebihan</a>
						<a href="#cara">Cara Kerja</a>
						<a href="#tentang">Tentang Kami</a>
					</nav>
					<div className="nav-cta">
						<a href="/login">Log masuk</a>
						<a className="btn white" href="/signup">
							Mula sekarang <ArrowRight />
						</a>
					</div>
					<button type="button" aria-label="Buka menu">
						<Menu />
					</button>
				</div>
			</header>

			<section className="hero" id="utama">
				<div className="container hero-grid">
					<div className="hero-copy">
						<p className="kicker">— Pengurusan peperiksaan, dipermudah</p>
						<h1>
							Peperiksaan terurus.
							<br />
							<i>Potensi terserlah.</i>
						</h1>
						<p className="lead">
							Satu platform pintar untuk merancang peperiksaan, mengurus markah
							dan memahami prestasi pelajar—dari mula hingga selesai.
						</p>
						<div className="actions">
							<a className="btn gold" href="/signup">
								Cuba secara percuma <ArrowRight />
							</a>
							<a href="#cara">Lihat cara ia berfungsi →</a>
						</div>
						<div className="trusted">
							<span>NH</span>
							<span>RA</span>
							<span>MF</span>
							<p>
								<b>Dipercayai warga pendidik</b>
								<br />
								untuk keputusan yang lebih baik.
							</p>
						</div>
					</div>
					<div className="visual">
						<div className="dashboard">
							<aside>
								<GraduationCap />
								<LayoutDashboard />
								<CalendarDays />
								<FileText />
								<BarChart3 />
							</aside>
							<div className="dash-main">
								<div className="dash-title">
									<small>SELAMAT DATANG, CIKGU</small>
									<h3>Ringkasan Peperiksaan</h3>
								</div>
								<div className="metrics">
									<article>
										<Users />
										<small>JUMLAH CALON</small>
										<b>1,284</b>
									</article>
									<article>
										<BookOpen />
										<small>MATA PELAJARAN</small>
										<b>18</b>
									</article>
									<article>
										<CheckCircle2 />
										<small>SELESAI DINILAI</small>
										<b>76%</b>
									</article>
								</div>
								<div className="charts">
									<article>
										<small>PRESTASI KESELURUHAN</small>
										<b>Purata mengikut subjek</b>
										<div className="bars">
											{[62, 78, 55, 88, 71, 82].map((h, i) => (
												<span key={h} style={{ height: `${h}%` }}>
													<i>{["BM", "BI", "MT", "SN", "SJ", "PI"][i]}</i>
												</span>
											))}
										</div>
									</article>
									<article className="schedule">
										<small>AKAN DATANG</small>
										<b>Jadual hari ini</b>
										<p>
											<time>08:00</time> Matematik
										</p>
										<p>
											<time>10:30</time> Bahasa Melayu
										</p>
										<p>
											<time>02:00</time> Sains
										</p>
									</article>
								</div>
							</div>
						</div>
						<div className="float">
							<Sparkles /> Prestasi meningkat 12%
						</div>
						<div className="safe">
							<ShieldCheck /> Data dilindungi
						</div>
					</div>
				</div>
				<div className="container audience">
					<p>Direka untuk setiap warga pendidikan</p>
					<div>
						<span>
							<GraduationCap /> Sekolah
						</span>
						<span>
							<BookOpen /> Guru
						</span>
						<span>
							<Users /> Pelajar
						</span>
						<span>
							<ShieldCheck /> Pentadbir
						</span>
					</div>
				</div>
			</section>

			<section className="section features" id="kelebihan">
				<div className="container">
					<div className="section-title">
						<p className="kicker">— Semuanya di satu tempat</p>
						<h2>
							Lebih teratur. Lebih yakin.
							<br />
							<i>Lebih banyak masa untuk mendidik.</i>
						</h2>
						<p>
							Kurangkan kerja pentadbiran yang berulang dan fokus pada perkara
							yang paling penting—perkembangan pelajar.
						</p>
					</div>
					<div className="feature-grid">
						{features.map(([Icon, title, text], i) => (
							<article key={title}>
								<em>0{i + 1}</em>
								<span className="round">
									<Icon />
								</span>
								<h3>{title}</h3>
								<p>{text}</p>
								<a href="#mula">Ketahui lebih lanjut →</a>
							</article>
						))}
					</div>
				</div>
			</section>

			<section className="section workflow" id="cara">
				<div className="container workflow-grid">
					<div className="report">
						<div className="paper">
							<b>
								<GraduationCap /> CAKNA EXAM
							</b>
							<small>LAPORAN RINGKASAN PRESTASI</small>
							<h3>Peperiksaan Akhir Tahun</h3>
							{[
								["Bahasa Melayu", "86 A"],
								["Matematik", "92 A+"],
								["Sains", "78 B+"],
							].map((x) => (
								<p key={x[0]}>
									<span>{x[0]}</span>
									<b>{x[1]}</b>
								</p>
							))}
							<div>
								<span>Purata keseluruhan</span>
								<strong>85.3%</strong>
							</div>
						</div>
						<span className="badge">
							<Check />
							Siap dalam
							<br />
							<b>3 langkah</b>
						</span>
					</div>
					<div>
						<p className="kicker">— Ringkas dari awal hingga akhir</p>
						<h2>
							Tiga langkah.
							<br />
							<i>Satu aliran yang lancar.</i>
						</h2>
						<p className="intro">
							Tiada lagi helaian berselerak atau proses mengelirukan. Semuanya
							disatukan dalam satu ruang kerja intuitif.
						</p>
						<ol>
							{[
								[
									"Daftar & tetapkan sesi",
									"Wujudkan sesi, kelas dan mata pelajaran dalam beberapa minit.",
								],
								[
									"Jadual & laksanakan",
									"Agihkan dewan, pengawas dan calon tanpa pertindihan.",
								],
								[
									"Nilai & laporkan",
									"Masukkan markah, jana analisis dan edarkan keputusan.",
								],
							].map((x, i) => (
								<li key={x[0]}>
									<span>{i + 1}</span>
									<div>
										<h3>{x[0]}</h3>
										<p>{x[1]}</p>
									</div>
								</li>
							))}
						</ol>
					</div>
				</div>
			</section>

			<section className="section impact" id="tentang">
				<div className="container impact-grid">
					<div>
						<p className="kicker">— Impak yang boleh diukur</p>
						<h2>
							Dibina untuk membantu
							<br />
							<i>sekolah berkembang.</i>
						</h2>
						<p>
							Apabila data menjadi jelas dan proses menjadi mudah, seluruh
							komuniti sekolah bergerak ke hadapan bersama.
						</p>
						<blockquote>
							“Cakna Exam mengubah cara kami mengurus peperiksaan. Proses
							beberapa hari kini selesai dalam beberapa jam.”
							<b>
								Pn. Azlina Zakaria <small>Penolong Kanan Pentadbiran</small>
							</b>
						</blockquote>
					</div>
					<div className="stats">
						{[
							["70%", "kurang masa pentadbiran"],
							["99.9%", "ketepatan pengiraan markah"],
							["3×", "lebih pantas jana laporan"],
							["24/7", "akses selamat dari mana-mana"],
						].map((x) => (
							<article key={x[0]}>
								<b>{x[0]}</b>
								<p>{x[1]}</p>
							</article>
						))}
					</div>
				</div>
			</section>

			<section className="cta" id="mula">
				<div className="container cta-box">
					<div>
						<p className="kicker">— Mulakan hari ini</p>
						<h2>
							Bersedia untuk peperiksaan
							<br />
							<i>yang lebih terurus?</i>
						</h2>
						<p>
							Sertai warga pendidik yang memilih cara lebih mudah, pantas dan
							selamat.
						</p>
						<a className="btn gold" href="/signup">
							Mulakan secara percuma <ArrowRight />
						</a>
					</div>
					<aside>
						<p>
							<Clock3 />
							<span>
								<b>Persediaan pantas</b>
								<small>Siap dalam beberapa minit</small>
							</span>
						</p>
						<p>
							<ShieldCheck />
							<span>
								<b>Data anda selamat</b>
								<small>Perlindungan bertaraf industri</small>
							</span>
						</p>
						<p>
							<Users />
							<span>
								<b>Sokongan tempatan</b>
								<small>Kami sedia membantu</small>
							</span>
						</p>
					</aside>
				</div>
			</section>
			<footer id="login">
				<div className="container">
					<Brand />
					<p>
						Pengurusan peperiksaan lebih bijak untuk pendidikan yang lebih
						bermakna.
					</p>
					<span>© 2025 Cakna Exam. Hak cipta terpelihara.</span>
				</div>
			</footer>
		</main>
	);
}
