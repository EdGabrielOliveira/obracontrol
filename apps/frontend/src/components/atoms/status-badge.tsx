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
	RECUSADO: { label: "Recusado", tone: "danger" },
	EM_RECOTACAO: { label: "Em recotação", tone: "warning" },
	EM_COTACAO: { label: "Em cotação", tone: "info" },
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
	RESTORE: { label: "Restauração", tone: "info" },
	REPROCESS: { label: "Reprocessamento", tone: "info" },
	EXPORT: { label: "Exportação", tone: "info" },
	QUOTATION_NEGOTIATED: { label: "Negociação de cotação", tone: "info" },
	QUOTATION_REQUOTED: { label: "Recotação", tone: "info" },
	CONTRACT_REQUEST_SELECTED: { label: "Proposta selecionada", tone: "warning" },
	CONTRACT_REQUEST_FINALIZED: { label: "Contrato finalizado", tone: "success" },
	APPROVAL_REVERSED: { label: "Aprovação revertida", tone: "warning" },
	CONTRACT_AMENDMENT_CREATED: { label: "Aditivo criado", tone: "info" },
	INSTRUMENT_GENERATED: { label: "Instrumento gerado", tone: "success" },
	INSTRUMENT_DOWNLOADED: { label: "Instrumento baixado", tone: "info" },
	COMMENT_CREATED: { label: "Comentário", tone: "info" },
	CONTRACT_REQUEST_NEGOTIATED: { label: "Negociação de solicitação", tone: "info" },
	QUOTATION_REVERTED: { label: "Cotação revertida", tone: "warning" },
	BUDGET_IMPACT_APPROVE: { label: "Impacto orçamentário aprovado", tone: "success" },
	BUDGET_VERSION_ACTIVATE: { label: "Versão de orçamento ativada", tone: "success" },
	CONTRACT_CREATE: { label: "Criação de contrato", tone: "success" },
	CONTRACT_DELETE: { label: "Exclusão de contrato", tone: "danger" },
	CONTRACT_MEASUREMENT_APPROVE: { label: "Medição de contrato aprovada", tone: "success" },
	CONTRACT_REQUEST_FINALIZE: { label: "Contrato finalizado", tone: "success" },
	CONTRACT_SUPPLIER_LINK: { label: "Fornecedor vinculado", tone: "info" },
	CONTRACT_UPDATE: { label: "Atualização de contrato", tone: "info" },
	COST_APPROVE: { label: "Custo aprovado", tone: "success" },
	IMPORT_CONFIRM: { label: "Importação confirmada", tone: "success" },
	PAYMENT_CONFIRM: { label: "Pagamento confirmado", tone: "success" },
	SCHEDULE_VERSION_ACTIVATE: { label: "Cronograma ativado", tone: "success" },
	WORK_DELETE: { label: "Exclusão de obra", tone: "danger" },
	WORK_MEASUREMENT_APPROVE: { label: "Medição aprovada", tone: "success" },
	REVERSE: { label: "Reversão", tone: "warning" },
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
