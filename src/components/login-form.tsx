import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { authClient } from "#/lib/auth-client";

export function LoginForm({ redirect }: { redirect: string }) {
	const navigate = useNavigate();
	const [error, setError] = useState("");
	const [submitting, setSubmitting] = useState(false);

	return (
		<Card>
			<CardHeader className="text-center">
				<CardTitle className="text-xl">Welcome back</CardTitle>
				<CardDescription>
					Sign in to continue to your workspace.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					onSubmit={async (event) => {
						event.preventDefault();
						setError("");
						setSubmitting(true);
						const formData = new FormData(event.currentTarget);
						const result = await authClient.signIn.email({
							email: String(formData.get("email")),
							password: String(formData.get("password")),
						});
						setSubmitting(false);
						if (result.error) {
							setError(result.error.message ?? "Unable to sign in.");
							return;
						}
						navigate({ href: redirect });
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="email">Email address</FieldLabel>
							<Input
								id="email"
								name="email"
								placeholder="you@organisation.com"
								required
								type="email"
							/>
						</Field>
						<Field>
							<div className="flex items-center">
								<FieldLabel htmlFor="password">Password</FieldLabel>
								<a
									className="ml-auto text-sm underline-offset-4 hover:underline"
									href="#lupa"
								>
									Forgot password?
								</a>
							</div>
							<Input id="password" name="password" required type="password" />
						</Field>
						<Field>
							<Button disabled={submitting} type="submit">
								{submitting ? "Signing in…" : "Sign in"}
							</Button>
							<FieldDescription className="text-center">
								Don't have an account?{" "}
								<Link search={{ redirect }} to="/signup">
									Sign up
								</Link>
							</FieldDescription>
						</Field>
						{error ? <p className="text-sm text-destructive">{error}</p> : null}
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
