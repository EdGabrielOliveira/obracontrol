import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getGovernanceRecord, transitionGovernance } from "@/api/governance";
import {
	GOVERNANCE_STATUS_MAP,
	StatusBadge,
} from "@/components/atoms/status-badge";
import { Badge } from "@/components/ui/badge";
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
import { useAuth } from "@/lib/auth-context";
import {
	getGovernanceStatusOptions,
	governanceTransitionRequiresReason,
} from "@/lib/governance-status";
import type { GovernanceRecord, GovernanceStatus } from "@/types/governance";
import { getErrorMessage } from "@/utils/api-error";

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
	const { role } = useAuth();
	const [target, setTarget] = useState<GovernanceStatus>("RASCUNHO");
	const [reason, setReason] = useState("");
	const status = current?.status ?? "RASCUNHO";
	const options = useMemo(
		() => getGovernanceStatusOptions(status, role),
		[status, role],
	);
	const requiresReason = governanceTransitionRequiresReason(status, target);

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
						Status atual: <strong>{GOVERNANCE_STATUS_MAP[status].label}</strong>
						. A alteração é registrada em auditoria.
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
								{GOVERNANCE_STATUS_MAP[option].label}
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
			<StatusBadge
				status="ERROR"
				map={{ ERROR: { label: "Governança indisponível", tone: "danger" } }}
			/>
		);
	}
	if (loading && !record) {
		return (
			<StatusBadge
				status="LOADING"
				map={{ LOADING: { label: "Carregando governança…", tone: "neutral" } }}
			/>
		);
	}
	const status = record?.status ?? "RASCUNHO";
	const config = GOVERNANCE_STATUS_MAP[status];
	return (
		<Badge variant="tag" tone={config.tone}>
			Governança: {config.label}
		</Badge>
	);
}

export function governanceQueryOptions(entityType: string, entityId: string) {
	return {
		queryKey: ["governance", entityType, entityId],
		queryFn: () => getGovernanceRecord(entityType, entityId),
	};
}
