import { ShieldAlert } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface OverrideFieldsProps {
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	noteValue: string;
	onNoteValueChange: (value: string) => void;
	noteLabel?: string;
	notePlaceholder?: string;
	disabled?: boolean;
	invalid?: boolean;
	error?: { message?: string };
}

export function OverrideFields({
	checked,
	onCheckedChange,
	noteValue,
	onNoteValueChange,
	noteLabel = "Evidência / motivo",
	notePlaceholder = "Descreva a evidência ou o motivo do override...",
	disabled,
	invalid,
	error,
}: OverrideFieldsProps) {
	return (
		<div className="space-y-2 rounded-lg border border-dashed p-3">
			<div className="flex items-center gap-2">
				<Checkbox
					id="balance-override"
					checked={checked}
					onCheckedChange={(value) => onCheckedChange(value === true)}
					disabled={disabled}
				/>
				<Label htmlFor="balance-override" className="font-medium">
					Acima do saldo (override)
				</Label>
				<ShieldAlert className="h-4 w-4 text-muted-foreground" />
			</div>
			<p className="text-xs text-muted-foreground">
				Somente ADMIN pode registrar medições ou pagamentos acima do saldo.
			</p>
			{checked && (
				<Field className="flex flex-col gap-1" data-invalid={invalid}>
					<FieldLabel>{noteLabel}</FieldLabel>
					<Textarea
						value={noteValue}
						onChange={(event) => onNoteValueChange(event.target.value)}
						placeholder={notePlaceholder}
						rows={2}
						maxLength={2000}
					/>
					{invalid && error && <FieldError errors={[error]} />}
				</Field>
			)}
		</div>
	);
}
