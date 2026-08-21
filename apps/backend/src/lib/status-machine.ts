import { ConstructionError } from "./errors";

export const CONTRACT_TRANSITIONS: Record<string, string[]> = {
	RASCUNHO: ["A_INICIAR"],
	A_INICIAR: ["EM_ANDAMENTO", "PARALISADO"],
	EM_ANDAMENTO: ["PARALISADO", "FINALIZADO"],
	PARALISADO: ["EM_ANDAMENTO"],
	FINALIZADO: [],
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

	const allowed = GOVERNANCE_TRANSITIONS[currentStatus];
	if (!allowed.includes(newStatus)) {
		throw new ConstructionError(
			"INVALID_STATUS_TRANSITION",
			"Transicao de governanca invalida",
			422,
		);
	}

	const isReopening =
		(currentStatus === "ACEITO" || currentStatus === "TRAVADO") &&
		newStatus === "EM_REVISAO";
	if (isReopening && !context.reason?.trim()) {
		throw new ConstructionError(
			"GOVERNANCE_REASON_REQUIRED",
			"Motivo obrigatorio para reabrir um registro governado",
			422,
		);
	}
	if (currentStatus === "TRAVADO" && context.role !== "ADMIN") {
		throw new ConstructionError(
			"GOVERNANCE_OVERRIDE_REQUIRED",
			"A reabertura de um registro travado exige override administrativo",
			403,
		);
	}
	if (context.override && context.role !== "ADMIN") {
		throw new ConstructionError(
			"GOVERNANCE_OVERRIDE_REQUIRED",
			"Somente ADMIN pode executar override administrativo",
			403,
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
			"Transicao de status invalida",
			422,
		);
	}
}
