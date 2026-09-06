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
import { Input } from "#/components/ui/input";
import { Textarea } from "#/components/ui/textarea";

export function ValueReasonDialog({
	trigger,
	title,
	description,
	label,
	defaultValue,
	placeholder,
	confirmLabel,
	onConfirm,
}: {
	trigger: React.ReactNode;
	title: string;
	description: string;
	label: string;
	defaultValue: string;
	placeholder: string;
	confirmLabel: string;
	onConfirm: (value: string, reason: string) => Promise<void>;
}) {
	const [open, setOpen] = useState(false);
	const [value, setValue] = useState(defaultValue);
	const [reason, setReason] = useState("");
	const [saving, setSaving] = useState(false);
	async function confirm() {
		setSaving(true);
		try {
			await onConfirm(value.trim(), reason.trim());
			setOpen(false);
			setReason("");
		} finally {
			setSaving(false);
		}
	}
	return (
		<Dialog
			onOpenChange={(next) => {
				setOpen(next);
				if (next) setValue(defaultValue);
			}}
			open={open}
		>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<label className="grid gap-2 text-sm font-medium">
					{label}
					<Input
						onChange={(event) => setValue(event.target.value)}
						placeholder={placeholder}
						value={value}
					/>
				</label>
				<Textarea
					minLength={3}
					onChange={(event) => setReason(event.target.value)}
					placeholder="State the reason for this action"
					value={reason}
				/>
				<DialogFooter>
					<Button
						disabled={saving || !value.trim() || reason.trim().length < 3}
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
