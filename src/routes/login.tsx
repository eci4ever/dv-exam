import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { useState } from "react";

import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { getSession } from "@/lib/session";

export const Route = createFileRoute("/login")({
	beforeLoad: async () => {
		const session = await getSession();

		if (session) {
			throw redirect({ to: "/dashboard" });
		}
	},
	component: Login,
});

function Login() {
	const search = useSearch({ strict: false }) as { reset?: string };
	const navigate = useNavigate();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isPending, setIsPending] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setIsPending(true);

		const result = await authClient.signIn.email({ email, password });

		setIsPending(false);

		if (result.error) {
			setError(result.error.message ?? "Unable to sign in. Please try again.");
			return;
		}

		await navigate({ to: "/dashboard" });
	}

	return (
		<AuthLayout
			title="Welcome back"
			description="Sign in to access your DV-EXAM workspace."
			footer={
				<>
					New to DV-EXAM?{" "}
					<Link
						className="font-medium text-foreground underline underline-offset-4"
						to="/signup"
					>
						Create an account
					</Link>
				</>
			}
		>
			<form className="space-y-5" onSubmit={handleSubmit}>
				{search.reset === "success" ? (
					<output className="block rounded-lg border bg-muted p-3 text-sm">
						Your password has been reset. You can sign in now.
					</output>
				) : null}
				<div className="space-y-2">
					<label className="text-sm font-medium" htmlFor="email">
						Email address
					</label>
					<Input
						id="email"
						name="email"
						type="email"
						autoComplete="email"
						placeholder="you@example.com"
						value={email}
						onValueChange={setEmail}
						required
					/>
				</div>
				<div className="space-y-2">
					<div className="flex items-center justify-between gap-4">
						<label className="text-sm font-medium" htmlFor="password">
							Password
						</label>
						<Link
							className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
							to="/forgot-password"
						>
							Forgot password?
						</Link>
					</div>
					<Input
						id="password"
						name="password"
						type="password"
						autoComplete="current-password"
						placeholder="Enter your password"
						value={password}
						onValueChange={setPassword}
						required
					/>
				</div>
				{error ? (
					<p className="text-sm text-destructive" role="alert">
						{error}
					</p>
				) : null}
				<Button className="mt-1 h-10 w-full" type="submit" disabled={isPending}>
					{isPending ? "Signing in…" : "Sign in"}
				</Button>
			</form>
		</AuthLayout>
	);
}
