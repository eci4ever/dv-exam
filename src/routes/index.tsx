import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, GraduationCap } from "lucide-react";
import { Button } from "#/components/ui/button";

export const Route = createFileRoute("/")({ component: Home });

function Brand() {
	return (
		<Link className="flex items-center gap-2 font-semibold" to="/">
			<span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
				<GraduationCap className="size-5" />
			</span>
			CaknaExam
		</Link>
	);
}

function Home() {
	return (
		<main className="min-h-svh overflow-hidden bg-gradient-to-b from-zinc-100 via-zinc-50 to-zinc-100 text-foreground">
			<header className="relative z-10 border-b bg-zinc-50/70 backdrop-blur">
				<div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
					<Brand />
					<div className="flex items-center gap-2">
						<Button asChild variant="ghost">
							<Link to="/login">Sign in</Link>
						</Button>
						<Button asChild>
							<Link to="/signup">Sign up</Link>
						</Button>
					</div>
				</div>
			</header>
			<section className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-6xl items-center px-4 py-16 sm:px-6">
				<div className="absolute -top-32 right-0 size-96 rounded-full bg-violet-300/35 blur-3xl" />
				<div className="absolute bottom-0 left-1/3 size-80 rounded-full bg-sky-200/40 blur-3xl" />
				<div className="relative max-w-2xl space-y-6">
					<p className="text-sm font-medium text-muted-foreground">
						Online Examination Management System
					</p>
					<h1 className="bg-gradient-to-r from-zinc-950 via-zinc-800 to-violet-700 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-6xl">
						Better organised examinations, from start to finish.
					</h1>
					<p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
						Manage sessions, candidates and results in one clear workspace for
						your organisation.
					</p>
					<Button asChild size="lg">
						<Link to="/signup">
							Get started <ArrowRight />
						</Link>
					</Button>
				</div>
			</section>
		</main>
	);
}
