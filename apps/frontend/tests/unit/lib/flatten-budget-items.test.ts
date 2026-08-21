import { describe, expect, test } from "bun:test";
import { flattenBudgetItems } from "@/lib/flatten-budget-items";

describe("flattenBudgetItems", () => {
	test("preserves parent-before-children order and normalizes nullable fields", () => {
		expect(
			flattenBudgetItems([
				{
					id: "1",
					index: "1",
					description: "Etapa",
					children: [
						{ id: "1.1", index: "1.1", description: "Serviço" },
					],
				},
			]),
		).toEqual([
			{ id: "1", index: "1", description: "Etapa", unit: null, quantity: null, unitCost: null },
			{ id: "1.1", index: "1.1", description: "Serviço", unit: null, quantity: null, unitCost: null },
		]);
	});
});
