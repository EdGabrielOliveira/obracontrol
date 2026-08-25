export const OPERATIONAL_CONTRACT_STATUSES = [
	"EM_ANDAMENTO",
	"PARALISADO",
	"FINALIZADO",
] as const;

export type OperationalContractStatus =
	(typeof OPERATIONAL_CONTRACT_STATUSES)[number];

export function isOperationalContractStatus(status: string): boolean {
	return (OPERATIONAL_CONTRACT_STATUSES as readonly string[]).includes(status);
}
