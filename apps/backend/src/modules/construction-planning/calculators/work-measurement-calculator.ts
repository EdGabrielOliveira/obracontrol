import type { Decimal } from "@prisma/client/runtime/library";

export type DerivedWorkMeasurementItem = {
	measuredQuantity: Decimal;
	measuredValue: Decimal;
	measuredPercentage: Decimal;
	accumulatedQuantity: Decimal;
	accumulatedValue: Decimal;
	accumulatedPercentage: Decimal;
	availableQuantity: Decimal;
};

export function deriveWorkMeasurementItem(input: {
	measuredQuantity: Decimal;
	previousAccumulatedQuantity: Decimal;
	plannedQuantity: Decimal;
	unitCost: Decimal;
	allowExceedingBalance?: boolean;
}): DerivedWorkMeasurementItem {
	if (
		!input.measuredQuantity.isFinite() ||
		!input.measuredQuantity.greaterThan(0)
	) {
		throw new Error("measuredQuantity must be positive");
	}
	if (!input.plannedQuantity.greaterThan(0) || !input.unitCost.greaterThan(0)) {
		throw new Error("planned quantity and unit cost must be positive");
	}

	const accumulatedQuantity = input.previousAccumulatedQuantity.plus(
		input.measuredQuantity,
	);
	const availableQuantity = input.plannedQuantity.minus(accumulatedQuantity);
	if (
		!input.allowExceedingBalance &&
		accumulatedQuantity.greaterThan(input.plannedQuantity)
	) {
		throw new Error("measuredQuantity exceeds available quantity");
	}

	const measuredValue = input.measuredQuantity.mul(input.unitCost);
	const accumulatedValue = accumulatedQuantity.mul(input.unitCost);
	return {
		measuredQuantity: input.measuredQuantity,
		measuredValue,
		measuredPercentage: input.measuredQuantity
			.div(input.plannedQuantity)
			.mul(100),
		accumulatedQuantity,
		accumulatedValue,
		accumulatedPercentage: accumulatedQuantity
			.div(input.plannedQuantity)
			.mul(100),
		availableQuantity,
	};
}
