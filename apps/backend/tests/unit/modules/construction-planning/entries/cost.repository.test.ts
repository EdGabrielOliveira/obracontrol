import { beforeEach, describe, expect, it, mock } from "bun:test";

const constructionCostFindFirst = mock(
	async (): Promise<unknown | null> => null,
);

mock.module("../../../../../src/lib/prisma", () => ({
	prisma: {
		constructionCost: {
			findFirst: constructionCostFindFirst,
		},
	},
}));

const costWithItems = {
	id: "cost-1",
	ownerId: "owner-1",
	workId: "work-1",
	title: "Compra de materiais",
	createdAt: new Date("2026-01-10T00:00:00.000Z"),
	updatedAt: new Date("2026-01-10T00:00:00.000Z"),
	items: [
		{ id: "item-1", category: "MATERIAL", amount: 100 },
		{ id: "item-2", category: "SERVICO", amount: 200 },
	],
};

describe("getCostById", () => {
	beforeEach(() => {
		constructionCostFindFirst.mockReset();
	});

	it("returns the aggregate fields required by the cost detail view", async () => {
		constructionCostFindFirst.mockResolvedValueOnce(costWithItems);
		const { getCostById } = await import(
			"../../../../../src/modules/construction-planning/entries/entries.repository"
		);

		const result = await getCostById("owner-1", "work-1", "cost-1");

		expect(result).toMatchObject({
			id: "cost-1",
			itemCount: 2,
			amount: 300,
			categories: ["MATERIAL", "SERVICO"],
			items: costWithItems.items,
		});
	});

	it("returns null when the cost is outside the owner and work scope", async () => {
		constructionCostFindFirst.mockResolvedValueOnce(null);
		const { getCostById } = await import(
			"../../../../../src/modules/construction-planning/entries/entries.repository"
		);

		const result = await getCostById("owner-1", "work-1", "missing");

		expect(result).toBeNull();
		expect(constructionCostFindFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: "missing", ownerId: "owner-1", workId: "work-1" },
			}),
		);
	});
});
