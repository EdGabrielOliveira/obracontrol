export type FlattenableBudgetItem = {
	id: string;
	description: string;
	index: string;
	unit?: string | null;
	quantity?: number | null;
	unitCost?: number | null;
	children?: readonly FlattenableBudgetItem[];
};

export type FlatBudgetItem = {
	id: string;
	description: string;
	index: string;
	unit: string | null;
	quantity: number | null;
	unitCost: number | null;
};

export function flattenBudgetItems(
	items: readonly FlattenableBudgetItem[],
): FlatBudgetItem[] {
	const result: FlatBudgetItem[] = [];
	for (const item of items) {
		result.push({
			id: item.id,
			description: item.description,
			index: item.index,
			unit: item.unit ?? null,
			quantity: item.quantity ?? null,
			unitCost: item.unitCost ?? null,
		});
		if (item.children?.length) {
			result.push(...flattenBudgetItems(item.children));
		}
	}
	return result;
}
