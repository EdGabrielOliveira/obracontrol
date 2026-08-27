export const BUDGET_ITEM_STATUS_OPTIONS = [
	{ id: "ATIVO", value: "ATIVO", label: "Ativo" },
	{ id: "INATIVO", value: "INATIVO", label: "Inativo" },
] as const;

export const CONTRACT_STATUS_OPTIONS = [
	{ id: "RASCUNHO", value: "RASCUNHO", label: "Rascunho" },
	{ id: "A_INICIAR", value: "A_INICIAR", label: "A iniciar" },
	{ id: "EM_ANDAMENTO", value: "EM_ANDAMENTO", label: "Em andamento" },
	{ id: "PARALISADO", value: "PARALISADO", label: "Paralisado" },
	{ id: "FINALIZADO", value: "FINALIZADO", label: "Finalizado" },
	{ id: "ARQUIVADO", value: "ARQUIVADO", label: "Arquivado" },
] as const;

export const DEFAULT_CONTRACT_STATUS = "RASCUNHO" as const;

export const PAYMENT_STATUS_OPTIONS = [
	{ id: "PAGO", value: "PAGO", label: "Pago" },
	{ id: "EM_ABERTO", value: "EM_ABERTO", label: "Em aberto" },
] as const;

export const COST_PAYMENT_STATUS_OPTIONS = [
	{ id: "PAID", value: "PAID", label: "Pago" },
	{ id: "OPEN", value: "OPEN", label: "Em aberto" },
] as const;

export const COST_TYPE_OPTIONS = [
	{ id: "CURRENT", value: "CURRENT", label: "Atual" },
	{ id: "FUTURE", value: "FUTURE", label: "Futuro" },
] as const;
