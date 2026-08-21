import type { Decimal } from "@prisma/client/runtime/library";
import { toNum } from "../../../lib/decimal-utils";
import type { MetricMeasurementInput } from "./metrics-core";

type WorkMeasurementItem = {
	budgetItemId: string;
	measuredValue?: number | Decimal | null;
	accumulatedValue?: number | Decimal | null;
	accumulatedPercentage?: number | Decimal | null;
	accumulatedQuantity?: number | Decimal | null;
};

export function workMeasurementsToMetricInputs(
	workMeasurements: Array<{
		date: Date;
		items: WorkMeasurementItem[];
	}>,
): MetricMeasurementInput[] {
	const inputs: MetricMeasurementInput[] = [];

	for (const wm of workMeasurements) {
		for (const item of wm.items) {
			inputs.push({
				budgetItemId: item.budgetItemId,
				measurementDate: wm.date,
				measuredValueAccumulated:
					item.accumulatedValue != null
						? toNum(item.accumulatedValue)
						: item.measuredValue != null
							? toNum(item.measuredValue)
							: null,
				measuredPercentageAccumulated:
					item.accumulatedPercentage != null
						? toNum(item.accumulatedPercentage)
						: null,
				measuredQuantityAccumulated:
					item.accumulatedQuantity != null
						? toNum(item.accumulatedQuantity)
						: null,
			});
		}
	}

	return inputs;
}
