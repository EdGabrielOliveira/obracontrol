import { describe, expect, it } from "bun:test";
import { workMeasurementsToMetricInputs } from "../../../../../src/modules/construction-planning/bi/measurement-adapter";

describe("workMeasurementsToMetricInputs", () => {
	it("passes accumulatedValue with precedence over measuredValue", () => {
		const [input] = workMeasurementsToMetricInputs([
			{
				date: new Date("2026-01-15T00:00:00.000Z"),
				items: [
					{
						budgetItemId: "item-1",
						measuredValue: 300,
						accumulatedValue: 500,
					},
				],
			},
		]);

		expect(input.measuredValueAccumulated).toBe(500);
	});

	it("falls back to measuredValue when accumulatedValue is missing", () => {
		const [input] = workMeasurementsToMetricInputs([
			{
				date: new Date("2026-01-15T00:00:00.000Z"),
				items: [{ budgetItemId: "item-1", measuredValue: 300 }],
			},
		]);

		expect(input.measuredValueAccumulated).toBe(300);
	});

	it("keeps measuredValueAccumulated null when both monetary fields are missing", () => {
		const [input] = workMeasurementsToMetricInputs([
			{
				date: new Date("2026-01-15T00:00:00.000Z"),
				items: [{ budgetItemId: "item-1" }],
			},
		]);

		expect(input.measuredValueAccumulated).toBeNull();
	});

	it("normalizes accumulatedPercentage to the internal ratio", () => {
		const [input] = workMeasurementsToMetricInputs([
			{
				date: new Date("2026-01-15T00:00:00.000Z"),
				items: [{ budgetItemId: "item-1", accumulatedPercentage: 50 }],
			},
		]);

		expect(input.measuredPercentageAccumulated).toBe(0.5);
	});

	it("keeps fractional accumulatedPercentage unchanged", () => {
		const [input] = workMeasurementsToMetricInputs([
			{
				date: new Date("2026-01-15T00:00:00.000Z"),
				items: [{ budgetItemId: "item-1", accumulatedPercentage: 0.5 }],
			},
		]);

		expect(input.measuredPercentageAccumulated).toBe(0.5);
	});

	it("keeps accumulatedPercentage null when absent", () => {
		const [input] = workMeasurementsToMetricInputs([
			{
				date: new Date("2026-01-15T00:00:00.000Z"),
				items: [{ budgetItemId: "item-1", accumulatedValue: 100 }],
			},
		]);

		expect(input.measuredPercentageAccumulated).toBeNull();
	});

	it("preserves accumulatedQuantity", () => {
		const [input] = workMeasurementsToMetricInputs([
			{
				date: new Date("2026-01-15T00:00:00.000Z"),
				items: [
					{
						budgetItemId: "item-1",
						accumulatedQuantity: 7.5,
						accumulatedPercentage: 75,
					},
				],
			},
		]);

		expect(input.measuredQuantityAccumulated).toBe(7.5);
		expect(input.measuredPercentageAccumulated).toBe(0.75);
	});

	it("flattens items from multiple measurements preserving date and budgetItemId", () => {
		const inputs = workMeasurementsToMetricInputs([
			{
				date: new Date("2026-01-10T00:00:00.000Z"),
				items: [{ budgetItemId: "item-1", accumulatedValue: 100 }],
			},
			{
				date: new Date("2026-01-20T00:00:00.000Z"),
				items: [
					{ budgetItemId: "item-1", accumulatedValue: 150 },
					{ budgetItemId: "item-2", accumulatedValue: 40 },
				],
			},
		]);

		expect(inputs).toHaveLength(3);
		expect(inputs[0]).toMatchObject({
			budgetItemId: "item-1",
			measurementDate: new Date("2026-01-10T00:00:00.000Z"),
			measuredValueAccumulated: 100,
		});
		expect(inputs[1]).toMatchObject({
			budgetItemId: "item-1",
			measurementDate: new Date("2026-01-20T00:00:00.000Z"),
			measuredValueAccumulated: 150,
		});
		expect(inputs[2]).toMatchObject({
			budgetItemId: "item-2",
			measurementDate: new Date("2026-01-20T00:00:00.000Z"),
			measuredValueAccumulated: 40,
		});
	});
});
