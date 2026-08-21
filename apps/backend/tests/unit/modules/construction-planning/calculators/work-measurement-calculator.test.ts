import { describe, expect, it } from "bun:test";
import Decimal from "decimal.js";
import { deriveWorkMeasurementItem } from "../../../../../src/modules/construction-planning/calculators/work-measurement-calculator";

describe("work measurement quantity calculator", () => {
	it("derives value and percentage from quantity and effective unit cost", () => {
		const result = deriveWorkMeasurementItem({
			measuredQuantity: new Decimal(5),
			previousAccumulatedQuantity: new Decimal(0),
			plannedQuantity: new Decimal(20),
			unitCost: new Decimal(100),
		});

		expect(result.measuredQuantity.toNumber()).toBe(5);
		expect(result.measuredValue.toNumber()).toBe(500);
		expect(result.measuredPercentage.toNumber()).toBe(25);
		expect(result.accumulatedQuantity.toNumber()).toBe(5);
		expect(result.accumulatedValue.toNumber()).toBe(500);
		expect(result.accumulatedPercentage.toNumber()).toBe(25);
		expect(result.availableQuantity.toNumber()).toBe(15);
	});

	it("rejects zero, negative and over-available quantities unless override is enabled", () => {
		expect(() =>
			deriveWorkMeasurementItem({
				measuredQuantity: new Decimal(0),
				previousAccumulatedQuantity: new Decimal(0),
				plannedQuantity: new Decimal(20),
				unitCost: new Decimal(100),
			}),
		).toThrow("measuredQuantity");

		expect(() =>
			deriveWorkMeasurementItem({
				measuredQuantity: new Decimal(-1),
				previousAccumulatedQuantity: new Decimal(0),
				plannedQuantity: new Decimal(20),
				unitCost: new Decimal(100),
			}),
		).toThrow("measuredQuantity");

		expect(() =>
			deriveWorkMeasurementItem({
				measuredQuantity: new Decimal(16),
				previousAccumulatedQuantity: new Decimal(5),
				plannedQuantity: new Decimal(20),
				unitCost: new Decimal(100),
			}),
		).toThrow("available quantity");

		const allowedOverflow = deriveWorkMeasurementItem({
			measuredQuantity: new Decimal(16),
			previousAccumulatedQuantity: new Decimal(5),
			plannedQuantity: new Decimal(20),
			unitCost: new Decimal(100),
			allowExceedingBalance: true,
		});
		expect(allowedOverflow.accumulatedQuantity.toNumber()).toBe(21);
	});
});
