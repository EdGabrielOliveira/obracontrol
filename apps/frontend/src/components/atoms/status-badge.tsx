import { Badge, type BadgeTone } from "@/components/ui/badge";

export type StatusTone = BadgeTone;

export type StatusMap = Record<
	string,
	{
		label: string;
		tone: StatusTone;
	}
>;

export const WORK_STATUS_MAP: StatusMap = {
	DRAFT: { label: "Rascunho", tone: "neutral" },
	NOT_STARTED: { label: "Não iniciado", tone: "neutral" },
	IN_PROGRESS: { label: "Em andamento", tone: "info" },
	DONE: { label: "Concluído", tone: "success" },
	SUSPENDED: { label: "Suspenso", tone: "danger" },
	IGNORED: { label: "Arquivado", tone: "neutral" },
};

export const CONTRACT_STATUS_MAP: StatusMap = {
	PENDENTE: { label: "Pendente", tone: "warning" },
	RASCUNHO: { label: "Rascunho", tone: "neutral" },
	A_INICIAR: { label: "A iniciar", tone: "warning" },
	EM_ANDAMENTO: { label: "Em andamento", tone: "info" },
	PARALISADO: { label: "Paralisado", tone: "danger" },
	FINALIZADO: { label: "Finalizado", tone: "success" },
	ARQUIVADO: { label: "Arquivado", tone: "neutral" },
	ATIVO: { label: "Ativo", tone: "success" },
	CONCLUIDO: { label: "Concluído", tone: "success" },
};

export const PAYMENT_STATUS_MAP: StatusMap = {
	EM_ABERTO: { label: "Em aberto", tone: "warning" },
	PAGO: { label: "Pago", tone: "success" },
	PAID: { label: "Pago", tone: "success" },
	OPEN: { label: "Em aberto", tone: "warning" },
};

export const SNAPSHOT_STATUS_MAP: StatusMap = {
	RASCUNHO: { label: "Rascunho", tone: "neutral" },
	EM_REVISAO: { label: "Em revisão", tone: "warning" },
	ACEITO: { label: "Aceito", tone: "success" },
	TRAVADO: { label: "Travado", tone: "danger" },
};

export const MEASUREMENT_STATUS_MAP: StatusMap = {
	RASCUNHO: { label: "Rascunho", tone: "neutral" },
	ACEITO: { label: "Aceito", tone: "success" },
	RECUSADO: { label: "Recusado", tone: "danger" },
	ARQUIVADO: { label: "Arquivado", tone: "neutral" },
};

export const GOVERNANCE_STATUS_MAP: StatusMap = {
	RASCUNHO: { label: "Rascunho", tone: "neutral" },
	EM_REVISAO: { label: "Em revisão", tone: "warning" },
	ACEITO: { label: "Aceito", tone: "success" },
	TRAVADO: { label: "Travado", tone: "danger" },
};

export const SUPPLIER_STATUS_MAP: StatusMap = {
	DRAFT: { label: "Rascunho", tone: "neutral" },
	PENDING_APPROVAL: { label: "Aguardando aprovação", tone: "warning" },
	APPROVED: { label: "Aprovado", tone: "success" },
	BLOCKED: { label: "Bloqueado", tone: "danger" },
};

export const WORK_SUPPLIER_STATUS_MAP: StatusMap = {
	PENDING_APPROVAL: { label: "Aguardando aprovação", tone: "warning" },
	ACTIVE: { label: "Ativo", tone: "success" },
	REVOKED: { label: "Revogado", tone: "danger" },
};

export const BUDGET_VERSION_STATUS_MAP: StatusMap = {
	DRAFT: { label: "Rascunho", tone: "neutral" },
	PENDING_APPROVAL: { label: "Em aprovação", tone: "warning" },
	ACTIVE: { label: "Atual", tone: "success" },
	SUPERSEDED: { label: "Substituída", tone: "neutral" },
	REJECTED: { label: "Recusado", tone: "danger" },
	ARCHIVED: { label: "Arquivado", tone: "neutral" },
};

export const APPROVAL_STATUS_MAP: StatusMap = {
	UNAVAILABLE: { label: "Status indisponível", tone: "neutral" },
	PENDING: { label: "Pendente", tone: "warning" },
	APPROVED: { label: "Aprovada", tone: "success" },
	REJECTED: { label: "Rejeitada", tone: "danger" },
	CONFLICTED: { label: "Conflitada", tone: "danger" },
	CANCELLED: { label: "Cancelada", tone: "danger" },
	EXECUTED: { label: "Executada", tone: "success" },
};

export const AMENDMENT_APPROVAL_STATUS_MAP: StatusMap = {
	PENDING_GESTOR: { label: "Aguardando gestor", tone: "warning" },
	PENDING_GERENTE: { label: "Aguardando gerente", tone: "warning" },
	APPROVED: { label: "Aprovado", tone: "success" },
	REJECTED: { label: "Rejeitado", tone: "danger" },
};

