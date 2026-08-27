import type { ContractStatus, PaymentStatus } from "@/types/contracts";
import type {
	ConstructionItemStatus,
	MeasurementLifecycleStatus,
} from "@/types/shared";

export const MEASUREMENT_STATUS_TRANSITIONS: Record<
	MeasurementLifecycleStatus,
	readonly MeasurementLifecycleStatus[]
> = {
	RASCUNHO: ["ACEITO", "RECUSADO", "ARQUIVADO"],
	ACEITO: ["RASCUNHO", "RECUSADO", "ARQUIVADO"],
	RECUSADO: ["RASCUNHO", "ACEITO", "ARQUIVADO"],
	ARQUIVADO: ["RASCUNHO"],
};

export const WORK_OPERATIONAL_STATUS_TRANSITIONS: Record<
	ConstructionItemStatus,
	readonly ConstructionItemStatus[]
> = {
	DRAFT: ["NOT_STARTED", "IGNORED"],
	NOT_STARTED: ["IN_PROGRESS", "SUSPENDED", "IGNORED"],
	IN_PROGRESS: ["SUSPENDED", "DONE", "IGNORED"],
	SUSPENDED: ["IN_PROGRESS", "DONE", "IGNORED"],
	DONE: ["IGNORED"],
	IGNORED: ["NOT_STARTED", "IN_PROGRESS"],
};

export const CONTRACT_STATUS_TRANSITIONS: Record<
	ContractStatus,
	readonly ContractStatus[]
> = {
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

export const PAYMENT_STATUS_TRANSITIONS: Record<
	PaymentStatus,
	readonly PaymentStatus[]
> = {
	EM_ABERTO: ["PAGO"],
	PAGO: [],
};

export function optionsForStatus<T extends string, O extends { value: T }>(
	allOptions: readonly O[],
	current: T,
	transitions: Record<T, readonly T[]>,
): O[] {
	const allowed = new Set<T>([current, ...(transitions[current] ?? [])]);
	return allOptions.filter((option) => allowed.has(option.value));
}
