import type { MeasurementCreateValues } from "@/schemas/measurements";
import type { CreateMeasurementInput } from "@/types/measurements";

export function buildWorkMeasurementPayload(
	values: MeasurementCreateValues,
): CreateMeasurementInput {
	const payload: CreateMeasurementInput = {
		date: values.date,
		title: values.title.trim(),
		items: values.items.map((item) => ({
			budgetItemId: item.budgetItemId,
			measuredQuantity: Number(item.measuredQuantity),
		})),
	};
	if (values.balanceOverride) {
		payload.balanceOverride = true;
		payload.evidenceNote = (values.evidenceNote ?? "").trim();
	}
	return payload;
}
