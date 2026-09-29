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
import { getRegistrationStatus } from "@/lib/platform-admin";
import { getSession } from "@/lib/session";
import { getInvitationPreview } from "@/lib/workspace-invitations";

export const Route = createFileRoute("/signup")({
	validateSearch: (search: Record<string, unknown>) => {
		const result: { invitationId?: string } = {};
		if (typeof search.invitationId === "string")
			result.invitationId = search.invitationId;
		return result;
	},
	beforeLoad: async ({ search }) => {
		const session = await getSession();

		if (session) {
			throw redirect(
				search.invitationId
					? {
							to: "/invitations/$invitationId",
							params: { invitationId: search.invitationId },
						}
					: { to: "/dashboard" },
			);
		}
	},
	loaderDeps: ({ search }) => ({ invitationId: search.invitationId }),
	loader: async ({ deps }) => {
		const registration = await getRegistrationStatus();
		const invitation = deps.invitationId
			? await getInvitationPreview({
					data: { invitationId: deps.invitationId },
				})
			: null;
		return { registration, invitation };
	},
	component: Signup,
});

function Signup() {
	const { registration, invitation } = Route.useLoaderData();
	const search = Route.useSearch();
	const invitationSignup = invitation?.state === "pending";
	const navigate = useNavigate();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [organizationName, setOrganizationName] = useState("");
	const [organizationSlug, setOrganizationSlug] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isPending, setIsPending] = useState(false);
	const [createdUser, setCreatedUser] = useState<{
		id: string;
		name: string;
	} | null>(null);

	async function createWorkspace(user: { id: string; name: string }) {
		const result = await authClient.organization.create({
			name: organizationName.trim(),
			slug: organizationSlug.trim().toLowerCase(),
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

		const result = await authClient.signUp.email(
			{ name, email, password },
			search.invitationId
				? { headers: { "x-dv-exam-invitation": search.invitationId } }
				: undefined,
		);

		setIsPending(false);

		if (result.error || !result.data?.user) {
			setError(
				result.error?.message ??
					"Unable to create your account. Please try again.",
			);
			return;
		}

		if (search.invitationId) {
			await navigate({
				to: "/invitations/$invitationId",
				params: { invitationId: search.invitationId },
			});
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
			title={
				registration.enabled || invitationSignup
					? invitationSignup
						? "Create your account"
						: "Start your organization"
					: "Sign-ups are currently closed"
			}
			description={
				registration.enabled || invitationSignup
					? invitationSignup
						? `Create an account to join ${invitation.organizationName}.`
						: "Create the owner account and workspace for your organization."
					: "An administrator has temporarily disabled new registrations."
			}
			footer={
				<>
					Already have an account?{" "}
					<Link
						className="font-medium text-foreground underline underline-offset-4"
						to="/login"
						search={{ invitationId: search.invitationId }}
					>
						Sign in
					</Link>
				</>
			}
		>
			<form className="space-y-5" onSubmit={handleSubmit}>
				{!invitationSignup ? (
					<>
						<div className="space-y-2">
							<label
								className="text-sm font-medium"
								htmlFor="organization-name"
							>
								Organization name
							</label>
							<Input
								id="organization-name"
								name="organizationName"
								placeholder="Your organization"
								value={organizationName}
								onValueChange={(value) => {
									setOrganizationName(value);
									setOrganizationSlug(
										value
											.toLowerCase()
											.replace(/[^a-z0-9]+/g, "-")
											.replace(/^-+|-+$/g, ""),
									);
								}}
								required
							/>
						</div>
						<div className="space-y-2">
							<label
								className="text-sm font-medium"
								htmlFor="organization-slug"
							>
								Workspace slug
							</label>
							<Input
								id="organization-slug"
								name="organizationSlug"
								pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
								placeholder="your-organization"
								value={organizationSlug}
								onValueChange={(value) =>
									setOrganizationSlug(value.toLowerCase())
								}
								required
							/>
						</div>
						{registration.defaultPlan ? (
							<div className="rounded-lg border bg-muted/40 p-3 text-sm">
								<p className="font-medium">
									{registration.defaultPlan.name} plan
								</p>
								<p className="mt-1 text-muted-foreground">
									Your organization starts with{" "}
									{registration.defaultPlan.memberLimit} members,
									{registration.defaultPlan.activeExamLimit} active exams, and{" "}
									{registration.defaultPlan.monthlyAttemptLimit} monthly
									attempts.
								</p>
							</div>
						) : null}
					</>
				) : null}
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
					disabled={isPending || (!registration.enabled && !invitationSignup)}
					onClick={createdUser ? retryWorkspace : undefined}
				>
					{!registration.enabled && !invitationSignup
						? "Registration closed"
						: isPending
							? "Creating account…"
							: createdUser
								? "Set up workspace"
								: invitationSignup
									? "Create account"
									: "Create organization"}
				</Button>
			</form>
		</AuthLayout>
	);
}
