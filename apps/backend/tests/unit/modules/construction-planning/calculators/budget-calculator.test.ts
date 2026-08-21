import { describe, expect, it } from "bun:test";
import {
	buildBudgetTree,
	calculateBdi,
	calculateBudgetSummary,
	rollupBudgetTree,
} from "../../../../../src/modules/construction-planning/calculators/budget-calculator";

describe("budget calculator", () => {
	it("rolls up stages but sums budget from leaf items only", () => {
		const tree = buildBudgetTree([
			{
				id: "stage",
				parentId: null,
				index: "1",
				sortOrder: 1,
				type: "STAGE",
				description: "Stage",
				unit: null,
				quantity: null,
				unitCost: null,
				totalCost: 999999,
			},
			{
				id: "item-a",
				parentId: "stage",
				index: "1.1",
				sortOrder: 2,
				type: "ITEM",
				description: "A",
				unit: "m2",
				quantity: 10,
				unitCost: 100,
				totalCost: 1000,
			},
			{
				id: "item-b",
				parentId: "stage",
				index: "1.2",
				sortOrder: 3,
				type: "ITEM",
				description: "B",
				unit: "m2",
				quantity: 5,
				unitCost: 200,
				totalCost: 1000,
			},
		]);

		rollupBudgetTree(tree);
		expect(tree).toHaveLength(1);
		expect(tree[0].totalCost).toBe(2000);
		expect(tree[0].children).toHaveLength(2);
	});

	it("calculateBudgetSummary sums only leaf items", () => {
		const tree = buildBudgetTree([
			{
				id: "stage",
				parentId: null,
				index: "1",
				sortOrder: 1,
				type: "STAGE",
				description: "Stage",
				unit: null,
				quantity: null,
				unitCost: null,
				totalCost: 999999,
			},
			{
				id: "item-a",
				parentId: "stage",
				index: "1.1",
				sortOrder: 2,
				type: "ITEM",
				description: "A",
				unit: "m2",
				quantity: 10,
				unitCost: 100,
				totalCost: 1000,
			},
			{
				id: "item-b",
				parentId: "stage",
				index: "1.2",
				sortOrder: 3,
				type: "ITEM",
				description: "B",
				unit: "m2",
				quantity: 5,
				unitCost: 200,
				totalCost: 1000,
			},
		]);

		rollupBudgetTree(tree);
		const summary = calculateBudgetSummary(tree);
		expect(summary.totalBudgeted).toBe(2000);
		expect(summary.leafCount).toBe(2);
	});

	it("handles single-level items", () => {
		const items = [
			{
				id: "i1",
				parentId: null,
				index: "1",
				sortOrder: 1,
				type: "ITEM",
				description: "Unique item",
				unit: "un",
				quantity: 1,
				unitCost: 500,
				totalCost: 500,
			},
		];

		const tree = buildBudgetTree(items);
		rollupBudgetTree(tree);
		expect(tree[0].totalCost).toBe(500);
		expect(calculateBudgetSummary(tree).totalBudgeted).toBe(500);
	});

	it("carries planned dates and completion percentage into tree nodes", () => {
		const tree = buildBudgetTree([
			{
				id: "item-a",
				parentId: null,
				index: "1.1",
				sortOrder: 1,
				type: "ITEM",
				description: "A",
				unit: "m2",
				quantity: 10,
				unitCost: 100,
				totalCost: 1000,
				plannedStart: "2026-01-01T00:00:00.000Z",
				plannedEnd: "2026-02-01T00:00:00.000Z",
				completionPercentage: 42.5,
			},
		]);

		expect(tree[0]).toMatchObject({
			plannedStart: "2026-01-01T00:00:00.000Z",
			plannedEnd: "2026-02-01T00:00:00.000Z",
			completionPercentage: 42.5,
		});
	});

	it("defaults planned dates and completion percentage to null when absent", () => {
		const tree = buildBudgetTree([
			{
				id: "item-a",
				parentId: null,
				index: "1.1",
				sortOrder: 1,
				type: "ITEM",
				description: "A",
				totalCost: 0,
			},
		]);

		expect(tree[0]).toMatchObject({
			plannedStart: null,
			plannedEnd: null,
			completionPercentage: null,
		});
	});

	it("handles deeply nested structure", () => {
		const nodes = [
			{
				id: "s1",
				parentId: null,
				index: "1",
				sortOrder: 1,
				type: "STAGE",
				description: "S1",
				totalCost: 999,
			},
			{
				id: "ss1",
				parentId: "s1",
				index: "1.1",
				sortOrder: 2,
				type: "SUBSTAGE",
				description: "SS1",
				totalCost: 999,
			},
			{
				id: "i1",
				parentId: "ss1",
				index: "1.1.1",
				sortOrder: 3,
				type: "ITEM",
				description: "I1",
				totalCost: 300,
			},
			{
				id: "i2",
				parentId: "ss1",
				index: "1.1.2",
				sortOrder: 4,
				type: "ITEM",
				description: "I2",
				totalCost: 700,
			},
		];

		const tree = buildBudgetTree(nodes);
		rollupBudgetTree(tree);
		expect(calculateBudgetSummary(tree).totalBudgeted).toBe(1000);
		expect(tree[0].children[0].totalCost).toBe(1000);
	});
});

describe("BDI calculation", () => {
	it("calculates BDI correctly for 25%", () => {
		const result = calculateBdi(100000, 25);
		expect(result.totalDirectCost).toBe(100000);
		expect(result.bdiPercentage).toBe(25);
		expect(result.bdiValue).toBe(25000);
		expect(result.totalFinalPrice).toBe(125000);
	});

	it("returns zero BDI when percentage is null", () => {
		const result = calculateBdi(50000, null);
		expect(result.bdiValue).toBe(0);
		expect(result.totalFinalPrice).toBe(50000);
	});

	it("returns zero BDI when percentage is zero", () => {
		const result = calculateBdi(50000, 0);
		expect(result.bdiValue).toBe(0);
		expect(result.totalFinalPrice).toBe(50000);
	});

	it("handles zero direct cost", () => {
		const result = calculateBdi(0, 15);
		expect(result.bdiValue).toBe(0);
		expect(result.totalFinalPrice).toBe(0);
	});

	it("handles decimal BDI percentage", () => {
		const result = calculateBdi(200000, 12.5);
		expect(result.bdiValue).toBe(25000);
		expect(result.totalFinalPrice).toBe(225000);
	});
});