export const IMPORT_BATCH_STATUS_MAP: StatusMap = {
	PARSING: { label: "Analisando", tone: "info" },
	READY: { label: "Aguardando confirmação", tone: "warning" },
	PENDING_CONFIRM: { label: "Aguardando aprovação", tone: "warning" },
	CONFIRMED: { label: "Confirmada", tone: "success" },
	EXPIRED: { label: "Expirada", tone: "danger" },
	FAILED: { label: "Falhou", tone: "danger" },
	CANCELLED: { label: "Cancelada", tone: "danger" },
};

export const IMPORT_PREVIEW_STATUS_MAP: StatusMap = {
	VALID: { label: "Válida", tone: "success" },
	WARNING: { label: "Aviso", tone: "warning" },
	INVALID: { label: "Inválida", tone: "danger" },
	EXCLUDED: { label: "Excluída", tone: "danger" },
};

export const AUDIT_ACTION_STATUS_MAP: StatusMap = {
	CREATE: { label: "Criação", tone: "info" },
	UPDATE: { label: "Atualização", tone: "info" },
	STATUS_CHANGED: { label: "Alteração de status", tone: "warning" },
	DELETE: { label: "Exclusão", tone: "danger" },
	APPROVE: { label: "Aprovação", tone: "success" },
	REJECT: { label: "Rejeição", tone: "danger" },
	SUBMIT: { label: "Submissão", tone: "warning" },
};

const FALLBACK_STATUS_TONES: Record<string, StatusTone> = {
	APPROVED: "success",
	ACEITO: "success",
	ACTIVE: "success",
	ATIVO: "success",
	CONFIRMED: "success",
	CONCLUIDO: "success",
	DONE: "success",
	EXECUTED: "success",
	FINALIZADO: "success",
	PAID: "success",
	PAGO: "success",
	VALID: "success",
	POSITIVE: "success",
	POSITIVO: "success",
	GOOD: "success",
	BOM: "success",
	HEALTHY: "success",
	SAUDAVEL: "success",
	ERROR: "danger",
	ERRO: "danger",
	FAILED: "danger",
	FALHOU: "danger",
	INVALID: "danger",
	INVALIDO: "danger",
	INVALIDA: "danger",
	REJECTED: "danger",
	REJEITADO: "danger",
	REJEITADA: "danger",
	DELETED: "danger",
	DELETADO: "danger",
	DELETADA: "danger",
	DELETE: "danger",
	EXCLUDE: "danger",
	EXCLUDED: "danger",
	EXCLUIDO: "danger",
	EXCLUIDA: "danger",
	CANCELLED: "danger",
	CANCELADO: "danger",
	CANCELADA: "danger",
	BLOCKED: "danger",
	BLOQUEADO: "danger",
	BLOQUEADA: "danger",
	REVOKED: "danger",
	REVOGADO: "danger",
	REVOGADA: "danger",
	SUSPENDED: "danger",
	SUSPENSO: "danger",
	SUSPENSA: "danger",
	TRAVADO: "danger",
	NEGATIVE: "danger",
	NEGATIVO: "danger",
	BAD: "danger",
	RUIM: "danger",
	PENDING: "warning",
	PENDENTE: "warning",
	PENDING_APPROVAL: "warning",
	PENDING_CONFIRM: "warning",
	PENDING_GESTOR: "warning",
	PENDING_GERENTE: "warning",
	READY: "warning",
	OPEN: "warning",
	EM_ABERTO: "warning",
	AGUARDANDO: "warning",
	WARNING: "warning",
	WARN: "warning",
	ATTENTION: "warning",
	ATENCAO: "warning",
	IN_PROGRESS: "info",
	EM_ANDAMENTO: "info",
	PARSING: "info",
	PROCESSING: "info",
	ANALISANDO: "info",
};

type StatusValue = string | null | undefined;

export function getFallbackStatusTone(status: StatusValue): StatusTone {
	const normalized = (status ?? "")
		.trim()
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toUpperCase()
		.replace(/\s+/g, "_");
	return FALLBACK_STATUS_TONES[normalized] ?? "neutral";
}

interface StatusBadgeProps {
	status: StatusValue;
	map?: StatusMap;
}

export function StatusBadge({
	status,
	map = WORK_STATUS_MAP,
}: StatusBadgeProps) {
	const config = (status ? map[status] : undefined) ?? {
		label: status?.trim() || "Status indisponível",
		tone: getFallbackStatusTone(status),
	};
	return (
		<Badge variant="tag" tone={config.tone}>
			{config.label}
		</Badge>
	);
}
