import type { WorkMeasurementItem } from "@/types/measurements";

export type EditMeasurementItemRow = {
	id?: string;
	budgetItemId: string;
	measuredQuantity: string;
	measuredPercentage?: string;
};

export function hydrateEditItems(
	items: WorkMeasurementItem[] | null | undefined,
): EditMeasurementItemRow[] {
	if (!items || items.length === 0) {
		return [{ budgetItemId: "", measuredQuantity: "" }];
	}
	return items.map((item) => ({
		id: item.id,
		budgetItemId: item.budgetItemId,
		measuredQuantity: item.measuredQuantity?.toString() ?? "",
		measuredPercentage: item.measuredPercentage?.toString(),
	}));
}
