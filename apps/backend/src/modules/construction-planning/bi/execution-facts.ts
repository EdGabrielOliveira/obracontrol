import type { Decimal } from "@prisma/client/runtime/library";
import { toNum } from "../../../lib/decimal-utils";
import type { DbMeasurementInput } from "./calculations";
import { normalizePercentage } from "./percent-utils";

export type ManualWorkMeasurementInput = {
	date: Date;
	items: Array<{
		budgetItemId: string;
		measuredValue?: number | Decimal | null;
		accumulatedValue?: number | Decimal | null;
		accumulatedPercentage?: number | Decimal | null;
		accumulatedQuantity?: number | Decimal | null;
	}>;
};

function keyOf(row: {
	budgetItemId?: string | null;
	budgetItemIndex?: string | null;
	budgetIndex?: string | null;
	index?: string | null;
}) {
	return row.budgetItemId
		? `id:${row.budgetItemId}`
		: row.budgetItemIndex
			? `index:${row.budgetItemIndex}`
			: row.budgetIndex
				? `index:${row.budgetIndex}`
				: row.index
					? `index:${row.index}`
					: null;
}

export function workMeasurementsToMetricInputs(
	workMeasurements: ManualWorkMeasurementInput[],
): DbMeasurementInput[] {
	const rows = workMeasurements.flatMap((measurement) =>
		measurement.items.map((item) => ({
			budgetItemId: item.budgetItemId,
			measurementDate: measurement.date,
			measuredValueAccumulated:
				item.accumulatedValue != null ? toNum(item.accumulatedValue) : null,
			measuredValue:
				item.measuredValue != null ? toNum(item.measuredValue) : null,
			measuredPercentageAccumulated:
				item.accumulatedPercentage != null
					? normalizePercentage(toNum(item.accumulatedPercentage))
					: null,
			measuredQuantityAccumulated:
				item.accumulatedQuantity != null
					? toNum(item.accumulatedQuantity)
					: null,
		})),
	);
	return normalizeAccumulatedValues(
		rows.sort(
			(a, b) =>
				(a.measurementDate?.getTime() ?? 0) -
				(b.measurementDate?.getTime() ?? 0),
		),
	);
}

function normalizeAccumulatedValues(rows: DbMeasurementInput[]) {
	const accumulatedByItem = new Map<string, number>();
	return rows.map((row) => {
		const key = keyOf(row);
		if (!key || row.measuredValueAccumulated != null) {
			if (key && row.measuredValueAccumulated != null) {
				accumulatedByItem.set(key, toNum(row.measuredValueAccumulated));
			}
			return row;
		}
		if (row.measuredValue == null) return row;

		const accumulated =
			(accumulatedByItem.get(key) ?? 0) + toNum(row.measuredValue);
		accumulatedByItem.set(key, accumulated);
		return { ...row, measuredValueAccumulated: accumulated };
	});
}

/**
 * Builds the canonical physical facts. Operational accepted measurements win
 * per budget item; imported facts are retained only for items without an
 * operational fact, preventing an imported value from being counted twice.
 */
export function composeMeasurementInputs(
	importedMeasurements: DbMeasurementInput[],
	manualMeasurements: ManualWorkMeasurementInput[] = [],
): DbMeasurementInput[] {
	const imported = importedMeasurements.map((measurement) => ({
		...measurement,
		measuredPercentageAccumulated:
			measurement.measuredPercentageAccumulated != null
				? normalizePercentage(toNum(measurement.measuredPercentageAccumulated))
				: null,
	}));
	const operational = workMeasurementsToMetricInputs(manualMeasurements);
	const operationalKeys = new Set(
		operational.map((measurement) => keyOf(measurement)).filter(Boolean),
	);
	const ordered = [
		...imported.filter(
			(measurement) => !operationalKeys.has(keyOf(measurement)),
		),
		...operational,
	].sort(
		(a, b) =>
			(a.measurementDate?.getTime() ?? 0) - (b.measurementDate?.getTime() ?? 0),
	);
	return normalizeAccumulatedValues(ordered);
}

export function measurementValueDelta(
	current: DbMeasurementInput,
	previous: DbMeasurementInput | undefined,
): number {
	if (current.measuredValueAccumulated != null) {
		const value = toNum(current.measuredValueAccumulated);
		const previousValue = previous?.measuredValueAccumulated;
		return value - (previousValue == null ? 0 : toNum(previousValue));
	}
	return current.measuredValue == null ? 0 : toNum(current.measuredValue);
}
