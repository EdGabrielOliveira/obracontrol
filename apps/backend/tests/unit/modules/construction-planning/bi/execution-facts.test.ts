import { describe, expect, it } from "bun:test";
import {
	composeMeasurementInputs,
	measurementValueDelta,
} from "../../../../../src/modules/construction-planning/bi/execution-facts";

describe("canonical execution facts", () => {
	it("uses accepted operational measurements per item and keeps imported fallback items", () => {
		const result = composeMeasurementInputs(
			[
				{
					budgetItemId: "item-1",
					measurementDate: new Date("2026-01-01"),
					measuredPercentageAccumulated: 0.2,
				},
				{
					budgetItemId: "item-2",
					measurementDate: new Date("2026-01-01"),
					measuredPercentageAccumulated: 0.4,
				},
			],
			[
				{
					date: new Date("2026-01-02"),
					items: [
						{
							budgetItemId: "item-1",
							measuredValue: 50,
							accumulatedValue: 50,
							accumulatedPercentage: 0.5,
						},
					],
				},
			],
		);

		expect(result.map((row) => row.budgetItemId)).toEqual(["item-2", "item-1"]);
		expect(
			result.find((row) => row.budgetItemId === "item-1")
				?.measuredPercentageAccumulated,
		).toBe(0.5);
	});

	it("converts accumulated values into period deltas", () => {
		const previous = {
			budgetItemId: "item-1",
			measurementDate: new Date("2026-01-01"),
			measuredValueAccumulated: 30,
		};
		const current = {
			budgetItemId: "item-1",
			measurementDate: new Date("2026-02-01"),
			measuredValueAccumulated: 50,
		};
		expect(measurementValueDelta(current, previous)).toBe(20);
	});

	it("accumulates incremental values chronologically per item", () => {
		const result = composeMeasurementInputs(
			[],
			[
				{
					date: new Date("2026-01-01"),
					items: [{ budgetItemId: "item-1", measuredValue: 30 }],
				},
				{
					date: new Date("2026-02-01"),
					items: [{ budgetItemId: "item-1", measuredValue: 20 }],
				},
			],
		);

		expect(result.map((row) => row.measuredValueAccumulated)).toEqual([30, 50]);
		expect(measurementValueDelta(result[1], result[0])).toBe(20);
	});
});
