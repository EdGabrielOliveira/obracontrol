type ContractFinancialService = {
	quantity?: number | null;
	unitCost?: number | null;
	totalCost?: number | null;
	budgetItem?: {
		unitCost?: number | null;
		totalCost?: number | null;
	} | null;
};

/** Planned cost of a contract is based on contracted quantity, not budget quantity. */
export function calculateContractPlannedTotal(
	services: readonly ContractFinancialService[],
): number {
	return services.reduce((total, service) => {
		const quantity = Number(service.quantity ?? 0);
		const unitCost = Number(
			service.budgetItem?.unitCost ?? service.unitCost ?? 0,
		);
		return (
			total +
			(Number.isFinite(quantity) && Number.isFinite(unitCost)
				? quantity * unitCost
				: 0)
		);
	}, 0);
}

export function calculateBillingPercentage(
	negotiatedValue: number,
	plannedTotal: number,
): number | null {
	if (!Number.isFinite(plannedTotal) || plannedTotal <= 0) return null;
	if (!Number.isFinite(negotiatedValue)) return null;
	return (negotiatedValue / plannedTotal) * 100;
}
