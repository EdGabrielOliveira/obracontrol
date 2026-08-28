import type {
	AuditAction,
	AuditEntityType,
	DomainAuditAction,
} from "@/types/audit";
import { formatDateTime } from "@/utils/format";

export type AuditActionMeta = {
	label: string;
	description: string;
	severity: "info" | "success" | "warning" | "danger";
};

export type AuditEntityMeta = {
	label: string;
	description: string;
};

export const AUDIT_ACTION_LABELS: Record<
	AuditAction | DomainAuditAction,
	AuditActionMeta
> = {
	CREATE: {
		label: "Criação",
		description: "Registro criado",
		severity: "success",
	},
	UPDATE: {
		label: "Atualização",
		description: "Registro alterado",
		severity: "info",
	},
	STATUS_CHANGED: {
		label: "Alteração de status",
		description: "Status alterado",
		severity: "warning",
	},
	DELETE: {
		label: "Exclusão",
		description: "Registro excluído",
		severity: "danger",
	},
	APPROVE: {
		label: "Aprovação",
		description: "Solicitação aprovada",
		severity: "success",
	},
	REJECT: {
		label: "Rejeição",
		description: "Solicitação rejeitada",
		severity: "warning",
	},
	REPROCESS: {
		label: "Reprocessamento",
		description: "Dados reprocessados",
		severity: "info",
	},
	EXPORT: {
		label: "Exportação",
		description: "Dados exportados",
		severity: "info",
	},
	SUBMIT: {
		label: "Submissão",
		description: "Submetido para revisão",
		severity: "info",
	},
	RESTORE: {
		label: "Restauração",
		description: "Dados restaurados",
		severity: "info",
	},
	QUOTATION_NEGOTIATED: {
		label: "Negociação de cotação",
		description: "Valor de proposta negociado",
		severity: "info",
	},
	QUOTATION_REQUOTED: {
		label: "Recotação",
		description: "Nova rodada de cotação aberta",
		severity: "info",
	},
	CONTRACT_REQUEST_SELECTED: {
		label: "Proposta selecionada",
		description: "Seleção enviada para aprovação",
		severity: "warning",
	},
	CONTRACT_REQUEST_FINALIZED: {
		label: "Contrato finalizado",
		description: "Aprovação final criou o contrato",
		severity: "success",
	},
	APPROVAL_REVERSED: {
		label: "Aprovação revertida",
		description: "Reversão compensatória registrada",
		severity: "warning",
	},
	CONTRACT_AMENDMENT_CREATED: {
		label: "Aditivo criado",
		description: "Aditivo contratual registrado",
		severity: "info",
	},
	INSTRUMENT_GENERATED: {
		label: "Instrumento gerado",
		description: "Documento DOCX versionado gerado",
		severity: "success",
	},
	INSTRUMENT_DOWNLOADED: {
		label: "Instrumento baixado",
		description: "PDF do contrato baixado",
		severity: "info",
	},
	COMMENT_CREATED: {
		label: "Comentário",
		description: "Comentário append-only registrado",
		severity: "info",
	},
};

const AUDIT_FIELD_LABELS: Record<string, string> = {
	name: "Nome",
	code: "Código",
	description: "Descrição",
	status: "Status",
	operationalStatus: "Status operacional",
	statusReason: "Motivo do status",
	amount: "Valor",
	quantity: "Quantidade",
	unitPrice: "Preço unitário",
	date: "Data",
	startDate: "Data de início",
	endDate: "Data de término",
	plannedStart: "Início planejado",
	plannedEnd: "Término planejado",
	responsibleName: "Responsável",
	version: "Versão",
	filename: "Arquivo",
	reason: "Motivo",
};

const AUDIT_STATUS_LABELS: Record<string, string> = {
	DRAFT: "Rascunho",
	PENDING: "Pendente",
	APPROVED: "Aprovado",
	REJECTED: "Rejeitado",
	ACTIVE: "Ativo",
	IN_PROGRESS: "Em andamento",
	DONE: "Concluído",
	SUSPENDED: "Suspenso",
	ACEITO: "Aceito",
	RECUSADO: "Recusado",
	FINALIZADO: "Finalizado",
	EM_ANDAMENTO: "Em andamento",
	EM_ABERTO: "Em aberto",
	PAGO: "Pago",
};

