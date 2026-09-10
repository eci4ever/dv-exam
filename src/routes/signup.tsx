import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { useState } from "react";

import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { getSession } from "@/lib/session";

export const Route = createFileRoute("/signup")({
	beforeLoad: async () => {
		const session = await getSession();

		if (session) {
			throw redirect({ to: "/dashboard" });
		}
	},
	component: Signup,
});

function Signup() {
	const navigate = useNavigate();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isPending, setIsPending] = useState(false);
	const [createdUser, setCreatedUser] = useState<{
		id: string;
		name: string;
	} | null>(null);

	async function createWorkspace(user: { id: string; name: string }) {
		const firstName = user.name.trim().split(/\s+/)[0] || "My";
		const slugPrefix =
			firstName
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-+|-+$/g, "") || "my";
		const result = await authClient.organization.create({
			name: `${firstName}'s workspace`,
			slug: `${slugPrefix}-workspace-${user.id.toLowerCase()}`,
			keepCurrentActiveOrganization: false,
		});

		if (result.error) {
			setCreatedUser(user);
			setError(
				result.error.message ??
					"Your account was created, but we could not set up your workspace.",
			);
			return;
		}

		await navigate({ to: "/dashboard" });
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setIsPending(true);

		const result = await authClient.signUp.email({ name, email, password });

		setIsPending(false);

		if (result.error || !result.data?.user) {
			setError(
				result.error?.message ??
					"Unable to create your account. Please try again.",
			);
			return;
		}

		await createWorkspace(result.data.user);
	}

	async function retryWorkspace() {
		if (!createdUser) {
			return;
		}

		setError(null);
		setIsPending(true);
		await createWorkspace(createdUser);
		setIsPending(false);
	}

	return (
		<AuthLayout
			title="Create your account"
			description="Start organising your exams in one simple workspace."
			footer={
				<>
					Already have an account?{" "}
					<Link
						className="font-medium text-foreground underline underline-offset-4"
						to="/login"
					>
						Sign in
					</Link>
				</>
			}
		>
			<form className="space-y-5" onSubmit={handleSubmit}>
				<div className="space-y-2">
					<label className="text-sm font-medium" htmlFor="full-name">
						Full name
					</label>
					<Input
						id="full-name"
						name="name"
						type="text"
						autoComplete="name"
						placeholder="Your full name"
						value={name}
						onValueChange={setName}
						required
					/>
				</div>
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
					<label className="text-sm font-medium" htmlFor="password">
						Password
					</label>
					<Input
						id="password"
						name="password"
						type="password"
						autoComplete="new-password"
						placeholder="Create a password"
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
				<Button
					className="mt-1 h-10 w-full"
					type={createdUser ? "button" : "submit"}
					disabled={isPending}
					onClick={createdUser ? retryWorkspace : undefined}
				>
					{isPending
						? "Creating account…"
						: createdUser
							? "Set up workspace"
							: "Create account"}
				</Button>
			</form>
		</AuthLayout>
	);
}
