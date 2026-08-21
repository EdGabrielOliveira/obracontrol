export function parseBudgetInputNumber(value: string): number | null {
	if (value.trim() === "") return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

export function calculateBudgetItemTotal(
	quantity: string,
	unitCost: string,
): number | null {
	const parsedQuantity = parseBudgetInputNumber(quantity);
	const parsedUnitCost = parseBudgetInputNumber(unitCost);
	if (parsedQuantity === null || parsedUnitCost === null) return null;
	return parsedQuantity * parsedUnitCost;
}

export function calculateBudgetItemDelta(
	value: string,
	originalValue: number,
): number | null {
	const parsedValue = parseBudgetInputNumber(value);
	return parsedValue === null ? null : parsedValue - originalValue;
}
