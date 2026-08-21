export type AuditNavigationTarget = {
	path: string;
	label: string;
};

type AuditNavigationInput = {
	entityType: string;
	entityId: string;
	workId?: string;
};

function segment(value: string): string {
	return encodeURIComponent(value);
}

export function resolveAuditNavigationTarget({
	entityType,
	entityId,
	workId,
}: AuditNavigationInput): AuditNavigationTarget | null {
	const encodedEntityId = segment(entityId);

	if (entityType === "WORK") {
		return {
			path: `/app/obras/${encodedEntityId}`,
			label: "Abrir obra",
		};
	}

	if (entityType === "ORGANIZATION") {
		return {
			path: `/app/organizacoes/${encodedEntityId}`,
			label: "Abrir organização",
		};
	}

	if (entityType === "COST_CENTER") {
		return {
			path: `/app/centros-de-custo/${encodedEntityId}`,
			label: "Abrir centro de custo",
		};
	}

	if (!workId) return null;

	const encodedWorkId = segment(workId);
	const workPath = `/app/obras/${encodedWorkId}`;

	switch (entityType) {
		case "BUDGET_ITEM":
			return { path: `${workPath}/orcamento`, label: "Abrir orçamento" };
		case "ACTUAL_COST":
			return { path: `${workPath}/custos`, label: "Abrir custos" };
		case "CONSTRUCTION_MEASUREMENT":
		case "WORK_MEASUREMENT":
			return { path: `${workPath}/medicoes`, label: "Abrir medições" };
		case "SCHEDULE_REVISION":
			return {
				path: `${workPath}/orcamento?tab=cronograma`,
				label: "Abrir cronograma no orcamento",
			};
		case "CONSTRUCTION_IMPORT":
			return { path: `${workPath}/importacoes`, label: "Abrir importações" };
		case "CONTRACT":
			return {
				path: `${workPath}/contratos/${encodedEntityId}`,
				label: "Abrir contrato",
			};
		default:
			return null;
	}
}
