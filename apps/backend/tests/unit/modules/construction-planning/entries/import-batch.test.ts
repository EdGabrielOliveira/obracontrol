import { beforeEach, describe, expect, it, mock } from "bun:test";
import { ConstructionError } from "../../../../../src/lib/errors";
import type {
	CreateActualCostInput,
	CreateMeasurementInput,
	ImportActualCostRow,
} from "../../../../../src/modules/construction-planning/schema";

const findWork = mock(
	async (): Promise<{ activeImportId: string } | null> => ({
		activeImportId: "import-1",
	}),
);
const findBudgetItems = mock(
	async (_args: BudgetBatchArgs): Promise<{ id: string; index: string }[]> => [
		{ id: "item-alloc-1", index: "item-alloc-1" },
	],
);
const createMeasurement = mock(async () => ({
	id: "measurement-1",
	workId: "work-1",
}));
const createActualCost = mock(async () => ({
	id: "cost-1",
	workId: "work-1",
}));
const transaction = mock(
	async (callback: (tx: never) => Promise<unknown>): Promise<unknown> =>
		callback(tx),
);

type BudgetBatchArgs = {
	where: { index?: { in: string[] }; id?: { in: string[] } };
};

const tx = {
	constructionWork: { findFirst: findWork },
	constructionBudgetItem: {
		findMany: findBudgetItems,
	},
	constructionMeasurement: { create: createMeasurement },
	constructionActualCost: { create: createActualCost },
} as never;

mock.module("../../../../../src/lib/prisma", () => ({
	prisma: {
		$transaction: transaction,
		constructionWork: { findFirst: findWork },
		constructionBudgetItem: {
			findMany: findBudgetItems,
		},
		constructionMeasurement: { create: createMeasurement },
		constructionActualCost: { create: createActualCost },
	},
}));

async function budgetItemsForBatch(
	args: BudgetBatchArgs,
): Promise<{ id: string; index: string }[]> {
	if (args.where.id?.in) {
		return args.where.id.in.map((id) => ({ id, index: id }));
	}
	return (args.where.index?.in ?? []).map((index) => ({
		id: `item-${index}`,
		index,
	}));
}

function measurementRow(overrides: Partial<CreateMeasurementInput> = {}) {
	return {
		index: "1.1",
		measurementDate: "2026-01-15",
		measuredPercentageAccumulated: 50,
		measuredQuantityAccumulated: 5,
		notes: "Parcial",
		...overrides,
	} satisfies CreateMeasurementInput;
}

function costRow(overrides: Partial<CreateActualCostInput> = {}) {
	return {
		costDate: "2026-01-20",
		budgetIndex: "1.1",
		category: "Material",
		description: "NF",
		amount: 200,
		costType: "CURRENT",
		sourceDocument: "NF-1",
		paymentStatus: "OPEN",
		...overrides,
	} satisfies ImportActualCostRow;
}

