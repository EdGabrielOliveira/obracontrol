import type { Decimal } from "@prisma/client/runtime/library";
import { toNum } from "../../../lib/decimal-utils";
import type { DbMeasurementInput } from "./calculations";
import { budgetItemReferencesMatch } from "./metrics-core";
import { normalizePercentage } from "./percent-utils";

export type ManualWorkMeasurementInput = {
	date: Date;
	items: Array<{
		budgetItemId: string;
		budgetItemIndex?: string | null;
		measuredValue?: number | Decimal | null;
		accumulatedValue?: number | Decimal | null;
		accumulatedPercentage?: number | Decimal | null;
		accumulatedQuantity?: number | Decimal | null;
	}>;
};

export function workMeasurementsToMetricInputs(
	workMeasurements: ManualWorkMeasurementInput[],
): DbMeasurementInput[] {
	const rows = workMeasurements.flatMap((measurement) =>
		measurement.items.map((item) => ({
			budgetItemId: item.budgetItemId,
			budgetItemIndex: item.budgetItemIndex ?? null,
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
	const accumulatedGroups: Array<{
		reference: DbMeasurementInput;
		value: number;
	}> = [];
	return rows.map((row) => {
		const group = accumulatedGroups.find((candidate) =>
			budgetItemReferencesMatch(candidate.reference, row),
		);
		if (!group) {
			if (row.measuredValueAccumulated != null) {
				accumulatedGroups.push({
					reference: row,
					value: toNum(row.measuredValueAccumulated),
				});
				return row;
			}
			if (row.measuredValue != null) {
				const value = toNum(row.measuredValue);
				accumulatedGroups.push({ reference: row, value });
				return { ...row, measuredValueAccumulated: value };
			}
			return row;
		}
		if (row.measuredValueAccumulated != null) {
			group.value = toNum(row.measuredValueAccumulated);
			return row;
		}
		if (row.measuredValue == null) return row;

		group.value += toNum(row.measuredValue);
		return { ...row, measuredValueAccumulated: group.value };
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
	const ordered = [
		...imported.filter(
			(measurement) =>
				!operational.some((operationalMeasurement) =>
					budgetItemReferencesMatch(operationalMeasurement, measurement),
				),
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
