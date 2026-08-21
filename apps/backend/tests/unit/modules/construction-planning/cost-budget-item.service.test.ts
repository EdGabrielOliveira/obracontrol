import { beforeEach, describe, expect, it, mock } from "bun:test";

const budgetVersionFindFirst = mock(
	async (): Promise<{
		id: string;
		versionNumber: number;
		label: string;
	} | null> => null,
);
const budgetVersionItemFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const resolveResourceScope = mock(async (): Promise<object> => ({}));

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		budgetVersion: { findFirst: budgetVersionFindFirst },
		budgetVersionItem: { findMany: budgetVersionItemFindMany },
	},
}));

mock.module("../../../../src/lib/resource-scope", () => ({
	resolveResourceScope,
}));

const { listCurrentCostBudgetItems, displayBudgetIndex, isSelectableCostItem } =
	await import(
		"../../../../src/modules/construction-planning/cost-budget-item.service"
	);

function versionItem(
	id: string,
	index: string,
	type: string,
	parentVersionId: string | null,
): Record<string, unknown> {
	return {
		id,
		identityId: `identity-${id}`,
		parentVersionId,
		index,
		type,
		description: `Item ${index}`,
		unit: "un",
		totalCost: 100,
	};
}

describe("cost-budget-item selector", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		resolveResourceScope.mockResolvedValue({} as never);
	});

	it("retorna somente folhas da versao ativa com indice de exibicao", async () => {
		budgetVersionFindFirst.mockResolvedValue({
			id: "version-2",
			versionNumber: 2,
			label: "Aditivo 1",
		});
		budgetVersionItemFindMany.mockResolvedValue([
			versionItem("stage-1", "1", "STAGE", null),
			{
				...versionItem("item-1", "1.1", "ITEM", "stage-1"),
				unitCost: 3.6866594,
				totalCost: 36.866594,
			},
			versionItem("stage-2", "2", "STAGE", null),
		]);

		const result = await listCurrentCostBudgetItems("owner-1", "work-1");

		expect(result.version).toEqual({
			id: "version-2",
			number: 2,
			label: "Aditivo 1",
			displayIndex: "2",
		});
		expect(result.items).toEqual([
			expect.objectContaining({
				id: "item-1",
				index: "1.1",
				unitCost: 3.69,
				totalCost: 36.87,
				displayIndex: "1.1",
				stage: {
					index: "1",
					displayIndex: "1",
					description: "Item 1",
				},
			}),
		]);
	});

	it("rejeita quando a obra nao possui versao vigente", async () => {
		budgetVersionFindFirst.mockResolvedValue(null);

		await expect(
			listCurrentCostBudgetItems("owner-1", "work-1"),
		).rejects.toMatchObject({
			code: "BUDGET_VERSION_NOT_AVAILABLE",
			status: 422,
		});
	});

	it("ignora etapa que contem itens", async () => {
		budgetVersionFindFirst.mockResolvedValue({
			id: "version-1",
			versionNumber: 1,
			label: "Baseline",
		});
		budgetVersionItemFindMany.mockResolvedValue([
			versionItem("stage-1", "1", "STAGE", null),
			versionItem("item-1", "1.1", "ITEM", "stage-1"),
			versionItem("item-2", "1.2", "ITEM", "stage-1"),
		]);

		const result = await listCurrentCostBudgetItems("owner-1", "work-1");

		expect(result.items.map((item) => item.id)).toEqual(["item-1", "item-2"]);
	});

	it("valida o escopo antes de consultar", async () => {
		resolveResourceScope.mockRejectedValue(new Error("SEM_ESCOPO") as never);

		await expect(
			listCurrentCostBudgetItems("owner-1", "work-1"),
		).rejects.toThrow("SEM_ESCOPO");
		expect(budgetVersionFindFirst).not.toHaveBeenCalled();
	});
});

describe("cost-budget-item display helpers", () => {
	it("mantem o indice do orcamento sem prefixar a versao", () => {
		expect(displayBudgetIndex("1.1")).toBe("1.1");
		expect(displayBudgetIndex("1")).toBe("1");
	});

	it("aceita apenas folhas analiticas", () => {
		expect(isSelectableCostItem("ITEM", false)).toBe(true);
		expect(isSelectableCostItem("COMPOSITION", false)).toBe(true);
		expect(isSelectableCostItem("INPUT", false)).toBe(true);
		expect(isSelectableCostItem("ITEM", true)).toBe(false);
		expect(isSelectableCostItem("STAGE", false)).toBe(false);
		expect(isSelectableCostItem("SUBSTAGE", false)).toBe(false);
	});
});
