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
import { Checkbox } from "#/components/ui/checkbox";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { authClient } from "#/lib/auth-client";

export function SignupForm({ redirect }: { redirect: string }) {
	const navigate = useNavigate();
	const [error, setError] = useState("");
	const [submitting, setSubmitting] = useState(false);

	return (
		<Card>
			<CardHeader className="text-center">
				<CardTitle className="text-xl">Create your account</CardTitle>
				<CardDescription>
					Enter your details to start using CaknaExam.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					onSubmit={async (event) => {
						event.preventDefault();
						setError("");
						setSubmitting(true);
						const formData = new FormData(event.currentTarget);
						const result = await authClient.signUp.email({
							name: String(formData.get("name")),
							email: String(formData.get("email")),
							password: String(formData.get("password")),
						});
						setSubmitting(false);
						if (result.error) {
							setError(result.error.message ?? "Unable to create your account.");
							return;
						}
						navigate({ href: redirect });
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="name">Full name</FieldLabel>
							<Input
								id="name"
								name="name"
								placeholder="Example: Alex Morgan"
								required
							/>
						</Field>
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
							<FieldLabel htmlFor="password">Password</FieldLabel>
							<Input
								id="password"
								minLength={8}
								name="password"
								required
								type="password"
							/>
							<FieldDescription>
								Use at least 8 characters.
							</FieldDescription>
						</Field>
						<Field orientation="horizontal">
							<Checkbox id="account-confirmation" required />
							<FieldLabel htmlFor="account-confirmation">
								I agree to create an account.
							</FieldLabel>
						</Field>
						<Field>
							<Button disabled={submitting} type="submit">
								{submitting ? "Creating account…" : "Create account"}
							</Button>
							<FieldDescription className="text-center">
								Already have an account?{" "}
								<Link search={{ redirect }} to="/login">
									Sign in
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
