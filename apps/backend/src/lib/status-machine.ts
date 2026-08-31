import { ConstructionError } from "./errors";

export const CONTRACT_TRANSITIONS: Record<string, string[]> = {
	// Status de contrato pode ser corrigido manualmente por perfis autorizados.
	// A permissão de escrita continua sendo aplicada na rota; esta máquina não
	// deve impedir uma correção de status (inclusive após FINALIZADO).
	RASCUNHO: [
		"A_INICIAR",
		"EM_ANDAMENTO",
		"PARALISADO",
		"FINALIZADO",
		"ARQUIVADO",
	],
	A_INICIAR: [
		"RASCUNHO",
		"EM_ANDAMENTO",
		"PARALISADO",
		"FINALIZADO",
		"ARQUIVADO",
	],
	EM_ANDAMENTO: [
		"RASCUNHO",
		"A_INICIAR",
		"PARALISADO",
		"FINALIZADO",
		"ARQUIVADO",
	],
	PARALISADO: [
		"RASCUNHO",
		"A_INICIAR",
		"EM_ANDAMENTO",
		"FINALIZADO",
		"ARQUIVADO",
	],
	FINALIZADO: [
		"RASCUNHO",
		"A_INICIAR",
		"EM_ANDAMENTO",
		"PARALISADO",
		"ARQUIVADO",
	],
	ARQUIVADO: [
		"RASCUNHO",
		"A_INICIAR",
		"EM_ANDAMENTO",
		"PARALISADO",
		"FINALIZADO",
	],
};

// Obra pode ser corrigida diretamente para qualquer status operacional.
// A exigência de motivo para SUSPENDED/IGNORED permanece no serviço.
const ALL_WORK_OPERATIONAL_STATUSES = [
	"DRAFT",
	"NOT_STARTED",
	"IN_PROGRESS",
	"DONE",
	"SUSPENDED",
	"IGNORED",
] as const;

export const WORK_OPERATIONAL_TRANSITIONS: Record<string, string[]> =
	Object.fromEntries(
		ALL_WORK_OPERATIONAL_STATUSES.map((status) => [
			status,
			[...ALL_WORK_OPERATIONAL_STATUSES],
		]),
	);

export const MEASUREMENT_TRANSITIONS: Record<string, string[]> = {
	RASCUNHO: ["ACEITO", "RECUSADO", "ARQUIVADO"],
	ACEITO: ["RASCUNHO", "RECUSADO", "ARQUIVADO"],
	RECUSADO: ["RASCUNHO", "ACEITO", "ARQUIVADO"],
	ARQUIVADO: ["RASCUNHO"],
};

export const BUDGET_VERSION_TRANSITIONS: Record<string, string[]> = {
	DRAFT: ["PENDING_APPROVAL", "REJECTED", "ARCHIVED"],
	PENDING_APPROVAL: ["ACTIVE", "REJECTED"],
	ACTIVE: ["SUPERSEDED"],
	REJECTED: ["DRAFT", "ARCHIVED"],
	SUPERSEDED: [],
	ARCHIVED: ["DRAFT"],
};

export const PAYMENT_TRANSITIONS: Record<string, string[]> = {
	EM_ABERTO: ["PAGO"],
	PAGO: [],
};

export type GovernanceStatus = "RASCUNHO" | "EM_REVISAO" | "ACEITO" | "TRAVADO";

export type GovernanceRole = "ADMIN" | "GERENTE" | "GESTOR" | "SUPERVISOR";

export const GOVERNANCE_TRANSITIONS: Record<
	GovernanceStatus,
	GovernanceStatus[]
> = {
	RASCUNHO: ["EM_REVISAO"],
	EM_REVISAO: ["RASCUNHO", "ACEITO"],
	ACEITO: ["EM_REVISAO", "TRAVADO"],
	TRAVADO: ["EM_REVISAO"],
};

const DIRECT_GOVERNANCE_ROLES: readonly GovernanceRole[] = [
	"ADMIN",
	"GERENTE",
	"GESTOR",
];

export function isCanonicalGovernanceTransition(
	currentStatus: GovernanceStatus,
	newStatus: GovernanceStatus,
): boolean {
	return GOVERNANCE_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

export function validateGovernanceTransition(
	currentStatus: GovernanceStatus,
	newStatus: GovernanceStatus,
	context: {
		role: GovernanceRole;
		reason?: string | null;
		override?: boolean;
	},
) {
	if (currentStatus === newStatus) return;
	if (context.role === "SUPERVISOR") {
		throw new ConstructionError(
			"FORBIDDEN",
			"Supervisor nao tem permissao para alterar o estado de governanca",
			403,
		);
	}

	const isCanonical = isCanonicalGovernanceTransition(currentStatus, newStatus);
	const canTransitionDirectly = DIRECT_GOVERNANCE_ROLES.includes(context.role);
	if (!isCanonical && !canTransitionDirectly) {
		throw new ConstructionError(
			"INVALID_STATUS_TRANSITION",
			"Transicao de governanca invalida",
			422,
		);
	}

	const isReopening =
		(currentStatus === "ACEITO" || currentStatus === "TRAVADO") &&
		newStatus === "EM_REVISAO";
	if ((!isCanonical || isReopening) && !context.reason?.trim()) {
		throw new ConstructionError(
			"GOVERNANCE_REASON_REQUIRED",
			"Motivo obrigatorio para transicao direta ou reabertura de um registro governado",
			422,
		);
	}
}

export function validateStatusTransition(
	_entityName: string,
	transitions: Record<string, string[]>,
	currentStatus: string,
	newStatus: string,
) {
	if (currentStatus === newStatus) return;
	const allowed = transitions[currentStatus];
	if (!allowed || !allowed.includes(newStatus)) {
		throw new ConstructionError(
			"INVALID_STATUS_TRANSITION",
			`Transicao de status invalida: ${currentStatus} -> ${newStatus}`,
			422,
		);
	}
}
