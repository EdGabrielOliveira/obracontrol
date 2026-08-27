import { useEffect, useMemo, useState } from "react";
import { CONTRACT_STATUS_MAP } from "@/components/atoms/status-badge";
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
	CONTRACT_STATUS_TRANSITIONS,
	optionsForStatus,
} from "@/lib/status-transitions";
import type { ContractStatus } from "@/types/contracts";

const options: Array<{ value: ContractStatus; label: string }> = [
	{ value: "RASCUNHO", label: "Rascunho" },
	{ value: "A_INICIAR", label: "A iniciar" },
	{ value: "EM_ANDAMENTO", label: "Em andamento" },
	{ value: "PARALISADO", label: "Paralisado" },
	{ value: "FINALIZADO", label: "Finalizado" },
	{ value: "ARQUIVADO", label: "Arquivado" },
];

export function ContractStatusModal({
	open,
	onOpenChange,
	currentStatus,
	onSave,
	loading = false,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentStatus: ContractStatus;
	onSave: (status: ContractStatus, reason?: string) => void;
	loading?: boolean;
}) {
	const [status, setStatus] = useState(currentStatus);
	const [reason, setReason] = useState("");

	useEffect(() => {
		setStatus(currentStatus);
		setReason("");
	}, [currentStatus, open]);

	const requiresReason = status === "PARALISADO" || status === "ARQUIVADO";
	const availableOptions = useMemo(
		() =>
			optionsForStatus(options, currentStatus, CONTRACT_STATUS_TRANSITIONS),
		[currentStatus],
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Alterar status do contrato</DialogTitle>
					<DialogDescription>
						Status atual:{" "}
						<strong>{CONTRACT_STATUS_MAP[currentStatus].label}</strong>.
					</DialogDescription>
				</DialogHeader>
				<label className="grid gap-2 text-sm font-medium">
					Novo status
					<select
						className="h-10 rounded-lg border border-input bg-background px-3"
						value={status}
						onChange={(event) =>
							setStatus(event.target.value as ContractStatus)
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
							placeholder="Informe o motivo da paralisação ou arquivamento"
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
