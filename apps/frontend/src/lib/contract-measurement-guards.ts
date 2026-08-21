export type BudgetCoverageService = {
	id?: string;
	budgetItemId: string | null;
	children?: readonly BudgetCoverageService[];
};

export function hasDirectBudgetCoverage(
	service: BudgetCoverageService,
): boolean {
	return Boolean(service.budgetItemId?.trim());
}

export function hasBudgetCoverage(
	services: readonly BudgetCoverageService[],
): boolean {
	return services.some(
		(service) =>
			hasDirectBudgetCoverage(service) ||
			hasBudgetCoverage(service.children ?? []),
	);
}

export function filterBudgetCoveredServiceIds(
	serviceIds: readonly string[],
	services: readonly BudgetCoverageService[],
): string[] {
	const coveredServiceIds = new Set(
		services.flatMap((service) =>
			service.id && hasDirectBudgetCoverage(service) ? [service.id] : [],
		),
	);
	return serviceIds.filter((serviceId) => coveredServiceIds.has(serviceId));
}

export function canCreateContractMeasurement(
	services: readonly BudgetCoverageService[],
	effectiveBudgetVersionId: string | null | undefined,
): boolean {
	return (
		Boolean(effectiveBudgetVersionId) && services.some(hasDirectBudgetCoverage)
	);
}
