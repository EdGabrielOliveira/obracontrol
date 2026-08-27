import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
	MEASUREMENT_STATUS_TRANSITIONS,
	optionsForStatus,
} from "@/lib/status-transitions";
import type { MeasurementLifecycleStatus } from "@/types/measurements";

const options: Array<{ value: MeasurementLifecycleStatus; label: string }> = [
	{ value: "RASCUNHO", label: "Rascunho" },
	{ value: "ACEITO", label: "Aceito" },
	{ value: "RECUSADO", label: "Recusado" },
	{ value: "ARQUIVADO", label: "Arquivado" },
];

export function MeasurementStatusModal({
	open,
	onOpenChange,
	currentStatus,
	onSave,
	loading = false,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentStatus: MeasurementLifecycleStatus;
	onSave: (status: MeasurementLifecycleStatus, reason?: string) => void;
	loading?: boolean;
}) {
	const [status, setStatus] = useState(currentStatus);
	const [reason, setReason] = useState("");

	useEffect(() => {
		setStatus(currentStatus);
		setReason("");
	}, [currentStatus, open]);

	const requiresReason = status === "RECUSADO" || status === "ARQUIVADO";
	const currentLabel = useMemo(
		() => options.find((option) => option.value === currentStatus)?.label,
		[currentStatus],
	);
	const availableOptions = useMemo(
		() =>
			optionsForStatus(options, currentStatus, MEASUREMENT_STATUS_TRANSITIONS),
		[currentStatus],
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Alterar status da medição</DialogTitle>
					<DialogDescription>
						Status atual: <strong>{currentLabel}</strong>. Rascunhos não entram
						nos cálculos oficiais até serem aceitos.
					</DialogDescription>
				</DialogHeader>
				<label className="grid gap-2 text-sm font-medium">
					Novo status
					<select
						className="h-10 rounded-lg border border-input bg-background px-3"
						value={status}
						onChange={(event) =>
							setStatus(event.target.value as MeasurementLifecycleStatus)
						}
					>
						{availableOptions.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</label>
				{requiresReason ? (
					<div className="grid gap-2 text-sm font-medium">
						<span>Motivo obrigatório</span>
						<Textarea
							value={reason}
							onChange={(event) => setReason(event.target.value)}
							placeholder="Informe o motivo da recusa ou arquivamento"
						/>
					</div>
				) : null}
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancelar
					</Button>
					<Button
						disabled={requiresReason && !reason.trim()}
						loading={loading}
						onClick={() => onSave(status, reason.trim() || undefined)}
					>
						Salvar status
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
