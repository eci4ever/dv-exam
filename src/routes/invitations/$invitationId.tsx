import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { AuthLayout } from "@/components/auth-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/session";
import {
	acceptWorkspaceInvitation,
	getInvitationPreview,
	rejectWorkspaceInvitation,
} from "@/lib/workspace-invitations";

export const Route = createFileRoute("/invitations/$invitationId")({
	beforeLoad: () => getSession(),
	loader: ({ params }) =>
		getInvitationPreview({ data: { invitationId: params.invitationId } }),
	component: InvitationPage,
});

function InvitationPage() {
	const session = Route.useRouteContext();
	const preview = Route.useLoaderData();
	const { invitationId } = Route.useParams();
	const navigate = useNavigate();
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [rejected, setRejected] = useState(false);
	const isPending = preview.state === "pending" && !rejected;
	const act = async (action: "accept" | "reject") => {
		setPending(true);
		setError(null);
		try {
			if (action === "accept") {
				await acceptWorkspaceInvitation({ data: { invitationId } });
				await navigate({ to: "/dashboard" });
			} else {
				await rejectWorkspaceInvitation({ data: { invitationId } });
				setRejected(true);
			}
		} catch (caught) {
			setError(
				caught instanceof Error
					? caught.message
					: "Unable to update this invitation.",
			);
		} finally {
			setPending(false);
		}
	};
	if (preview.state === "invalid")
		return (
			<AuthLayout
				title="Invitation unavailable"
				description="This invitation link is invalid or no longer available."
				footer={null}
			>
				<Button className="w-full" render={<Link to="/" />}>
					Return home
				</Button>
			</AuthLayout>
		);
	if (!isPending)
		return (
			<AuthLayout
				title="Invitation unavailable"
				description={`This invitation is ${rejected ? "rejected" : preview.state} and can no longer be used.`}
				footer={null}
			>
				<Button
					className="w-full"
					render={<Link to={session ? "/dashboard" : "/login"} />}
				>
					{session ? "Go to dashboard" : "Sign in"}
				</Button>
			</AuthLayout>
		);
	return (
		<AuthLayout
			title={`Join ${preview.organizationName}`}
			description="Review this workspace invitation before continuing."
			footer={null}
		>
			<div className="space-y-5">
				<div className="space-y-3 rounded-xl border p-4">
					<div className="flex items-center justify-between gap-4">
						<span className="text-sm text-muted-foreground">Role</span>
						<Badge variant="secondary">{preview.role}</Badge>
					</div>
					<div className="flex items-center justify-between gap-4">
						<span className="text-sm text-muted-foreground">Invited email</span>
						<span className="text-sm font-medium">{preview.maskedEmail}</span>
					</div>
					<p className="text-xs text-muted-foreground">
						Expires {new Date(preview.expiresAt).toLocaleString()}
					</p>
				</div>
				{error ? (
					<p className="text-sm text-destructive" role="alert">
						{error}
					</p>
				) : null}
				{session ? (
					<div className="grid gap-2 sm:grid-cols-2">
						<Button
							variant="outline"
							disabled={pending}
							onClick={() => void act("reject")}
						>
							Decline
						</Button>
						<Button disabled={pending} onClick={() => void act("accept")}>
							{pending ? "Working…" : "Accept invitation"}
						</Button>
					</div>
				) : (
					<div className="grid gap-2">
						<Button render={<Link to="/login" search={{ invitationId }} />}>
							Sign in to continue
						</Button>
						<Button
							variant="outline"
							render={<Link to="/signup" search={{ invitationId }} />}
						>
							Create an account
						</Button>
					</div>
				)}
			</div>
		</AuthLayout>
	);
}
