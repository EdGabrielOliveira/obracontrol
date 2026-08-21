import { describe, expect, it } from "bun:test";
import {
	buildCanonicalMeasurementTree,
	calculateMeasurementTotals,
} from "../../../../../src/modules/construction-planning/calculators/measurement-calculator";

describe("measurement calculator", () => {
	it("uses latest accumulated value per item instead of summing accumulated rows", () => {
		const result = calculateMeasurementTotals({
			budgetItems: [
				{ id: "bi-1", index: "1.1", totalCost: 1000, quantity: 10 },
			],
			measurements: [
				{
					id: "m1",
					source: "operational",
					budgetItemId: "bi-1",
					index: "1.1",
					date: new Date("2026-01-01"),
					number: 1,
					measuredValue: 100,
					measuredPercentage: 10,
					accumulatedValue: 100,
					accumulatedPercentage: 10,
					measuredQuantity: null,
					accumulatedQuantity: null,
				},
				{
					id: "m2",
					source: "operational",
					budgetItemId: "bi-1",
					index: "1.1",
					date: new Date("2026-02-01"),
					number: 2,
					measuredValue: 200,
					measuredPercentage: 20,
					accumulatedValue: 300,
					accumulatedPercentage: 30,
					measuredQuantity: null,
					accumulatedQuantity: null,
				},
			],
		});

		expect(result.totalMeasured).toBe(300);
		expect(result.balanceToMeasure).toBe(700);
		expect(result.totalMeasuredPercentage).toBe(30);
	});

	it("computes value from percentage when value is absent", () => {
		const result = calculateMeasurementTotals({
			budgetItems: [
				{ id: "bi-1", index: "1.1", totalCost: 50000, quantity: 100 },
			],
			measurements: [
				{
					id: "m1",
					source: "operational",
					budgetItemId: "bi-1",
					index: "1.1",
					date: new Date("2026-01-01"),
					number: 1,
					measuredValue: null,
					measuredPercentage: 25,
					accumulatedValue: null,
					accumulatedPercentage: 25,
					measuredQuantity: null,
					accumulatedQuantity: null,
				},
			],
		});

		expect(result.totalMeasured).toBe(12500);
		expect(result.totalMeasuredPercentage).toBe(25);
	});

	it("builds canonical measurement tree with children", () => {
		const budgetItems = [
			{
				id: "stage-1",
				parentId: null,
				index: "1",
				sortOrder: 1,
				totalCost: 2000,
				quantity: null,
				description: "Etapa 1",
			},
			{
				id: "item-1",
				parentId: "stage-1",
				index: "1.1",
				sortOrder: 2,
				totalCost: 1000,
				quantity: 10,
				description: "Item 1",
			},
			{
				id: "item-2",
				parentId: "stage-1",
				index: "1.2",
				sortOrder: 3,
				totalCost: 1000,
				quantity: 5,
				description: "Item 2",
			},
		];

		const tree = buildCanonicalMeasurementTree(budgetItems, {
			"item-1": {
				accumulatedValue: 300,
				accumulatedPercentage: 30,
				measuredCurrentValue: 300,
				measuredCurrentPercentage: 30,
			},
			"item-2": {
				accumulatedValue: 500,
				accumulatedPercentage: 50,
				measuredCurrentValue: 500,
				measuredCurrentPercentage: 50,
			},
		});

		expect(tree).toHaveLength(1);
		expect(tree[0].children).toHaveLength(2);
		expect(tree[0].measuredAccumulated.value).toBe(800);
		expect(tree[0].balanceToMeasure.value).toBe(1200);
	});
});
