import { createFileRoute, redirect } from "@tanstack/react-router";
import { SaveIcon, Settings2Icon } from "lucide-react";
import { useState } from "react";

import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	getPlatformSettings,
	updatePlatformSettings,
} from "@/lib/platform-admin";
import { getDashboardSession } from "@/lib/session";

export const Route = createFileRoute("/admin/settings")({
	beforeLoad: async () => {
		const dashboard = await getDashboardSession();
		if (!dashboard) throw redirect({ to: "/login" });
		if (!dashboard.session.user.role?.split(",").includes("admin"))
			throw redirect({ to: "/dashboard" });
		return dashboard;
	},
	loader: () => getPlatformSettings(),
	component: SystemSettings,
});

function SystemSettings() {
	const context = Route.useRouteContext();
	const initial = Route.useLoaderData();
	const [signup, setSignup] = useState(initial.settings.publicSignupEnabled);
	const [defaultPlanId, setDefaultPlanId] = useState(
		initial.settings.defaultPlanId,
	);
	const [maintenance, setMaintenance] = useState(
		initial.settings.maintenanceEnabled,
	);
	const [message, setMessage] = useState(
		initial.settings.maintenanceMessage ?? "",
	);
	const [pending, setPending] = useState(false);
	const [feedback, setFeedback] = useState<string | null>(null);

	async function save() {
		setPending(true);
		setFeedback(null);
		try {
			await updatePlatformSettings({
				data: {
					publicSignupEnabled: signup,
					defaultPlanId,
					maintenanceEnabled: maintenance,
					maintenanceMessage: message,
				},
			});
			setFeedback("Settings saved.");
		} catch (error) {
			setFeedback(
				error instanceof Error ? error.message : "Unable to save settings.",
			);
		} finally {
			setPending(false);
		}
	}

	return (
		<PlatformAdminShell
			context={context}
			activeItem="admin-settings"
			title="System Settings"
		>
			<main className="flex flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
					<div className="flex items-start gap-3">
						<div className="flex size-10 items-center justify-center rounded-lg border bg-card">
							<Settings2Icon className="size-5" />
						</div>
						<div>
							<p className="text-sm text-muted-foreground">Platform Admin</p>
							<h1 className="text-2xl font-semibold tracking-tight">
								System settings
							</h1>
						</div>
					</div>
					<section className="rounded-xl border bg-card p-5 sm:p-6">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<h2 className="font-medium">Registration</h2>
								<p className="mt-1 text-sm text-muted-foreground">
									Control whether visitors can create their own account and
									workspace.
								</p>
							</div>
							<Button
								type="button"
								variant={signup ? "default" : "outline"}
								aria-pressed={signup}
								onClick={() => setSignup((value) => !value)}
							>
								{signup ? "Signup enabled" : "Signup disabled"}
							</Button>
						</div>
					</section>
					<section className="rounded-xl border bg-card p-5 sm:p-6">
						<h2 className="font-medium">Organization defaults</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							New personal workspaces receive this active plan.
						</p>
						<label
							htmlFor="maintenance-message"
							className="mt-4 block space-y-2 text-sm font-medium"
						>
							Default plan
							<select
								value={defaultPlanId}
								onChange={(event) => setDefaultPlanId(event.target.value)}
								className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								{initial.plans.map((plan) => (
									<option key={plan.id} value={plan.id}>
										{plan.name}
									</option>
								))}
							</select>
						</label>
					</section>
					<section className="rounded-xl border bg-card p-5 sm:p-6">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
							<div>
								<h2 className="font-medium">Maintenance notice</h2>
								<p className="mt-1 text-sm text-muted-foreground">
									Show an informational notice to authenticated users without
									locking the app.
								</p>
							</div>
							<Button
								type="button"
								variant={maintenance ? "default" : "outline"}
								aria-pressed={maintenance}
								onClick={() => setMaintenance((value) => !value)}
							>
								{maintenance ? "Notice enabled" : "Notice disabled"}
							</Button>
						</div>
						<label
							htmlFor="maintenance-message"
							className="mt-4 block space-y-2 text-sm font-medium"
						>
							Message
							<Input
								id="maintenance-message"
								value={message}
								onValueChange={setMessage}
								maxLength={240}
								placeholder="Scheduled maintenance begins at 10:00 PM."
							/>
						</label>
						<p className="mt-2 text-xs text-muted-foreground">
							{message.length}/240 characters
						</p>
					</section>
					<div className="flex items-center justify-end gap-3">
						{feedback ? <output className="text-sm">{feedback}</output> : null}
						<Button
							type="button"
							disabled={pending}
							onClick={() => void save()}
						>
							<SaveIcon />
							{pending ? "Saving…" : "Save settings"}
						</Button>
					</div>
				</div>
			</main>
		</PlatformAdminShell>
	);
}
