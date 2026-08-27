import type { Role } from "@/types/authorization";
import type { GovernanceStatus } from "@/types/governance";

export const GOVERNANCE_STATUSES: readonly GovernanceStatus[] = [
	"RASCUNHO",
	"EM_REVISAO",
	"ACEITO",
	"TRAVADO",
];

const CANONICAL_TRANSITIONS: Record<
	GovernanceStatus,
	readonly GovernanceStatus[]
> = {
	RASCUNHO: ["EM_REVISAO"],
	EM_REVISAO: ["RASCUNHO", "ACEITO"],
	ACEITO: ["EM_REVISAO", "TRAVADO"],
	TRAVADO: ["EM_REVISAO"],
};

const ELEVATED_ROLES: readonly Role[] = ["ADMIN", "GERENTE", "GESTOR"];

export function canManageGovernanceStatus(
	role: string | null | undefined,
): boolean {
	return ELEVATED_ROLES.includes(role as Role);
}

export function getGovernanceStatusOptions(
	currentStatus: GovernanceStatus,
	role: string | null | undefined,
): GovernanceStatus[] {
	if (canManageGovernanceStatus(role)) {
		return GOVERNANCE_STATUSES.filter((status) => status !== currentStatus);
	}
	return [...(CANONICAL_TRANSITIONS[currentStatus] ?? [])];
}

export function governanceTransitionRequiresReason(
	currentStatus: GovernanceStatus,
	targetStatus: GovernanceStatus,
): boolean {
	if (currentStatus === targetStatus) return false;
	const isCanonical =
		CANONICAL_TRANSITIONS[currentStatus].includes(targetStatus);
	const isReopening =
		(currentStatus === "ACEITO" || currentStatus === "TRAVADO") &&
		targetStatus === "EM_REVISAO";
	return !isCanonical || isReopening;
}
