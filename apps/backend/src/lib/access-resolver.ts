import type { ScopeAccessFlags } from "./authorization";
import { roleToScopeAccess } from "./authorization";
import { ConstructionError } from "./errors";
import { resolveResourceScope, type ScopeContext } from "./resource-scope";

export type AccessAction = "read" | "write" | "approve" | "admin" | "audit";
export type ResourceType = "ORGANIZATION" | "COST_CENTER" | "WORK";

export type EffectiveAccess = ScopeAccessFlags & { role: string | null };

const ACTION_FLAG: Record<AccessAction, keyof ScopeAccessFlags> = {
	read: "canRead",
	write: "canWrite",
	approve: "canApprove",
	admin: "canAdmin",
	audit: "canAudit",
};

function resourceInput(resourceType: ResourceType, resourceId: string) {
	return {
		...(resourceType === "WORK"
			? { workId: resourceId }
			: resourceType === "COST_CENTER"
				? { costCenterId: resourceId }
				: { organizationId: resourceId }),
	};
}

export async function resolveEffectiveAccess(
	userId: string,
	resourceType: ResourceType,
	resourceId: string,
): Promise<EffectiveAccess> {
	const scope = await resolveResourceScope(
		userId,
		resourceInput(resourceType, resourceId),
	);
	if (!scope.canRead) {
		return { ...roleToScopeAccess(null), role: null };
	}
	return { ...roleToScopeAccess(scope.role), role: scope.role };
}

export async function authorize(
	userId: string,
	action: AccessAction,
	resourceType: ResourceType,
	resourceId: string,
): Promise<ScopeContext> {
	const scope = await resolveResourceScope(
		userId,
		resourceInput(resourceType, resourceId),
	);
	if (!scope[ACTION_FLAG[action]]) {
		throw new ConstructionError(
			"FORBIDDEN",
			"Voce nao tem permissao para executar esta acao",
			403,
		);
	}
	return scope;
}
