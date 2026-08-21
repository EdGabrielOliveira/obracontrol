import { describe, expect, it } from "bun:test";
import {
	filterBudgetSelectorItems,
	flattenBudgetSelectorItems,
} from "@/components/organisms/budget/budget-item-selector";
import type { BudgetTreeItem } from "@/types/budget";

const budgetItems: BudgetTreeItem[] = [
	{
		id: "stage-1",
		parentId: null,
		index: "1",
		type: "STAGE",
		description: "Fundação",
		unit: null,
		quantity: null,
		unitCost: null,
		totalCost: null,
		plannedStart: null,
		plannedEnd: null,
		completionPercentage: null,
		sortOrder: 0,
		children: [
			{
				id: "item-1-1",
				parentId: "stage-1",
				index: "1.1",
				type: "ITEM",
				description: "Concreto armado",
				unit: "m³",
				quantity: 10,
				unitCost: 500,
				totalCost: 5000,
				plannedStart: null,
				plannedEnd: null,
				completionPercentage: null,
				sortOrder: 0,
				children: [],
			},
		],
	},
];

describe("budget item edit selector data", () => {
	it("keeps the matching item and its parent when searching", () => {
		const rows = filterBudgetSelectorItems(budgetItems, "concreto");

		expect(rows.map((row) => row.id)).toEqual(["stage-1", "item-1-1"]);
		expect(rows.find((row) => row.id === "item-1-1")?.leaf).toBe(true);
	});

	it("flattens the complete hierarchy for direct editing", () => {
		const rows = flattenBudgetSelectorItems(budgetItems);

		expect(rows.map((row) => row.index)).toEqual(["1", "1.1"]);
	});
});
