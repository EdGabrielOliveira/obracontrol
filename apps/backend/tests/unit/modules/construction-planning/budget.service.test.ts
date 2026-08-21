import { beforeEach, describe, expect, it, mock } from "bun:test";
import { ConstructionError } from "../../../../src/lib/errors";

const getBudgetView = mock(async () => ({ id: "work-1" }));
const getBudgetItemDetail = mock(async () => ({ id: "item-1" }));
const createBudgetItem = mock(async () => ({ id: "item-new" }));
const updateBudgetItem = mock(async () => ({ id: "item-1" }));
const deleteBudgetItem = mock(async () => ({ id: "item-1" }));
const reorderBudgetItems = mock(async () => ({ count: 2 }));
const findByIndex = mock(async (): Promise<unknown | null> => null);
const sumChildrenTotalCost = mock(async (): Promise<unknown | null> => null);
const budgetItemFindFirst = mock(async (): Promise<unknown | null> => null);
const workMeasurementItemAggregate = mock(
	async (): Promise<Record<string, unknown>> => ({
		_sum: { accumulatedValue: null },
	}),
);
const contractServiceAggregate = mock(
	async (): Promise<Record<string, unknown>> => ({
		_sum: { totalCost: null },
	}),
);
const constructionActualCostAggregate = mock(
	async (): Promise<Record<string, unknown>> => ({
		_sum: { value: null },
	}),
);
const actualCostAllocationAggregate = mock(
	async (): Promise<Record<string, unknown>> => ({
		_sum: { allocatedValue: null },
	}),
);

const parseWorkbookByKind = mock(() => ({
	fileName: "budget.xlsx",
	sheetName: "Orcamento",
}));
const validateWorkbookByKind = mock(() => ({
	valid: true,
	errors: [],
	warnings: [],
	work: {
		code: "OBRA-001",
		name: "Obra Teste",
		clientName: null,
		baseDate: new Date("2026-01-01T00:00:00.000Z"),
		plannedStart: new Date("2026-01-01T00:00:00.000Z"),
		plannedEnd: new Date("2026-12-31T00:00:00.000Z"),
		areaM2: null,
		operationalStatus: null,
		responsibleName: null,
		fileName: "budget.xlsx",
		sheetName: "Orcamento",
		importedSections: ["Orcamento"],
	},
	normalizedRows: [],
	baselineSchedules: [],
	scheduleRevisions: [],
	measurements: [],
	actualCosts: [],
	importedSections: ["Orcamento"],
	processedSheets: ["Orcamento"],
}));
const replaceWorkWithImport = mock(async () => ({
	workId: "work-1",
	importId: "import-1",
}));
const replaceBudgetWithImport = mock(async () => ({
	workId: "work-1",
	importId: "import-1",
}));

const assertGovernanceWritable = mock(async () => undefined);
const isWritableBlockedMock = mock(async (): Promise<boolean> => false);

mock.module(
	"../../../../src/modules/construction-planning/budget.repository",
	() => ({
		getBudgetView,
		getBudgetItemDetail,
		createBudgetItem,
		updateBudgetItem,
		deleteBudgetItem,
		reorderBudgetItems,
		findByIndex,
		sumChildrenTotalCost,
	}),
);

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		constructionBudgetItem: {
			findFirst: budgetItemFindFirst,
			findMany: mock(async () => []),
		},
		constructionWork: {
			findFirst: mock(async () => null),
			update: mock(async () => ({ id: "work-1" })),
		},
		workMeasurementItem: { aggregate: workMeasurementItemAggregate },
		contractService: { aggregate: contractServiceAggregate },
		constructionActualCost: { aggregate: constructionActualCostAggregate },
		actualCostAllocation: { aggregate: actualCostAllocationAggregate },
	},
}));

mock.module(
	"../../../../src/modules/construction-planning/imports/parser",
	() => ({
		parseWorkbook: mock(() => ({})),
		parseWorkbookByKind,
		REQUIRED_SHEETS: [],
		SHEET_NAME_ALIASES: {},
		findSheetMap: mock(() => new Map()),
	}),
);

mock.module(
	"../../../../src/modules/construction-planning/imports/validator",
	() => ({
		validateWorkbook: mock(() => ({})),
		validateWorkbookByKind,
	}),
);

mock.module(
	"../../../../src/modules/construction-planning/imports/import-repository",
	() => ({
		findWorkByOwnerAndCode: mock(async () => null),
		createWorkWithImport: mock(async () => ({
			workId: "work-1",
			importId: "import-1",
		})),
		replaceWorkWithImport,
		replaceBudgetWithImport,
	}),
);

