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
		<main className="min-h-svh">
			<header className="border-b">
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
			<section className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-6xl items-center px-4 py-16 sm:px-6">
				<div className="max-w-2xl space-y-6">
					<p className="text-sm font-medium text-muted-foreground">
						Online Examination Management System
					</p>
					<h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
						Better organised examinations, from start to finish.
					</h1>
					<p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
						Manage sessions, candidates and results in one clear workspace for your organisation.
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
