import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { getSession } from "@/lib/session";

export const Route = createFileRoute("/forgot-password")({
	beforeLoad: async () => {
		if (await getSession()) throw redirect({ to: "/dashboard" });
	},
	component: ForgotPassword,
});

function ForgotPassword() {
	const [email, setEmail] = useState("");
	const [sent, setSent] = useState(false);
	const [isPending, setIsPending] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsPending(true);
		await authClient.requestPasswordReset({
			email,
			redirectTo: `${window.location.origin}/reset-password`,
		});
		setIsPending(false);
		setSent(true);
	}

	return (
		<AuthLayout
			title="Reset your password"
			description="Enter your account email and we’ll send you a secure reset link."
			footer={
				<Link className="font-medium underline underline-offset-4" to="/login">
					Back to sign in
				</Link>
			}
		>
			{sent ? (
				<div className="space-y-4">
					<output className="block rounded-lg border bg-muted p-4 text-sm leading-6">
						If an account exists for that email, a password reset link is on its
						way. Check your inbox and spam folder.
					</output>
					<Button
						className="w-full"
						variant="outline"
						onClick={() => setSent(false)}
					>
						Send another link
					</Button>
				</div>
			) : (
				<form className="space-y-5" onSubmit={handleSubmit}>
					<div className="space-y-2">
						<label className="text-sm font-medium" htmlFor="reset-email">
							Email address
						</label>
						<Input
							id="reset-email"
							type="email"
							autoComplete="email"
							placeholder="you@example.com"
							value={email}
							onValueChange={setEmail}
							required
						/>
					</div>
					<Button className="h-10 w-full" type="submit" disabled={isPending}>
						{isPending ? "Sending…" : "Send reset link"}
					</Button>
				</form>
			)}
		</AuthLayout>
	);
}
