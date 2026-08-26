import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getGovernanceRecord, transitionGovernance } from "@/api/governance";
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
import type { GovernanceRecord, GovernanceStatus } from "@/types/governance";
import { getErrorMessage } from "@/utils/api-error";

const labels: Record<GovernanceStatus, string> = {
	RASCUNHO: "Rascunho",
	EM_REVISAO: "Em revisão",
	ACEITO: "Aceito",
	TRAVADO: "Travado",
};

const transitions: Record<GovernanceStatus, GovernanceStatus[]> = {
	RASCUNHO: ["EM_REVISAO"],
	EM_REVISAO: ["RASCUNHO", "ACEITO"],
	ACEITO: ["EM_REVISAO", "TRAVADO"],
	TRAVADO: ["EM_REVISAO"],
};

export function GovernanceStatusModal({
	open,
	onOpenChange,
	entityType,
	entityId,
	current,
	onChanged,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	entityType: string;
	entityId: string;
	current?: GovernanceRecord | null;
	onChanged?: (record: GovernanceRecord) => void;
}) {
	const queryClient = useQueryClient();
	const [target, setTarget] = useState<GovernanceStatus>("RASCUNHO");
	const [reason, setReason] = useState("");
	const status = current?.status ?? "RASCUNHO";
	const options = useMemo(() => transitions[status], [status]);
	const requiresReason =
		(status === "ACEITO" || status === "TRAVADO") && target === "EM_REVISAO";

	useEffect(() => {
		setTarget(options[0] ?? status);
		setReason("");
	}, [status, options]);

	const mutation = useMutation({
		mutationFn: () =>
			transitionGovernance(entityType, entityId, {
				toStatus: target,
				reason: reason.trim() || undefined,
			}),
		onSuccess: (record) => {
			queryClient.setQueryData(["governance", entityType, entityId], record);
			toast.success("Status de governança atualizado");
			onChanged?.(record);
			onOpenChange(false);
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Não foi possível alterar o status")),
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Alterar status de governança</DialogTitle>
					<DialogDescription>
						Status atual: <strong>{labels[status]}</strong>. A alteração é
						registrada em auditoria.
					</DialogDescription>
				</DialogHeader>
				<label className="grid gap-2 text-sm font-medium">
					Novo status
					<select
						className="h-10 rounded-lg border border-input bg-background px-3"
						value={target}
						onChange={(event) =>
							setTarget(event.target.value as GovernanceStatus)
						}
					>
						{options.map((option) => (
							<option key={option} value={option}>
								{labels[option]}
							</option>
						))}
					</select>
				</label>
				{requiresReason && (
					<div className="grid gap-2 text-sm font-medium">
						<span>Motivo da reabertura</span>
						<Textarea
							value={reason}
							onChange={(event) => setReason(event.target.value)}
							placeholder="Informe o motivo"
						/>
					</div>
				)}
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancelar
					</Button>
					<Button
						disabled={!target || (requiresReason && !reason.trim())}
						loading={mutation.isPending}
						onClick={() => mutation.mutate()}
					>
						Salvar status
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function GovernanceStatusBadge({
	record,
	loading = false,
	error = false,
}: {
	record?: GovernanceRecord | null;
	loading?: boolean;
	error?: boolean;
}) {
	if (error) {
		return (
			<span className="rounded-full border border-destructive/40 px-2 py-1 text-xs font-medium text-destructive">
				Governança indisponível
			</span>
		);
	}
	if (loading && !record) {
		return (
			<span className="rounded-full border px-2 py-1 text-xs font-medium text-muted-foreground">
				Carregando governança…
			</span>
		);
	}
	const status = record?.status ?? "RASCUNHO";
	return (
		<span className="rounded-full border px-2 py-1 text-xs font-medium">
			Governança: {labels[status]}
		</span>
	);
}

export function governanceQueryOptions(entityType: string, entityId: string) {
	return {
		queryKey: ["governance", entityType, entityId],
		queryFn: () => getGovernanceRecord(entityType, entityId),
	};
}