const TECHNICAL_AUDIT_FIELD_PATTERN =
	/^(id|ids|ownerId|userId|workspaceId|companyId|organizationId|costCenterId|workId|contractId|requestId|artifactId|storageKey|sha256|templateSha256)$/i;
const TECHNICAL_CAMEL_ID_PATTERN = /[A-Z]Id$/;

export function isTechnicalAuditField(field: string): boolean {
	return TECHNICAL_AUDIT_FIELD_PATTERN.test(field) || TECHNICAL_CAMEL_ID_PATTERN.test(field);
}

export function auditFieldLabel(field: string): string {
	if (AUDIT_FIELD_LABELS[field]) return AUDIT_FIELD_LABELS[field];
	return field
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/[_-]+/g, " ")
		.replace(/^./, (character) => character.toUpperCase());
}

export function formatAuditValue(value: unknown, field?: string): string {
	if (value == null) return "Não informado";
	if (field && /status/i.test(field) && typeof value === "string") {
		return AUDIT_STATUS_LABELS[value] ?? value;
	}
	if (
		typeof value === "string" &&
		field &&
		/(date|at)$/i.test(field) &&
		!Number.isNaN(new Date(value).getTime())
	) {
		return formatDateTime(value);
	}
	if (typeof value === "boolean") return value ? "Sim" : "Não";
	if (typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>).filter(
			([key]) => !isTechnicalAuditField(key),
		);
		if (entries.length === 0) return "Informação técnica não exibida";
		return entries
			.map(
				([key, nestedValue]) =>
					`${auditFieldLabel(key)}: ${formatAuditValue(nestedValue, key)}`,
			)
			.join("; ");
	}
	return String(value);
}

const INTERNAL_DESCRIPTION_LABELS: Record<string, string> = {
	CONTRACT_UPDATE: "Atualização de contrato solicitada",
	IMPORT_CONFIRM: "Confirmação de importação solicitada",
	COST_APPROVE: "Aprovação de custo solicitada",
	BUDGET_VERSION_ACTIVATE: "Ativação de versão do orçamento solicitada",
};

export function auditDescription(
	description: string | null | undefined,
	action?: string,
): string {
	if (!description) return "Não informado";
	const trimmed = description.trim();
	const internalCode = /^([A-Z][A-Z_]+):[^:]+$/i.exec(trimmed);
	if (internalCode) {
		return (
			INTERNAL_DESCRIPTION_LABELS[internalCode[1].toUpperCase()] ??
				"Solicitação interna registrada"
		);
	}
	if (action === "EXPORT" && /^[^:]+:medicoes$/i.test(trimmed)) {
		return "Exportação de medições";
	}
	const cleaned = trimmed
		.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "")
		.replace(/\b[a-z][a-z0-9]{19,}\b/gi, "")
		.replace(/\s{2,}/g, " ")
		.replace(/\s+([,:;)])/g, "$1")
		.trim();
	return cleaned || "Evento registrado";
}

export function auditUserName(entry: {
	user?: { name?: string | null; email?: string | null } | null;
}): string {
	return entry.user?.name || entry.user?.email || "Usuário não identificado";
}

