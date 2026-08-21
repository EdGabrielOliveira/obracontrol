import { Badge } from "@/components/ui/badge";

export type StatusMap = Record<
	string,
	{
		label: string;
		variant: "default" | "secondary" | "destructive" | "outline";
	}
>;

export const WORK_STATUS_MAP: StatusMap = {
	NOT_STARTED: { label: "Não iniciado", variant: "outline" },
	IN_PROGRESS: { label: "Em andamento", variant: "secondary" },
	DONE: { label: "Concluído", variant: "default" },
	SUSPENDED: { label: "Suspenso", variant: "destructive" },
	IGNORED: { label: "Ignorado", variant: "destructive" },
};

export const CONTRACT_STATUS_MAP: StatusMap = {
	PENDENTE: { label: "Pendente", variant: "secondary" },
	RASCUNHO: { label: "Rascunho", variant: "outline" },
	A_INICIAR: { label: "A iniciar", variant: "secondary" },
	EM_ANDAMENTO: { label: "Em andamento", variant: "default" },
	PARALISADO: { label: "Paralisado", variant: "destructive" },
	FINALIZADO: { label: "Finalizado", variant: "secondary" },
	ATIVO: { label: "Ativo", variant: "default" },
	CONCLUIDO: { label: "Concluído", variant: "secondary" },
};

export const PAYMENT_STATUS_MAP: StatusMap = {
	EM_ABERTO: { label: "Em aberto", variant: "outline" },
	PAGO: { label: "Pago", variant: "default" },
	PAID: { label: "Pago", variant: "default" },
	OPEN: { label: "Em aberto", variant: "outline" },
};

export const SNAPSHOT_STATUS_MAP: StatusMap = {
	RASCUNHO: { label: "Rascunho", variant: "outline" },
	EM_REVISAO: { label: "Em revisão", variant: "secondary" },
	ACEITO: { label: "Aceito", variant: "default" },
	TRAVADO: { label: "Travado", variant: "destructive" },
};

export const SUPPLIER_STATUS_MAP: StatusMap = {
	DRAFT: { label: "Rascunho", variant: "outline" },
	PENDING_APPROVAL: { label: "Aguardando aprovação", variant: "secondary" },
	APPROVED: { label: "Aprovado", variant: "default" },
	BLOCKED: { label: "Bloqueado", variant: "destructive" },
};

export const WORK_SUPPLIER_STATUS_MAP: StatusMap = {
	PENDING_APPROVAL: { label: "Aguardando aprovação", variant: "secondary" },
	ACTIVE: { label: "Ativo", variant: "default" },
	REVOKED: { label: "Revogado", variant: "destructive" },
};

export const BUDGET_VERSION_STATUS_MAP: StatusMap = {
	DRAFT: { label: "Rascunho", variant: "outline" },
	PENDING_APPROVAL: { label: "Em aprovação", variant: "secondary" },
	ACTIVE: { label: "Atual", variant: "default" },
	SUPERSEDED: { label: "Substituída", variant: "outline" },
	REJECTED: { label: "Recusado", variant: "destructive" },
};

interface StatusBadgeProps {
	status: string;
	map?: StatusMap;
}

export function StatusBadge({
	status,
	map = WORK_STATUS_MAP,
}: StatusBadgeProps) {
	const config = map[status] ?? { label: status, variant: "outline" as const };
	return <Badge variant={config.variant}>{config.label}</Badge>;
}
