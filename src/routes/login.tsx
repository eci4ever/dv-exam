import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import { LoginForm } from "#/components/login-form";

export const Route = createFileRoute("/login")({
	validateSearch: (search: Record<string, unknown>) => ({
		redirect: sanitizeRedirect(search.redirect),
	}),
	component: LoginPage,
});

function LoginPage() {
	const { redirect } = Route.useSearch();

	return (
		<main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/30 p-6 md:p-10">
			<Link className="flex items-center gap-2 font-semibold" to="/">
				<span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
					<GraduationCap className="size-5" />
				</span>
				CaknaExam
			</Link>
			<div className="w-full max-w-sm">
				<LoginForm redirect={redirect} />
			</div>
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