describe("importMeasurements", () => {
	let importMeasurements: typeof import("../../../../../src/modules/construction-planning/entries/entries.repository").importMeasurements;

	beforeEach(async () => {
		findWork.mockClear();
		findBudgetItems.mockClear();
		createMeasurement.mockClear();
		createActualCost.mockClear();
		transaction.mockClear();
		findWork.mockImplementation(async () => ({ activeImportId: "import-1" }));
		findBudgetItems.mockImplementation(budgetItemsForBatch);
		const mod = await import(
			"../../../../../src/modules/construction-planning/entries/entries.repository"
		);
		importMeasurements = mod.importMeasurements;
	});

	it("applies the whole batch inside a single transaction", async () => {
		const results = await importMeasurements("owner-1", "work-1", [
			measurementRow(),
			measurementRow({ index: "1.2", measurementDate: "2026-02-15" }),
		]);

		expect(transaction).toHaveBeenCalledTimes(1);
		expect(createMeasurement).toHaveBeenCalledTimes(2);
		expect(results).toHaveLength(2);
		expect(createMeasurement).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					ownerId: "owner-1",
					index: "1.2",
					import: {
						connect: { id: "import-1", ownerId: "owner-1", workId: "work-1" },
					},
				}),
			}),
		);
	});

	it("MED-006 (DEC-009): uma linha por (medicao, item) — mesma data com itens diferentes", async () => {
		const results = await importMeasurements("owner-1", "work-1", [
			measurementRow({ index: "1.1", measurementDate: "2026-03-10" }),
			measurementRow({ index: "1.2", measurementDate: "2026-03-10" }),
		]);

		expect(results).toHaveLength(2);
		expect(createMeasurement).toHaveBeenCalledTimes(2);
		// Ambas as linhas representam itens da medicao do periodo 2026-03-10.
		for (const [call] of (createMeasurement as ReturnType<typeof mock>).mock
			.calls) {
			expect(call.data.measurementDate).toBeInstanceOf(Date);
			expect(call.data.measurementDate.toISOString()).toBe(
				"2026-03-10T00:00:00.000Z",
			);
		}
	});

	it("resolves budget items for the whole batch with a single in query", async () => {
		await importMeasurements("owner-1", "work-1", [
			measurementRow({ index: "1.1" }),
			measurementRow({ index: "1.2" }),
		]);

		expect(findBudgetItems).toHaveBeenCalledTimes(1);
		expect(findBudgetItems).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					ownerId: "owner-1",
					workId: "work-1",
					importId: "import-1",
					index: { in: ["1.1", "1", "1.2"] },
				},
			}),
		);
	});

	it("aborts the batch without further writes when a row fails", async () => {
		createMeasurement
			.mockImplementationOnce(async () => ({
				id: "measurement-1",
				workId: "work-1",
			}))
			.mockImplementationOnce(async () => {
				throw new ConstructionError(
					"NOT_FOUND",
					"Item de orcamento nao encontrado para o indice 1.2",
					404,
				);
			});

		await expect(
			importMeasurements("owner-1", "work-1", [
				measurementRow(),
				measurementRow({ index: "1.2" }),
				measurementRow({ index: "1.3" }),
			]),
		).rejects.toThrow("Item de orcamento nao encontrado para o indice 1.2");

		expect(createMeasurement).toHaveBeenCalledTimes(2);
	});

	it("rejects the batch when the work is not found", async () => {
		findWork.mockImplementation(async () => null);

		await expect(
			importMeasurements("owner-1", "work-1", [measurementRow()]),
		).rejects.toThrow("Obra nao encontrada");
		expect(createMeasurement).not.toHaveBeenCalled();
	});

	it("rejects the batch when a budget index has no item", async () => {
		findBudgetItems.mockImplementation(async () => []);

		await expect(
			importMeasurements("owner-1", "work-1", [measurementRow()]),
		).rejects.toThrow("Item de orcamento nao encontrado para o indice 1.1");
		expect(createMeasurement).not.toHaveBeenCalled();
	});

	it("binds a measurement row to the closest ancestor budget item when the exact index is absent", async () => {
		findBudgetItems.mockImplementation(async (args: BudgetBatchArgs) => {
			const found = (args.where.index?.in ?? []).filter(
				(index) => index === "1.1",
			);
			return found.map((index) => ({ id: "item-1", index }));
		});

		const results = await importMeasurements("owner-1", "work-1", [
			measurementRow({ index: "1.1.1" }),
		]);

		expect(results).toHaveLength(1);
		expect(createMeasurement).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					index: "1.1.1",
					budgetItem: {
						connect: { id: "item-1", ownerId: "owner-1", workId: "work-1" },
					},
				}),
			}),
		);
	});
});

