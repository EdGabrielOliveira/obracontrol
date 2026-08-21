import { ConstructionError } from "../../lib/errors";

export const contractRequestPhases = [
	"RASCUNHO",
	"CRIADA",
	"AGUARDANDO_MAPA",
	"EM_COTACAO",
	"EM_NEGOCIACAO",
	"AGUARDANDO_APROVACAO_FINAL",
	"CONTRATADA",
	"CANCELADA",
] as const;

export type ContractRequestPhase = (typeof contractRequestPhases)[number];

export const legacyContractRequestPhaseMap: Record<
	string,
	ContractRequestPhase
> = {
	EM_ESPERA: "AGUARDANDO_APROVACAO_FINAL",
	ACEITA: "CONTRATADA",
};

const transitions: Record<
	ContractRequestPhase,
	readonly ContractRequestPhase[]
> = {
	RASCUNHO: ["CRIADA", "CANCELADA"],
	CRIADA: ["AGUARDANDO_MAPA", "CANCELADA"],
	AGUARDANDO_MAPA: ["EM_COTACAO", "CANCELADA"],
	EM_COTACAO: ["EM_NEGOCIACAO", "CANCELADA"],
	EM_NEGOCIACAO: ["AGUARDANDO_APROVACAO_FINAL", "CANCELADA"],
	AGUARDANDO_APROVACAO_FINAL: ["EM_NEGOCIACAO", "CONTRATADA", "CANCELADA"],
	CONTRATADA: [],
	CANCELADA: [],
};

export function normalizeContractRequestPhase(
	status: string,
): ContractRequestPhase {
	if ((contractRequestPhases as readonly string[]).includes(status)) {
		return status as ContractRequestPhase;
	}
	return legacyContractRequestPhaseMap[status] ?? "RASCUNHO";
}

export function assertContractRequestTransition(
	from: string,
	to: ContractRequestPhase,
): void {
	const current = normalizeContractRequestPhase(from);
	if (!transitions[current].includes(to)) {
		throw new ConstructionError(
			"INVALID_STATE_TRANSITION",
			`Transição inválida: ${current} -> ${to}`,
			409,
		);
	}
}
