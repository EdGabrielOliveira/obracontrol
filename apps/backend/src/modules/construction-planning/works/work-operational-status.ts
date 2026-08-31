import type { ConstructionItemStatus } from "../schema";

export { WORK_OPERATIONAL_TRANSITIONS } from "../../../lib/status-machine";

const aliases: Record<string, ConstructionItemStatus> = {
	DRAFT: "DRAFT",
	RASCUNHO: "DRAFT",
	NOT_STARTED: "NOT_STARTED",
	NAO_INICIADA: "NOT_STARTED",
	NÃO_INICIADA: "NOT_STARTED",
	PLANEJADA: "NOT_STARTED",
	PLANEJADO: "NOT_STARTED",
	IN_PROGRESS: "IN_PROGRESS",
	EM_ANDAMENTO: "IN_PROGRESS",
	EM_EXECUCAO: "IN_PROGRESS",
	EM_EXECUÇÃO: "IN_PROGRESS",
	ATIVO: "IN_PROGRESS",
	ATIVA: "IN_PROGRESS",
	DONE: "DONE",
	FINALIZADO: "DONE",
	FINALIZADA: "DONE",
	CONCLUIDO: "DONE",
	CONCLUÍDO: "DONE",
	CONCLUIDA: "DONE",
	CONCLUÍDA: "DONE",
	SUSPENDED: "SUSPENDED",
	SUSPENSO: "SUSPENDED",
	SUSPENSA: "SUSPENDED",
	PARALISADO: "SUSPENDED",
	PARALISADA: "SUSPENDED",
	IGNORED: "IGNORED",
	ARQUIVADO: "IGNORED",
	ARQUIVADA: "IGNORED",
};

export function normalizeWorkOperationalStatus(
	value: string | null | undefined,
): ConstructionItemStatus {
	if (!value?.trim()) return "NOT_STARTED";
	return aliases[value.trim().toUpperCase()] ?? "NOT_STARTED";
}

export function isOperationalPortfolioWork(
	status: ConstructionItemStatus,
): boolean {
	// Obras em rascunho, não iniciadas ou suspensas continuam fazendo parte
	// da visão do portfólio. Apenas concluídas e arquivadas deixam de compor
	// os gráficos operacionais por padrão; filtros explícitos ainda permitem
	// consultá-las.
	return status !== "DONE" && status !== "IGNORED";
}
