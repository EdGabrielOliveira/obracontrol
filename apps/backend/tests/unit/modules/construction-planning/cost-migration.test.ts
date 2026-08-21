import { describe, expect, it } from "bun:test";
import { ConstructionError } from "../../../../src/lib/errors";
import { planLegacyCostMigration } from "../../../../src/modules/construction-planning/cost-migration";

const candidates = new Map([
	[
		"item-1",
		[{ budgetItemId: "item-1", versionItemId: "vi-1", identityId: "id-1" }],
	],
	[
		"item-2",
		[{ budgetItemId: "item-2", versionItemId: "vi-2", identityId: "id-2" }],
	],
]);

describe("cost migration planner", () => {
	it("gera sucessores determinísticos e ajusta o último por até R$ 0,01", () => {
		const result = planLegacyCostMigration({
			sourceCostId: "cost-1",
			amount: "100.00",
			allocations: [
				{ budgetItemId: "item-1", percentage: 33.33 },
				{ budgetItemId: "item-2", percentage: 66.67 },
			],
			candidates,
		});
		expect(result.map((row) => row.amount.toString())).toEqual([
			"33.33",
			"66.67",
		]);
		expect(result.map((row) => row.lineageKey)).toEqual([
			"cost-1:0001",
			"cost-1:0002",
		]);
	});

	it("bloqueia item ambiguo e divergência monetária", () => {
		expect(() =>
			planLegacyCostMigration({
				sourceCostId: "cost-1",
				amount: 100,
				allocations: [{ budgetItemId: "unknown", value: 100 }],
				candidates,
			}),
		).toThrow(ConstructionError);
		expect(() =>
			planLegacyCostMigration({
				sourceCostId: "cost-2",
				amount: 100,
				allocations: [{ budgetItemId: "item-1", value: 98 }],
				candidates,
			}),
		).toThrow(ConstructionError);
	});
});
