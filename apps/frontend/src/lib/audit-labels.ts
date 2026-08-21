import type {
	AuditAction,
	AuditEntityType,
	DomainAuditAction,
} from "@/types/audit";

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
