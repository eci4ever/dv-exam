import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validatePasswordChange } from "@/lib/account-policy";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/reset-password")({
	validateSearch: (search: Record<string, unknown>) => ({
		token: typeof search.token === "string" ? search.token : undefined,
		error: typeof search.error === "string" ? search.error : undefined,
	}),
	component: ResetPassword,
});

function ResetPassword() {
	const { token, error: queryError } = Route.useSearch();
	const [password, setPassword] = useState("");
	const [confirmation, setConfirmation] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isPending, setIsPending] = useState(false);
	const tokenUnavailable = !token || Boolean(queryError);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!token) return;
		setError(null);
		let newPassword: string;
		try {
			newPassword = validatePasswordChange({ password, confirmation });
		} catch (validationError) {
			setError(
				validationError instanceof Error
					? validationError.message
					: "Invalid password.",
			);
			return;
		}
		setIsPending(true);
		const result = await authClient.resetPassword({ newPassword, token });
		setIsPending(false);
		if (result.error) {
			setError("This reset link is invalid or has expired. Request a new one.");
			return;
		}
		window.location.assign("/login?reset=success");
	}

	return (
		<AuthLayout
			title="Choose a new password"
			description="Use a strong password that you do not use elsewhere."
			footer={
				<Link className="font-medium underline underline-offset-4" to="/login">
					Back to sign in
				</Link>
			}
		>
			{tokenUnavailable ? (
				<div className="space-y-4">
					<p
						className="rounded-lg border bg-muted p-4 text-sm leading-6"
						role="alert"
					>
						This reset link is invalid or has expired.
					</p>
					<Button className="w-full" render={<Link to="/forgot-password" />}>
						Request a new reset link
					</Button>
				</div>
			) : (
				<form className="space-y-5" onSubmit={handleSubmit}>
					<div className="space-y-2">
						<label className="text-sm font-medium" htmlFor="new-password">
							New password
						</label>
						<Input
							id="new-password"
							type="password"
							autoComplete="new-password"
							value={password}
							onValueChange={setPassword}
							minLength={8}
							maxLength={128}
							required
						/>
						<p className="text-xs text-muted-foreground">8–128 characters</p>
					</div>
					<div className="space-y-2">
						<label className="text-sm font-medium" htmlFor="confirm-password">
							Confirm password
						</label>
						<Input
							id="confirm-password"
							type="password"
							autoComplete="new-password"
							value={confirmation}
							onValueChange={setConfirmation}
							minLength={8}
							maxLength={128}
							required
						/>
					</div>
					{error ? (
						<p className="text-sm text-destructive" role="alert">
							{error}
						</p>
					) : null}
					<Button className="h-10 w-full" type="submit" disabled={isPending}>
						{isPending ? "Resetting…" : "Reset password"}
					</Button>
				</form>
			)}
		</AuthLayout>
	);
}
