import { prisma } from "../../lib/prisma";
import type { ScopeContext } from "../../lib/resource-scope";
import type { ApprovalMode, ApprovalResolution } from "./approval.types";

const DEFAULT_POLICY_BY_ACTION: Record<string, ApprovalMode> = {
	BUDGET_VERSION_ACTIVATE: "MANUAL",
	SCHEDULE_VERSION_ACTIVATE: "MANUAL",
	WORK_MEASUREMENT_APPROVE: "MANUAL",
	CONTRACT_MEASUREMENT_APPROVE: "MANUAL",
	PAYMENT_CONFIRM: "MANUAL",
	COST_APPROVE: "MANUAL",
	// Estouro orcamentario (impacto PENDING) exige decisao explicita:
	// aprovacao manual por padrao; politica configurada na obra pode
	// tornar AUTONOMOUS (efeito direto) ou BLOCKED.
	BUDGET_IMPACT_APPROVE: "MANUAL",
	// Plano 5: confirmacao de import e efeito direto por padrao; politica
	// MANUAL configurada na obra gera ApprovalRequest PENDING.
	IMPORT_CONFIRM: "AUTONOMOUS",
};

export function actionDefaultMode(action: string): ApprovalMode {
	return DEFAULT_POLICY_BY_ACTION[action] ?? "AUTONOMOUS";
}

function normalizeMode(value: string | null | undefined): ApprovalMode {
	if (value === "AUTONOMOUS" || value === "MANUAL" || value === "BLOCKED") {
		return value;
	}
	return "AUTONOMOUS";
}

function normalizeApproverRole(
	value: string | null | undefined,
): "GERENTE" | "GESTOR" | null {
	if (value === "GERENTE" || value === "GESTOR") return value;
	return null;
}

const SCOPE_ANCESTRY: Record<string, string[]> = {
	work: ["work", "costCenter", "organization"],
	costCenter: ["costCenter", "organization"],
	organization: ["organization"],
};

// Precedencia deterministica (APR-003):
// 1. usuario no escopo exato
// 2. usuario ancestral (work -> costCenter -> organization)
// 3. papel no escopo exato
// 4. papel ancestral
// 5. padrao da acao
export async function resolveApprovalPolicy(
	actorId: string,
	resource: ScopeContext,
	action: string,
	_value?: { toNumber(): number },
): Promise<ApprovalResolution> {
	const scopeType =
		resource.resourceType === "WORK"
			? "work"
			: resource.resourceType === "COST_CENTER"
				? "costCenter"
				: "organization";
	const _scopeId =
		resource.resourceType === "WORK"
			? (resource.path.workId ?? "")
			: resource.resourceType === "COST_CENTER"
				? (resource.path.costCenterId ?? "")
				: resource.path.organizationId;

	const scopeChain = SCOPE_ANCESTRY[scopeType] ?? [scopeType];
	const scopeIds = new Map<string, string>();
	for (const level of scopeChain) {
		const id =
			level === "work"
				? resource.path.workId
				: level === "costCenter"
					? resource.path.costCenterId
					: resource.path.organizationId;
		if (id) scopeIds.set(level, id);
	}

	const policies = await prisma.approvalPolicy.findMany({
		where: {
			scopeType: { in: scopeChain },
			action,
			active: true,
		},
	});

	// 1+2: politica de USUARIO — escopo exato primeiro, depois ancestral.
	const userPolicy =
		policies.find(
			(policy) =>
				policy.subjectType === "USER" &&
				policy.subjectId === actorId &&
				policy.scopeType === scopeType &&
				scopeIds.get(policy.scopeType) === policy.scopeId,
		) ??
		policies.find(
			(policy) =>
				policy.subjectType === "USER" &&
				policy.subjectId === actorId &&
				scopeIds.get(policy.scopeType) === policy.scopeId,
		);

	if (userPolicy)
		return buildResolution(
			resource,
			action,
			userPolicy.id,
			userPolicy.mode,
			userPolicy.approverRole,
			userPolicy.valueLimit,
		);

	// 3+4: politica de PAPEL — papel do ator no escopo exato, depois ancestral.
	const actorRole = resource.role ?? null;
	if (actorRole) {
		const rolePolicy =
			policies.find(
				(policy) =>
					policy.subjectType === "ROLE" &&
					policy.subjectId === actorRole &&
					policy.scopeType === scopeType &&
					scopeIds.get(policy.scopeType) === policy.scopeId,
			) ??
			policies.find(
				(policy) =>
					policy.subjectType === "ROLE" &&
					policy.subjectId === actorRole &&
					scopeIds.get(policy.scopeType) === policy.scopeId,
			);
		if (rolePolicy) {
			return buildResolution(
				resource,
				action,
				rolePolicy.id,
				rolePolicy.mode,
				rolePolicy.approverRole,
				rolePolicy.valueLimit,
			);
		}
	}

	// 5: padrao da acao.
	const defaultMode = actionDefaultMode(action);
	return buildResolution(resource, action, null, defaultMode, null, null);
}

function buildResolution(
	resource: ScopeContext,
	action: string,
	policyId: string | null,
	modeValue: string | null,
	approverRoleValue: string | null,
	valueLimit: { toNumber(): number } | null,
): ApprovalResolution {
	return {
		mode: normalizeMode(modeValue),
		action,
		scope: {
			organizationId: resource.path.organizationId,
			costCenterId: resource.path.costCenterId,
			workId: resource.path.workId,
			resourceOwnerId: resource.resourceOwnerId,
		},
		policyId,
		approverRole: normalizeApproverRole(approverRoleValue),
		valueLimit,
	};
}