describe("importActualCosts", () => {
	let importActualCosts: typeof import("../../../../../src/modules/construction-planning/entries/entries.repository").importActualCosts;

	beforeEach(async () => {
		findWork.mockClear();
		findBudgetItems.mockClear();
		createMeasurement.mockClear();
		createActualCost.mockClear();
		transaction.mockClear();
		findWork.mockImplementation(async () => ({ activeImportId: "import-1" }));
		findBudgetItems.mockImplementation(budgetItemsForBatch);
		const mod = await import(
			"../../../../../src/modules/construction-planning/entries/entries.repository"
		);
		importActualCosts = mod.importActualCosts;
	});

	it("applies the whole batch inside a single transaction", async () => {
		const results = await importActualCosts("owner-1", "work-1", [
			costRow(),
			costRow({ budgetIndex: "1.2", amount: 300 }),
		]);

		expect(transaction).toHaveBeenCalledTimes(1);
		expect(createActualCost).toHaveBeenCalledTimes(2);
		expect(results).toHaveLength(2);
		expect(createActualCost).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					ownerId: "owner-1",
					budgetIndex: "1.2",
					amount: 300,
					import: {
						connect: { id: "import-1", ownerId: "owner-1", workId: "work-1" },
					},
				}),
			}),
		);
	});

	it("resolves budget items for the whole cost batch with a single in query", async () => {
		await importActualCosts("owner-1", "work-1", [
			costRow({ budgetIndex: "1.1" }),
			costRow({ budgetIndex: "1.1.1" }),
			costRow({ budgetIndex: undefined, amount: 400 }),
		]);

		expect(findBudgetItems).toHaveBeenCalledTimes(1);
		expect(findBudgetItems).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					ownerId: "owner-1",
					workId: "work-1",
					importId: "import-1",
					index: { in: ["1.1", "1", "1.1.1"] },
				},
			}),
		);
	});

	it("aborts the batch without further writes when a row fails", async () => {
		createActualCost
			.mockImplementationOnce(async () => ({ id: "cost-1", workId: "work-1" }))
			.mockImplementationOnce(async () => {
				throw new ConstructionError("INVALID_INPUT", "Falha no custo", 400);
			});

		await expect(
			importActualCosts("owner-1", "work-1", [
				costRow(),
				costRow({ amount: 300 }),
				costRow({ amount: 400 }),
			]),
		).rejects.toThrow("Falha no custo");

		expect(createActualCost).toHaveBeenCalledTimes(2);
	});

	it("rejects the batch when allocation percentages do not sum to 100", async () => {
		await expect(
			importActualCosts("owner-1", "work-1", [
				costRow({
					allocations: [{ budgetItemId: "item-alloc-1", percentage: 50 }],
				}),
			]),
		).rejects.toThrow("aproximadamente 100%");
		expect(createActualCost).not.toHaveBeenCalled();
	});

	it("CUS-005 (DEC-010): rateio com multiplas alocacoes somando 100% e aceito no import", async () => {
		const results = await importActualCosts("owner-1", "work-1", [
			costRow({
				allocations: [
					{ budgetItemId: "item-1", percentage: 60 },
					{ budgetItemId: "item-2", percentage: 40 },
				],
			}),
		]);

		expect(results).toHaveLength(1);
		expect(createActualCost).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					allocations: {
						create: expect.arrayContaining([
							expect.objectContaining({ percentage: 60 }),
							expect.objectContaining({ percentage: 40 }),
						]),
					},
				}),
			}),
		);
	});

	it("rejects the batch when an allocation item is invalid", async () => {
		findBudgetItems.mockImplementation(async (args: BudgetBatchArgs) =>
			args.where.id ? [] : budgetItemsForBatch(args),
		);

		await expect(
			importActualCosts("owner-1", "work-1", [
				costRow({
					allocations: [{ budgetItemId: "item-inexistente", percentage: 100 }],
				}),
			]),
		).rejects.toThrow("Itens de orçamento nao encontrados");
		expect(createActualCost).not.toHaveBeenCalled();
	});

	it("binds an actual-cost row to the closest ancestor budget item when the exact index is absent", async () => {
		findBudgetItems.mockImplementation(async (args: BudgetBatchArgs) => {
			const found = (args.where.index?.in ?? []).filter(
				(index) => index === "1.1",
			);
			return found.map((index) => ({ id: "item-1", index }));
		});

		const results = await importActualCosts("owner-1", "work-1", [
			costRow({ budgetIndex: "1.1.1" }),
		]);

		expect(results).toHaveLength(1);
		expect(createActualCost).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					budgetIndex: "1.1.1",
					budgetItem: {
						connect: { id: "item-1", ownerId: "owner-1", workId: "work-1" },
					},
					appropriationStatus: "APPROPRIATED",
				}),
			}),
		);
	});
});
