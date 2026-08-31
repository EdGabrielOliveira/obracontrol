import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { updateWork } from "@/api/works";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { ConstructionItemStatus } from "@/types/shared";
import { getErrorMessage } from "@/utils/api-error";

const options: Array<{ value: ConstructionItemStatus; label: string }> = [
	{ value: "DRAFT", label: "Rascunho" },
	{ value: "NOT_STARTED", label: "Não iniciada" },
	{ value: "IN_PROGRESS", label: "Em andamento" },
	{ value: "SUSPENDED", label: "Suspensa" },
	{ value: "DONE", label: "Finalizada" },
	{ value: "IGNORED", label: "Arquivada" },
];

export function WorkOperationalStatusModal({
	open,
	onOpenChange,
	workId,
	currentStatus,
	onChanged,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	workId: string;
	currentStatus: ConstructionItemStatus | null | undefined;
	onChanged?: () => void;
}) {
	const [status, setStatus] = useState<ConstructionItemStatus>(
		currentStatus ?? "NOT_STARTED",
	);
	const [reason, setReason] = useState("");

	useEffect(() => {
		setStatus(currentStatus ?? "NOT_STARTED");
		setReason("");
	}, [currentStatus, open]);

	const mutation = useMutation({
		mutationFn: () =>
			updateWork(workId, {
				operationalStatus: status,
				statusReason: reason.trim() || undefined,
			}),
		onSuccess: () => {
			toast.success("Status operacional da obra atualizado.");
			onChanged?.();
			onOpenChange(false);
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Não foi possível alterar o status.")),
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Alterar status da obra</DialogTitle>
					<DialogDescription>
						Este é o status operacional da obra. Obras finalizadas ou arquivadas
						não entram nos gráficos operacionais do portfólio.
					</DialogDescription>
				</DialogHeader>
				<label className="grid gap-2 text-sm font-medium">
					Novo status
					<select
						className="h-10 rounded-lg border border-input bg-background px-3"
						value={status}
						onChange={(event) =>
							setStatus(event.target.value as ConstructionItemStatus)
						}
					>
						{options.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</label>
				{status === "SUSPENDED" || status === "IGNORED" ? (
					<label className="grid gap-2 text-sm font-medium">
						Motivo da alteração
						<textarea
							className="min-h-20 rounded-lg border border-input bg-background px-3 py-2"
							value={reason}
							onChange={(event) => setReason(event.target.value)}
							placeholder="Explique por que a obra será suspensa ou arquivada"
						/>
					</label>
				) : null}
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancelar
					</Button>
					<Button
						loading={mutation.isPending}
						disabled={
							(status === "SUSPENDED" || status === "IGNORED") && !reason.trim()
						}
						onClick={() => mutation.mutate()}
					>
						Salvar status
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
