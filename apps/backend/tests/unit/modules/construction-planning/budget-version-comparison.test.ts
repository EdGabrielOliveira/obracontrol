import { describe, expect, it } from "bun:test";
import Decimal from "decimal.js";
import {
	type BudgetSnapshotItem,
	compareBudgetVersionSnapshots,
	hasBudgetVersionChanges,
	normalizeBudgetDescription,
} from "../../../../src/modules/construction-planning/budget-version-comparison";

function item(
	index: string,
	description: string,
	values: Partial<BudgetSnapshotItem> = {},
): BudgetSnapshotItem {
	return {
		index,
		parentIndex: null,
		type: index.includes(".") ? "ITEM" : "STAGE",
		description,
		unit: "un",
		quantity: new Decimal(10),
		unitCost: new Decimal(50),
		totalCost: new Decimal(500),
		plannedStart: new Date("2026-08-01T00:00:00.000Z"),
		plannedEnd: new Date("2026-08-10T00:00:00.000Z"),
		...values,
	};
}

describe("budget version comparison", () => {
	it("normalizes accents, casing, and repeated whitespace", () => {
		expect(normalizeBudgetDescription("  Concreto   armado ")).toBe(
			"CONCRETO ARMADO",
		);
		expect(normalizeBudgetDescription("Impermeabilização")).toBe(
			"IMPERMEABILIZACAO",
		);
	});

	it("associates compatible rows and calculates financial deltas", () => {
		const result = compareBudgetVersionSnapshots(
			[item("1.1", "Concreto armado")],
			[
				item("1.1", " CONCRETO   ARMADO ", {
					quantity: new Decimal(12),
					totalCost: new Decimal(600),
				}),
			],
			new Map(),
		);

		expect(result.blockingIssues).toEqual([]);
		expect(result.rows[0]).toMatchObject({
			classification: ["INCREASED"],
			delta: { quantity: 2, unitCost: 0, totalCost: 100 },
		});
	});

	it("classifies additions, removals, and schedule-only changes", () => {
		const result = compareBudgetVersionSnapshots(
			[item("1.1", "Mantido"), item("1.2", "Removido")],
			[
				item("1.1", "Mantido", {
					plannedEnd: new Date("2026-08-12T00:00:00.000Z"),
				}),
				item("1.3", "Novo"),
			],
			new Map(),
		);

		expect(
			result.rows.map((row) => [row.itemIndex, row.classification]),
		).toEqual([
			["1.1", ["SCHEDULE_CHANGED"]],
			["1.2", ["REMOVED"]],
			["1.3", ["ADDED"]],
		]);
	});

	it("blocks an index whose description does not match", () => {
		const result = compareBudgetVersionSnapshots(
			[item("1.1", "Concreto")],
			[item("1.1", "Pintura")],
			new Map(),
		);

		expect(result.blockingIssues).toContainEqual(
			expect.objectContaining({ code: "BUDGET_IDENTITY_CONFLICT" }),
		);
		expect(result.rows[0]?.classification).toContain("STRUCTURE_CHANGED");
		expect(hasBudgetVersionChanges(result)).toBe(true);
	});

	it("allows a change only in planned dates for amendment validation", () => {
		const result = compareBudgetVersionSnapshots(
			[item("1.1", "Concreto")],
			[
				item("1.1", "Concreto", {
					plannedEnd: new Date("2026-08-12T00:00:00.000Z"),
				}),
			],
			new Map(),
		);

		expect(result.rows[0]?.classification).toEqual(["SCHEDULE_CHANGED"]);
		expect(hasBudgetVersionChanges(result)).toBe(true);
	});

	it("derives totals from leaf items only, excluding stage aggregates", () => {
		const result = compareBudgetVersionSnapshots(
			[
				item("1", "Etapa", { totalCost: new Decimal(1000) }),
				item("1.1", "Item", {
					parentIndex: "1",
					totalCost: new Decimal(500),
				}),
			],
			[
				item("1", "Etapa", { totalCost: new Decimal(1200) }),
				item("1.1", "Item", {
					parentIndex: "1",
					totalCost: new Decimal(700),
				}),
			],
			new Map(),
		);

		expect(result.sourceTotal).toBe(500);
		expect(result.candidateTotal).toBe(700);
		expect(result.netImpact).toBe(200);
	});

	it("treats any node with children as an aggregate, regardless of its type", () => {
		const result = compareBudgetVersionSnapshots(
			[
				item("1", "Etapa", { totalCost: new Decimal(1000) }),
				item("1.1", "Subetapa", {
					type: "ITEM",
					parentIndex: "1",
					totalCost: new Decimal(700),
				}),
				item("1.1.1", "Servico", {
					parentIndex: "1.1",
					totalCost: new Decimal(500),
				}),
			],
			[
				item("1", "Etapa", { totalCost: new Decimal(1200) }),
				item("1.1", "Subetapa", {
					type: "ITEM",
					parentIndex: "1",
					totalCost: new Decimal(800),
				}),
				item("1.1.1", "Servico", {
					parentIndex: "1.1",
					totalCost: new Decimal(600),
				}),
			],
			new Map(),
		);

		expect(result.sourceTotal).toBe(500);
		expect(result.candidateTotal).toBe(600);
		expect(result.netImpact).toBe(100);
	});

	it("keeps decimal precision in increase and suppression summaries", () => {
		const result = compareBudgetVersionSnapshots(
			[item("1.1", "A", { totalCost: new Decimal(0.3) })],
			[item("1.1", "A", { totalCost: new Decimal(0.4) })],
			new Map(),
		);

		expect(result.grossIncrease).toBe(0.1);
		expect(result.netImpact).toBe(0.1);
	});

	it("separates gross increase and suppression in mixed amendments", () => {
		const result = compareBudgetVersionSnapshots(
			[
				item("1.1", "A", { totalCost: new Decimal(500) }),
				item("1.2", "B", { totalCost: new Decimal(500) }),
			],
			[
				item("1.1", "A", { totalCost: new Decimal(800) }),
				item("1.2", "B", { totalCost: new Decimal(300) }),
			],
			new Map(),
		);

		expect(result).toMatchObject({
			grossIncrease: 300,
			suppression: 200,
			netImpact: 100,
			impactPercent: 10,
		});
	});

	it("blocks reduction below contracted exposure", () => {
		const result = compareBudgetVersionSnapshots(
			[item("1.1", "Concreto", { quantity: new Decimal(10) })],
			[
				item("1.1", "Concreto", {
					quantity: new Decimal(5),
					totalCost: new Decimal(250),
				}),
			],
			new Map([
				[
					"1.1",
					{
						contractedQuantity: new Decimal(8),
						measuredQuantity: new Decimal(0),
						executedQuantity: new Decimal(0),
						paidQuantity: new Decimal(0),
					},
				],
			]),
		);

		expect(result.blockingIssues).toContainEqual(
			expect.objectContaining({ code: "BUDGET_REDUCTION_BELOW_EXPOSURE" }),
		);
	});

	it("blocks removal when the item has any exposure", () => {
		const result = compareBudgetVersionSnapshots(
			[item("1.1", "Concreto", { quantity: new Decimal(10) })],
			[],
			new Map([
				[
					"1.1",
					{
						contractedQuantity: new Decimal(0),
						measuredQuantity: new Decimal(2),
						executedQuantity: new Decimal(0),
						paidQuantity: new Decimal(0),
					},
				],
			]),
		);

		expect(result.blockingIssues).toContainEqual(
			expect.objectContaining({ code: "BUDGET_REDUCTION_BELOW_EXPOSURE" }),
		);
	});
});
