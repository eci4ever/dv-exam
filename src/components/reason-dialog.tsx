import { useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "#/components/ui/dialog";
import { Textarea } from "#/components/ui/textarea";

export function ReasonDialog({
	trigger,
	title,
	description,
	confirmLabel,
	onConfirm,
}: {
	trigger: React.ReactNode;
	title: string;
	description: string;
	confirmLabel: string;
	onConfirm: (reason: string) => Promise<void>;
}) {
	const [open, setOpen] = useState(false);
	const [reason, setReason] = useState("");
	const [saving, setSaving] = useState(false);
	async function confirm() {
		setSaving(true);
		try {
			await onConfirm(reason);
			setReason("");
			setOpen(false);
		} finally {
			setSaving(false);
		}
	}
	return (
		<Dialog onOpenChange={setOpen} open={open}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<Textarea
					minLength={3}
					onChange={(event) => setReason(event.target.value)}
					placeholder="State the reason for this action"
					value={reason}
				/>
				<DialogFooter>
					<Button
						disabled={saving || reason.trim().length < 3}
						onClick={confirm}
						type="button"
					>
						{saving ? "Saving…" : confirmLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