export const AUDIT_ENTITY_LABELS: Record<AuditEntityType, AuditEntityMeta> = {
	WORK: { label: "Obra", description: "Cadastro e alterações da obra" },
	BUDGET_ITEM: {
		label: "Item de Orçamento",
		description: "Itens do orçamento da obra",
	},
	ACTUAL_COST: {
		label: "Custo Real",
		description: "Custos realizados da obra",
	},
	CONSTRUCTION_MEASUREMENT: {
		label: "Medição (Obra)",
		description: "Medições importadas da planilha",
	},
	SCHEDULE_REVISION: {
		label: "Revisão de Cronograma",
		description: "Revisões do cronograma da obra",
	},
	WORK_MEASUREMENT: {
		label: "Medição de Obra",
		description: "Medições manuais da obra",
	},
	CONSTRUCTION_IMPORT: {
		label: "Importação",
		description: "Importações de planilhas",
	},
	CONTRACT: { label: "Contrato", description: "Contratos da obra" },
	CONTRACT_AMENDMENT: {
		label: "Aditivo de Contrato",
		description: "Aditivos de contratos",
	},
	CONTRACT_MEASUREMENT: {
		label: "Medição de Contrato",
		description: "Medições vinculadas ao contrato",
	},
	CONTRACT_PAYMENT: {
		label: "Pagamento de Contrato",
		description: "Pagamentos vinculados ao contrato",
	},
	BI_SNAPSHOT: {
		label: "Snapshot de BI",
		description: "Fotografias de métricas persistidas",
	},
	BI_SNAPSHOT_SCOPE: {
		label: "Modo de Fonte do BI",
		description: "Alternância entre fonte ao vivo e persistida",
	},
	EXPORT: {
		label: "Exportação",
		description: "Exportações de relatórios e dados",
	},
	APPROVAL_REQUEST: {
		label: "Solicitação de Aprovação",
		description: "Decisões sobre solicitações de aprovação",
	},
	GOVERNANCE_RECORD: {
		label: "Registro de Governança",
		description: "Transições de estado de governança",
	},
	ORGANIZATION: {
		label: "Organização",
		description: "Cadastro e exclusão de organizações",
	},
	COST_CENTER: {
		label: "Centro de Custo",
		description: "Cadastro e exclusão de centros de custo",
	},
	WORK_MEMBERSHIP: {
		label: "Vínculo de Usuário",
		description: "Vínculos de usuário à obra",
	},
	CONTRACT_REQUEST_PROPOSAL: {
		label: "Proposta de contrato",
		description: "Propostas recebidas para contratos",
	},
	CONTRACT_SERVICE: {
		label: "Serviço de contrato",
		description: "Serviços vinculados a contratos",
	},
	QUOTATION_PROPOSAL: {
		label: "Proposta de cotação",
		description: "Propostas de fornecedores",
	},
	QUOTATION: {
		label: "Cotação",
		description: "Cotações de fornecedores",
	},
	SUPPLIER: {
		label: "Fornecedor",
		description: "Cadastro de fornecedores",
	},
	SCHEDULE_BASELINE: {
		label: "Cronograma base",
		description: "Cronograma original da obra",
	},
	USER_SCOPE: {
		label: "Escopo de usuário",
		description: "Permissões e escopos de usuários",
	},
	USER: {
		label: "Usuário",
		description: "Cadastro de usuários",
	},
};

export function auditActionLabel(action: string): string {
	return AUDIT_ACTION_LABELS[action as AuditAction]?.label ?? action;
}

export function auditActionMeta(action: string): AuditActionMeta {
	return (
		AUDIT_ACTION_LABELS[action as AuditAction] ?? {
			label: action,
			description: "Ação registrada no histórico",
			severity: "info",
		}
	);
}

export function auditEntityLabel(entityType: string): string {
	return (
		AUDIT_ENTITY_LABELS[entityType as AuditEntityType]?.label ?? entityType
	);
}

export function auditEntityMeta(entityType: string): AuditEntityMeta {
	return (
		AUDIT_ENTITY_LABELS[entityType as AuditEntityType] ?? {
			label: entityType,
			description: "Entidade registrada no histórico",
		}
	);
}

export type AuditStateChange = {
	field: string;
	before: unknown;
	after: unknown;
};

export function diffAuditState(
	previousState: Record<string, unknown> | null,
	newState: Record<string, unknown> | null,
): AuditStateChange[] {
	if (!previousState || !newState) return [];
	const fields = new Set([
		...Object.keys(previousState),
		...Object.keys(newState),
	]);
	const changes: AuditStateChange[] = [];
	for (const field of fields) {
		const before = previousState[field];
		const after = newState[field];
		if (JSON.stringify(before) !== JSON.stringify(after)) {
			changes.push({ field, before: before ?? null, after: after ?? null });
		}
	}
	return changes;
}