mock.module(
	"../../../../src/modules/construction-planning/governance-guard",
	() => ({
		budgetGovernanceGuard: {
			assertWritable: assertGovernanceWritable,
			isWritableBlocked: isWritableBlockedMock,
		},
		constructionGovernanceGuard: {
			assertWritable: assertGovernanceWritable,
			isWritableBlocked: isWritableBlockedMock,
		},
	}),
);

const { budgetService } = await import(
	"../../../../src/modules/construction-planning/budget.service"
);

describe("budget service", () => {
	beforeEach(() => {
		mock.clearAllMocks();
	});

	it("retorna a visao do orcamento", async () => {
		const result = await budgetService.getBudget("owner-1", "work-1");

		expect(getBudgetView).toHaveBeenCalledWith("owner-1", "work-1");
		expect(result as unknown).toEqual({ id: "work-1", governed: false });
	});

	it("ORC-002 UX: governanca bloqueia escrita e o GET sinaliza governed=true", async () => {
		isWritableBlockedMock.mockResolvedValue(true);

		const result = await budgetService.getBudget("owner-1", "work-1");

		expect(result as unknown).toEqual({ id: "work-1", governed: true });
	});

	it("cria item manual do orcamento", async () => {
		const result = await budgetService.createItem("owner-1", "work-1", {
			index: "1.1",
			type: "ITEM",
			description: "Escavacao",
		});

		expect(createBudgetItem).toHaveBeenCalledWith("owner-1", "work-1", {
			index: "1.1",
			type: "ITEM",
			description: "Escavacao",
		});
		expect(assertGovernanceWritable).toHaveBeenCalledWith(
			"owner-1",
			"BUDGET",
			"work-1",
		);
		expect(result as unknown).toEqual({ id: "item-new" });
	});

	it("bloqueia a mutacao quando o orcamento esta governado", async () => {
		const blocked = new ConstructionError(
			"GOVERNANCE_MUTATION_BLOCKED",
			"Orcamento travado",
			423,
		);
		const file = {
			name: "budget.xlsx",
			type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			size: 1024,
			arrayBuffer: async () => new ArrayBuffer(8),
		} as File;

		const operations = [
			() =>
				budgetService.createItem("owner-1", "work-1", {
					index: "1.1",
					type: "ITEM",
					description: "Escavacao",
				}),
			() =>
				budgetService.updateItem("owner-1", "work-1", "item-1", {
					index: "1.2",
				}),
			() => budgetService.deleteItem("owner-1", "work-1", "item-1"),
			() =>
				budgetService.reorderItems("owner-1", "work-1", [
					{ id: "item-1", sortOrder: 1 },
				]),
			() =>
				budgetService.updateBdi("owner-1", "work-1", {
					bdiPercentage: 20,
				}),
			() => budgetService.importBudget("owner-1", "work-1", { file }),
		];

		for (const operation of operations) {
			assertGovernanceWritable.mockRejectedValueOnce(blocked);
			await expect(operation()).rejects.toMatchObject({
				code: "GOVERNANCE_MUTATION_BLOCKED",
				status: 423,
			});
		}

		expect(createBudgetItem).not.toHaveBeenCalled();
		expect(updateBudgetItem).not.toHaveBeenCalled();
		expect(deleteBudgetItem).not.toHaveBeenCalled();
		expect(reorderBudgetItems).not.toHaveBeenCalled();
		expect(replaceBudgetWithImport).not.toHaveBeenCalled();
	});

	it("rejeita 422 ao criar item com indice duplicado na obra", async () => {
		findByIndex.mockResolvedValueOnce({ id: "item-1" });

		await expect(
			budgetService.createItem("owner-1", "work-1", {
				index: "1.1",
				type: "ITEM",
				description: "Escavacao",
			}),
		).rejects.toMatchObject({
			code: "DUPLICATE_BUDGET_INDEX",
			status: 422,
			message: "Indice duplicado no orcamento",
		});
		expect(findByIndex).toHaveBeenCalledWith("owner-1", "work-1", "1.1");
		expect(createBudgetItem).not.toHaveBeenCalled();
	});

	it("rejeita 422 ao atualizar item para um indice duplicado na obra", async () => {
		findByIndex.mockResolvedValueOnce({ id: "item-2" });

		await expect(
			budgetService.updateItem("owner-1", "work-1", "item-1", {
				index: "1.2",
			}),
		).rejects.toMatchObject({
			code: "DUPLICATE_BUDGET_INDEX",
			status: 422,
			message: "Indice duplicado no orcamento",
		});
		expect(findByIndex).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			"1.2",
			"item-1",
		);
		expect(updateBudgetItem).not.toHaveBeenCalled();
	});

	it("rejeita 422 ao criar filho cujo total desalinha o total do pai", async () => {
		budgetItemFindFirst.mockResolvedValue({
			id: "parent-1",
			type: "STAGE",
			index: "1",
		});
		sumChildrenTotalCost.mockResolvedValue({
			parentTotalCost: 200,
			childrenTotalCost: 200,
			childrenCount: 1,
		});

		await expect(
			budgetService.createItem("owner-1", "work-1", {
				parentId: "parent-1",
				index: "1.1",
				type: "ITEM",
				description: "Escavacao",
				quantity: 10,
				unitCost: 10,
			}),
		).rejects.toMatchObject({
			code: "BUDGET_ITEM_TOTAL_MISMATCH",
			status: 422,
			message: "Total do item pai deve ser a soma dos itens filhos",
		});
		expect(sumChildrenTotalCost).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			"parent-1",
			undefined,
		);
		expect(createBudgetItem).not.toHaveBeenCalled();
	});

	it("permite criar filho quando o total do payload completa a soma dos filhos", async () => {
		budgetItemFindFirst.mockResolvedValue({
			id: "parent-1",
			type: "STAGE",
			index: "1",
		});
		sumChildrenTotalCost.mockResolvedValue({
			parentTotalCost: 200,
			childrenTotalCost: 200,
			childrenCount: 2,
		});

		const result = await budgetService.createItem("owner-1", "work-1", {
			parentId: "parent-1",
			index: "1.3",
			type: "ITEM",
			description: "Escavacao",
			totalCost: 0,
		});

		expect(createBudgetItem).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			expect.objectContaining({
				parentId: "parent-1",
				index: "1.3",
				totalCost: 0,
			}),
		);
		expect(result as unknown).toEqual({ id: "item-new" });
	});

	it("rejeita 422 ao atualizar pai com total inconsistente com os filhos", async () => {
		sumChildrenTotalCost.mockResolvedValue({
			parentTotalCost: 200,
			childrenTotalCost: 200,
			childrenCount: 2,
		});

		await expect(
			budgetService.updateItem("owner-1", "work-1", "item-1", {
				totalCost: 250,
			}),
		).rejects.toMatchObject({
			code: "BUDGET_ITEM_TOTAL_MISMATCH",
			status: 422,
			message: "Total do item pai deve ser a soma dos itens filhos",
		});
		expect(sumChildrenTotalCost).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			"item-1",
		);
		expect(updateBudgetItem).not.toHaveBeenCalled();
	});

	it("permite atualizar pai com total consistente com os filhos", async () => {
		sumChildrenTotalCost.mockResolvedValue({
			parentTotalCost: 200,
			childrenTotalCost: 200,
			childrenCount: 2,
		});

		const result = await budgetService.updateItem(
			"owner-1",
			"work-1",
			"item-1",
			{ totalCost: 200 },
		);

		expect(updateBudgetItem).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			"item-1",
			{ totalCost: 200 },
		);
		expect(result as unknown).toEqual({ id: "item-1" });
	});

	it("permite atualizar filho com o mesmo pai mantendo a soma consistente", async () => {
		budgetItemFindFirst.mockResolvedValue({
			id: "parent-1",
			type: "STAGE",
			index: "1",
		});
		sumChildrenTotalCost.mockResolvedValueOnce(null);
		sumChildrenTotalCost.mockResolvedValueOnce({
			parentTotalCost: 200,
			childrenTotalCost: 100,
			childrenCount: 1,
		});

		const result = await budgetService.updateItem(
			"owner-1",
			"work-1",
			"item-1",
			{ parentId: "parent-1", totalCost: 100 },
		);

		expect(sumChildrenTotalCost).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			"parent-1",
			"item-1",
		);
		expect(updateBudgetItem).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			"item-1",
			{ parentId: "parent-1", totalCost: 100 },
		);
		expect(result as unknown).toEqual({ id: "item-1" });
	});

	it("rejeita 422 ao atualizar filho com o mesmo pai quebrando a soma", async () => {
		budgetItemFindFirst.mockResolvedValue({
			id: "parent-1",
			type: "STAGE",
			index: "1",
		});
		sumChildrenTotalCost.mockResolvedValueOnce(null);
		sumChildrenTotalCost.mockResolvedValueOnce({
			parentTotalCost: 200,
			childrenTotalCost: 100,
			childrenCount: 1,
		});

		await expect(
			budgetService.updateItem("owner-1", "work-1", "item-1", {
				parentId: "parent-1",
				totalCost: 150,
			}),
		).rejects.toMatchObject({
			code: "BUDGET_ITEM_TOTAL_MISMATCH",
			status: 422,
			message: "Total do item pai deve ser a soma dos itens filhos",
		});
		expect(sumChildrenTotalCost).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			"parent-1",
			"item-1",
		);
		expect(updateBudgetItem).not.toHaveBeenCalled();
	});

	it("rejeita 422 ao zerar o total do filho unico do pai (regressao)", async () => {
		budgetItemFindFirst.mockResolvedValue({
			id: "parent-1",
			type: "STAGE",
			index: "1",
		});
		sumChildrenTotalCost.mockResolvedValueOnce(null);
		sumChildrenTotalCost.mockResolvedValueOnce({
			parentTotalCost: 100,
			childrenTotalCost: 0,
			childrenCount: 0,
		});

		await expect(
			budgetService.updateItem("owner-1", "work-1", "item-1", {
				parentId: "parent-1",
				totalCost: 0,
			}),
		).rejects.toMatchObject({
			code: "BUDGET_ITEM_TOTAL_MISMATCH",
			status: 422,
			message: "Total do item pai deve ser a soma dos itens filhos",
		});
		expect(sumChildrenTotalCost).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			"parent-1",
			"item-1",
		);
		expect(updateBudgetItem).not.toHaveBeenCalled();
	});

	it("importa planilha e substitui o orcamento ativo com resposta consolidada", async () => {
		const file = {
			name: "budget.xlsx",
			type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			size: 1024,
			arrayBuffer: async () => new ArrayBuffer(8),
		} as File;

		const result = await budgetService.importBudget("owner-1", "work-1", {
			file,
			sheetName: "Orcamento",
		});

		expect(parseWorkbookByKind).toHaveBeenCalledWith(
			expect.any(Uint8Array),
			"budget.xlsx",
			"orcamento",
		);
		expect(validateWorkbookByKind).toHaveBeenCalledWith(
			expect.anything(),
			"orcamento",
		);
		expect(replaceBudgetWithImport).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			[],
			expect.objectContaining({ rowCount: 0 }),
		);
		expect(replaceWorkWithImport).not.toHaveBeenCalled();
		expect(result as unknown).toMatchObject({
			workId: "work-1",
			importId: "import-1",
			processedSheets: ["Orcamento"],
			importedCount: 0,
			rejectedCount: 0,
			rowCount: 0,
			imported: 0,
			warningCount: 0,
			warnings: [],
			errors: [],
			importedSections: ["Orcamento"],
		});
		expect(assertGovernanceWritable).toHaveBeenCalledWith(
			"owner-1",
			"BUDGET",
			"work-1",
		);
	});

	it("retorna sucesso parcial quando ha erros por linha", async () => {
		validateWorkbookByKind.mockReturnValueOnce({
			valid: false,
			errors: [
				{
					row: 3,
					sheet: "Orcamento",
					field: "Tipo",
					code: "MISSING_REQUIRED_FIELD",
					message: "Tipo obrigatorio",
				},
			],
			warnings: [],
			work: {
				code: "OBRA-001",
				name: "Obra Teste",
				clientName: null,
				baseDate: new Date("2026-01-01T00:00:00.000Z"),
				plannedStart: new Date("2026-01-01T00:00:00.000Z"),
				plannedEnd: new Date("2026-12-31T00:00:00.000Z"),
				areaM2: null,
				operationalStatus: null,
				responsibleName: null,
				fileName: "budget.xlsx",
				sheetName: "Orcamento",
				importedSections: ["Orcamento"],
			},
			normalizedRows: [
				{
					rowNumber: 2,
					index: "1",
					parentIndex: null,
					type: "STAGE",
					description: "Etapa 1",
					unit: null,
					quantity: null,
					laborUnitCost: 0,
					materialUnitCost: 0,
					equipmentUnitCost: 0,
					otherUnitCost: 0,
					unitCostTotal: 0,
					totalBudget: 0,
					unitCost: 0,
					totalCost: 0,
					plannedStart: null,
					plannedEnd: null,
					actualStart: null,
					actualEnd: null,
					completionPercentage: 0,
					providedStatus: null,
					computedStatus: "NOT_STARTED",
					sortOrder: 1,
				},
			],
			baselineSchedules: [],
			scheduleRevisions: [],
			measurements: [],
			actualCosts: [],
			importedSections: ["Orcamento"],
			processedSheets: ["Orcamento"],
		} as never);
		const file = {
			name: "budget.xlsx",
			type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			size: 1024,
			arrayBuffer: async () => new ArrayBuffer(8),
		} as File;

		const result = await budgetService.importBudget("owner-1", "work-1", {
			file,
		});

		expect(replaceBudgetWithImport).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			[expect.objectContaining({ index: "1" })],
			expect.objectContaining({ rowCount: 1 }),
		);
		expect(result as unknown).toMatchObject({
			workId: "work-1",
			importId: "import-1",
			processedSheets: ["Orcamento"],
			importedCount: 1,
			rejectedCount: 1,
			errors: [
				expect.objectContaining({
					row: 3,
					field: "Tipo",
					code: "MISSING_REQUIRED_FIELD",
				}),
			],
		});
	});

	it("rejeita 422 quando ha erro estrutural sem linha", async () => {
		validateWorkbookByKind.mockReturnValueOnce({
			valid: false,
			errors: [
				{
					sheet: "Obra",
					code: "MISSING_REQUIRED_FIELD",
					field: "Codigo da obra",
					message: "Codigo da obra obrigatorio",
				},
			],
		} as never);
		const file = {
			name: "budget.xlsx",
			type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			size: 1024,
			arrayBuffer: async () => new ArrayBuffer(8),
		} as File;

		await expect(
			budgetService.importBudget("owner-1", "work-1", { file }),
		).rejects.toMatchObject({
			code: "VALIDATION_FAILED",
			status: 422,
		});
		expect(replaceBudgetWithImport).not.toHaveBeenCalled();
	});

	it("retorna o detalhe do item do orcamento", async () => {
		const result = await budgetService.getBudgetItem(
			"owner-1",
			"work-1",
			"item-1",
		);

		expect(getBudgetItemDetail).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			"item-1",
		);
		expect(result as unknown).toEqual({ id: "item-1" });
	});

	it("reordena itens do orcamento", async () => {
		const result = await budgetService.reorderItems("owner-1", "work-1", [
			{ id: "item-1", sortOrder: 1 },
			{ id: "item-2", sortOrder: 2 },
		]);

		expect(reorderBudgetItems).toHaveBeenCalledWith("owner-1", "work-1", [
			{ id: "item-1", sortOrder: 1 },
			{ id: "item-2", sortOrder: 2 },
		]);
		expect(result as unknown).toEqual({ count: 2 });
	});

	it("remove item do orcamento", async () => {
		const result = await budgetService.deleteItem(
			"owner-1",
			"work-1",
			"item-1",
		);

		expect(deleteBudgetItem).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			"item-1",
		);
		expect(result as unknown).toEqual({ id: "item-1" });
	});

	it("permite reduzir ate o valor de exposição do item", async () => {
		budgetItemFindFirst.mockResolvedValue({ totalCost: 1000 });
		workMeasurementItemAggregate.mockResolvedValue({
			_sum: { accumulatedValue: 400 },
		});
		sumChildrenTotalCost.mockResolvedValue({
			parentTotalCost: 1000,
			childrenTotalCost: 0,
			childrenCount: 0,
		});

		const result = await budgetService.updateItem(
			"owner-1",
			"work-1",
			"item-1",
			{
				totalCost: 400,
			},
		);

		expect(updateBudgetItem).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			"item-1",
			{ totalCost: 400 },
		);
		expect(result as unknown).toEqual({ id: "item-1" });
	});

	it("bloqueia reducao abaixo do realizado do item", async () => {
		budgetItemFindFirst.mockResolvedValue({ totalCost: 1000 });
		workMeasurementItemAggregate.mockResolvedValue({
			_sum: { accumulatedValue: 600 },
		});
		sumChildrenTotalCost.mockResolvedValue({
			parentTotalCost: 1000,
			childrenTotalCost: 0,
			childrenCount: 0,
		});

		await expect(
			budgetService.updateItem("owner-1", "work-1", "item-1", {
				totalCost: 500,
			}),
		).rejects.toMatchObject({
			code: "REDUCTION_BELOW_EXPOSURE",
			status: 422,
		});
		expect(updateBudgetItem).not.toHaveBeenCalled();
	});

	it("bloqueia exclusao de item referenciado por medicao", async () => {
		deleteBudgetItem.mockRejectedValue(
			new ConstructionError("ITEM_REFERENCED", "Item referenciado", 409),
		);

		await expect(
			budgetService.deleteItem("owner-1", "work-1", "item-1"),
		).rejects.toMatchObject({
			code: "ITEM_REFERENCED",
			status: 409,
		});
	});
});
