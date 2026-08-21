import { describe, expect, it, mock } from "bun:test";
import type { NormalizedBudgetItem } from "../../../../../src/modules/construction-planning/imports/normalized-types";

const workCreate = mock(async () => ({ id: "work-1" }));
const workUpdate = mock(async () => ({ id: "work-1" }));
const importCreate = mock(async () => ({ id: "import-1" }));
const importFindMany = mock(
	async (_args: { where: Record<string, unknown> }): Promise<unknown[]> => [],
);
const importCount = mock(
	async (_args: { where: Record<string, unknown> }): Promise<number> => 0,
);
const importFindFirst = mock(
	async (_args: {
		where: Record<string, unknown>;
	}): Promise<Record<string, unknown> | null> => null,
);
const workFindUnique = mock(async () => ({ id: "work-1" }));
const budgetItemCreate = mock(
	async ({ data }: { data: { index: string } }) => ({
		id: `budget-${data.index}`,
		index: data.index,
	}),
);
const budgetItemFindMany = mock(
	async (): Promise<{ id: string; index: string }[]> => [],
);
const budgetItemIdentityUpsert = mock(
	async ({ where }: { where: { workId_index: { index: string } } }) => ({
		id: `identity-${where.workId_index.index}`,
	}),
);
const baselineFindMany = mock(
	async (): Promise<{ id: string; index: string }[]> => [],
);
const baselineCreateMany = mock(async () => ({ count: 1 }));
const revisionCreateMany = mock(async () => ({ count: 1 }));
const measurementCreateMany = mock(async () => ({ count: 1 }));
const actualCostCreateMany = mock(async () => ({ count: 1 }));

const tx = {
	constructionWork: {
		create: workCreate,
		update: workUpdate,
		findUnique: workFindUnique,
		findFirst: workFindUnique,
	},
	constructionImport: {
		create: importCreate,
		findMany: importFindMany,
		count: importCount,
		findFirst: importFindFirst,
	},
	constructionBudgetItem: {
		create: budgetItemCreate,
		findMany: budgetItemFindMany,
		findFirst: mock(async () => null),
	},
	budgetItemIdentity: { upsert: budgetItemIdentityUpsert },
	constructionBaselineSchedule: {
		createMany: baselineCreateMany,
		findMany: baselineFindMany,
		findFirst: mock(async () => null),
	},
	constructionScheduleRevision: {
		createMany: revisionCreateMany,
	},
	constructionMeasurement: {
		createMany: measurementCreateMany,
	},
	constructionActualCost: {
		createMany: actualCostCreateMany,
	},
};

const transaction = mock(
	async (callback: (tx: never) => Promise<unknown>): Promise<unknown> =>
		callback(tx as never),
);

mock.module("../../../../../src/lib/prisma", () => ({
	prisma: {
		$transaction: transaction,
		constructionWork: {
			create: workCreate,
			update: workUpdate,
			findUnique: workFindUnique,
			findFirst: workFindUnique,
		},
		constructionImport: {
			create: importCreate,
			findMany: importFindMany,
			count: importCount,
			findFirst: importFindFirst,
		},
		constructionBudgetItem: {
			create: budgetItemCreate,
			findMany: budgetItemFindMany,
			findFirst: mock(async () => null),
		},
		constructionBaselineSchedule: {
			createMany: baselineCreateMany,
			findMany: baselineFindMany,
			findFirst: mock(async () => null),
		},
		constructionScheduleRevision: {
			createMany: revisionCreateMany,
		},
		constructionMeasurement: {
			createMany: measurementCreateMany,
		},
		constructionActualCost: {
			createMany: actualCostCreateMany,
		},
	},
}));

function item(index: string, sortOrder: number): NormalizedBudgetItem {
	return {
		rowNumber: 2,
		index,
		parentIndex: null,
		type: "ITEM",
		description: `Item ${index}`,
		unit: "m2",
		quantity: 1,
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
		sortOrder,
	};
}

function baseline(index: string) {
	return {
		rowNumber: 2,
		index,
		plannedStart: new Date("2026-01-01"),
		plannedEnd: new Date("2026-01-31"),
		plannedWeight: null,
	};
}

function revision(index: string) {
	return {
		rowNumber: 2,
		index,
		version: "R1",
		replannedStart: new Date("2026-01-05"),
		replannedEnd: new Date("2026-02-05"),
		revisionDate: new Date("2026-01-10"),
		reason: null,
	};
}

function measurement(index: string) {
	return {
		rowNumber: 2,
		index,
		measurementDate: new Date("2026-01-15"),
		measuredPercentageAccumulated: 0.5,
		measuredQuantityAccumulated: 5,
		notes: null,
	};
}

function actualCost(
	index: string | null,
): import("../../../../../src/modules/construction-planning/imports/normalized-types").NormalizedActualCost {
	return {
		rowNumber: 2,
		costDate: new Date("2026-01-20"),
		budgetIndex: index,
		category: "MATERIAL",
		description: "NF",
		amount: 100,
		costType: "CURRENT",
		sourceDocument: null,
		appropriationStatus: index ? "APPROPRIATED" : "UNAPPROPRIATED",
		supplierName: null,
		costGroup: null,
		paymentStatus: "OPEN",
		competenceDate: null,
		dueDate: null,
		paymentDate: null,
		documentNumber: null,
	};
}

describe("createWorkWithImport", () => {
	it("rolls back the whole module when an internal create fails", async () => {
		budgetItemCreate.mockImplementation(
			async ({ data }: { data: { index: string } }) => {
				if (data.index === "2") throw new Error("falha interna");
				return { id: `budget-${data.index}`, index: data.index };
			},
		);

		const { createWorkWithImport } = await import(
			"../../../../../src/modules/construction-planning/imports/import-repository"
		);

		await expect(
			createWorkWithImport(
				"owner-1",
				{
					code: "OBRA-001",
					name: "Obra",
					clientName: null,
					baseDate: null,
					plannedStart: null,
					plannedEnd: null,
					areaM2: null,
					operationalStatus: null,
					responsibleName: null,
					fileName: "teste.xlsx",
					sheetName: "Obra",
					importedSections: ["Obra", "Orcamento"],
				},
				"cc-1",
				[item("1", 1), item("2", 2)],
				{
					baselineSchedules: [],
					scheduleRevisions: [],
					measurements: [],
					actualCosts: [],
					rowCount: 2,
				},
			),
		).rejects.toThrow("falha interna");

		expect(transaction).toHaveBeenCalledTimes(1);
		expect(workCreate).toHaveBeenCalledTimes(1);
		expect(budgetItemCreate).toHaveBeenCalledTimes(2);
	});

	it("merges itens rows with budget rows, deduplicating by index", async () => {
		budgetItemCreate.mockClear();
		importCreate.mockClear();
		const { createWorkWithImport } = await import(
			"../../../../../src/modules/construction-planning/imports/import-repository"
		);

		await createWorkWithImport(
			"owner-1",
			{
				code: "OBRA-001",
				name: "Obra",
				clientName: null,
				baseDate: null,
				plannedStart: null,
				plannedEnd: null,
				areaM2: null,
				operationalStatus: null,
				responsibleName: null,
				fileName: "teste.xlsx",
				sheetName: "Obra",
				importedSections: ["Obra", "Orcamento", "Itens do Orcamento"],
			},
			"cc-1",
			[item("1", 1), item("1.1", 2)],
			{
				itens: [item("1", 1), item("1.1.1", 2)],
				baselineSchedules: [],
				scheduleRevisions: [],
				measurements: [],
				actualCosts: [],
				rowCount: 3,
			},
		);

		expect(budgetItemCreate).toHaveBeenCalledTimes(3);
		const created = budgetItemCreate.mock.calls.map(([args]) => args.data);
		expect(created[0]).toMatchObject({
			index: "1",
			parentId: null,
			sortOrder: 1,
		});
		expect(created[1]).toMatchObject({
			index: "1.1",
			parentId: "budget-1",
			sortOrder: 2,
		});
		expect(created[2]).toMatchObject({
			index: "1.1.1",
			parentId: "budget-1.1",
			sortOrder: 3,
		});
	});

	it("orders merged rows by index hierarchy before renumbering sortOrder", async () => {
		budgetItemCreate.mockClear();
		budgetItemCreate.mockImplementation(
			async ({ data }: { data: { index: string } }) => ({
				id: `budget-${data.index}`,
				index: data.index,
			}),
		);
		const { createWorkWithImport } = await import(
			"../../../../../src/modules/construction-planning/imports/import-repository"
		);

		await createWorkWithImport(
			"owner-1",
			{
				code: "OBRA-001",
				name: "Obra",
				clientName: null,
				baseDate: null,
				plannedStart: null,
				plannedEnd: null,
				areaM2: null,
				operationalStatus: null,
				responsibleName: null,
				fileName: "teste.xlsx",
				sheetName: "Obra",
				importedSections: ["Obra", "Orcamento", "Itens do Orcamento"],
			},
			"cc-1",
			[item("1", 1)],
			{
				itens: [item("2", 1), item("1.10", 2), item("1.2", 3)],
				baselineSchedules: [],
				scheduleRevisions: [],
				measurements: [],
				actualCosts: [],
				rowCount: 4,
			},
		);

		const created = budgetItemCreate.mock.calls.map(
			([args]) => args.data as { index: string; sortOrder: number },
		);
		expect(created.map((row) => row.index)).toEqual(["1", "1.2", "1.10", "2"]);
		expect(created.map((row) => row.sortOrder)).toEqual([1, 2, 3, 4]);
	});

	it("stores the consolidated row count in the import record", async () => {
		const { createWorkWithImport } = await import(
			"../../../../../src/modules/construction-planning/imports/import-repository"
		);

		await createWorkWithImport(
			"owner-1",
			{
				code: "OBRA-001",
				name: "Obra",
				clientName: null,
				baseDate: null,
				plannedStart: null,
				plannedEnd: null,
				areaM2: null,
				operationalStatus: null,
				responsibleName: null,
				fileName: "teste.xlsx",
				sheetName: "Obra",
				importedSections: ["Obra", "Orcamento"],
			},
			"cc-1",
			[item("1", 1)],
			{
				itens: [],
				baselineSchedules: [],
				scheduleRevisions: [],
				measurements: [],
				actualCosts: [],
				rowCount: 7,
			},
		);

		expect(importCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ rowCount: 7 }),
			}),
		);
	});

	it("binds measurement and actual-cost rows to the closest in-file ancestor budget item", async () => {
		budgetItemCreate.mockClear();
		budgetItemCreate.mockImplementation(
			async ({ data }: { data: { index: string } }) => ({
				id: `budget-${data.index}`,
				index: data.index,
			}),
		);
		measurementCreateMany.mockClear();
		actualCostCreateMany.mockClear();
		const { createWorkWithImport } = await import(
			"../../../../../src/modules/construction-planning/imports/import-repository"
		);

		await createWorkWithImport(
			"owner-1",
			{
				code: "OBRA-001",
				name: "Obra",
				clientName: null,
				baseDate: null,
				plannedStart: null,
				plannedEnd: null,
				areaM2: null,
				operationalStatus: null,
				responsibleName: null,
				fileName: "teste.xlsx",
				sheetName: "Obra",
				importedSections: [
					"Obra",
					"Orcamento",
					"Medicoes",
					"Custos Realizados",
				],
			},
			"cc-1",
			[item("1", 1), item("1.1", 2)],
			{
				itens: [],
				baselineSchedules: [],
				scheduleRevisions: [],
				measurements: [measurement("1.1.1")],
				actualCosts: [actualCost("1.1.1")],
				rowCount: 4,
			},
		);

		expect(measurementCreateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: [
					expect.objectContaining({
						index: "1.1.1",
						budgetItemId: "budget-1.1",
					}),
				],
			}),
		);
		expect(actualCostCreateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: [
					expect.objectContaining({
						budgetIndex: "1.1.1",
						budgetItemId: "budget-1.1",
					}),
				],
			}),
		);
	});

	it("binds baseline and revision rows to the closest ancestor budget item", async () => {
		budgetItemCreate.mockClear();
		baselineCreateMany.mockClear();
		revisionCreateMany.mockClear();
		const { createWorkWithImport } = await import(
			"../../../../../src/modules/construction-planning/imports/import-repository"
		);

		await createWorkWithImport(
			"owner-1",
			{
				code: "OBRA-001",
				name: "Obra",
				clientName: null,
				baseDate: null,
				plannedStart: null,
				plannedEnd: null,
				areaM2: null,
				operationalStatus: null,
				responsibleName: null,
				fileName: "teste.xlsx",
				sheetName: "Obra",
				importedSections: [
					"Obra",
					"Orcamento",
					"Cronograma Original",
					"Replanejamento",
				],
			},
			"cc-1",
			[item("1", 1), item("1.1", 2)],
			{
				itens: [],
				baselineSchedules: [baseline("1.1.1")],
				scheduleRevisions: [revision("1.1.1")],
				measurements: [],
				actualCosts: [],
				rowCount: 3,
			},
		);

		expect(baselineCreateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: [
					expect.objectContaining({
						index: "1.1.1",
						budgetItemId: "budget-1.1",
					}),
				],
			}),
		);
		expect(revisionCreateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: [
					expect.objectContaining({
						index: "1.1.1",
						budgetItemId: "budget-1.1",
					}),
				],
			}),
		);
	});
});

describe("replaceWorkWithImport", () => {
	it("merges itens rows and binds them inside the replacement import", async () => {
		workUpdate.mockClear();
		budgetItemCreate.mockClear();
		const { replaceWorkWithImport } = await import(
			"../../../../../src/modules/construction-planning/imports/import-repository"
		);

		await replaceWorkWithImport(
			"owner-1",
			"work-1",
			{
				code: "OBRA-001",
				name: "Obra",
				clientName: null,
				baseDate: null,
				plannedStart: null,
				plannedEnd: null,
				areaM2: null,
				operationalStatus: null,
				responsibleName: null,
				fileName: "teste.xlsx",
				sheetName: "Obra",
				importedSections: ["Obra", "Itens do Orcamento"],
			},
			[item("1", 1)],
			{
				itens: [item("1.1", 1)],
				baselineSchedules: [],
				scheduleRevisions: [],
				measurements: [],
				actualCosts: [],
				rowCount: 2,
			},
		);

		expect(workUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: "work-1", ownerId: "owner-1" },
			}),
		);
		expect(budgetItemCreate).toHaveBeenCalledTimes(2);
		const created = budgetItemCreate.mock.calls.map(([args]) => args.data);
		expect(created[1]).toMatchObject({
			index: "1.1",
			parentId: "budget-1",
		});
	});

	it("persists children rows bound to existing work budget items when the index is absent from the replacement import", async () => {
		workUpdate.mockClear();
		budgetItemCreate.mockClear();
		baselineCreateMany.mockClear();
		revisionCreateMany.mockClear();
		budgetItemFindMany.mockResolvedValue([
			{ id: "existing-1", index: "1" },
			{ id: "existing-1.1", index: "1.1" },
		]);
		const { replaceWorkWithImport } = await import(
			"../../../../../src/modules/construction-planning/imports/import-repository"
		);

		await replaceWorkWithImport(
			"owner-1",
			"work-1",
			{
				code: "OBRA-001",
				name: "Obra",
				clientName: null,
				baseDate: null,
				plannedStart: null,
				plannedEnd: null,
				areaM2: null,
				operationalStatus: null,
				responsibleName: null,
				fileName: "teste.xlsx",
				sheetName: "Obra",
				importedSections: ["Obra", "Cronograma Original", "Replanejamento"],
			},
			[],
			{
				itens: [],
				baselineSchedules: [baseline("1.1.1")],
				scheduleRevisions: [revision("1.1.1")],
				measurements: [],
				actualCosts: [],
				rowCount: 2,
			},
		);

		expect(budgetItemCreate).not.toHaveBeenCalled();
		expect(baselineCreateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: [
					expect.objectContaining({
						index: "1.1.1",
						budgetItemId: "existing-1.1",
					}),
				],
			}),
		);
		expect(revisionCreateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: [
					expect.objectContaining({
						index: "1.1.1",
						budgetItemId: "existing-1.1",
					}),
				],
			}),
		);
	});

	it("binds replacement itens rows to existing work parents", async () => {
		workUpdate.mockClear();
		budgetItemCreate.mockClear();
		budgetItemFindMany.mockResolvedValue([{ id: "existing-1", index: "1" }]);
		const { replaceWorkWithImport } = await import(
			"../../../../../src/modules/construction-planning/imports/import-repository"
		);

		await replaceWorkWithImport(
			"owner-1",
			"work-1",
			{
				code: "OBRA-001",
				name: "Obra",
				clientName: null,
				baseDate: null,
				plannedStart: null,
				plannedEnd: null,
				areaM2: null,
				operationalStatus: null,
				responsibleName: null,
				fileName: "teste.xlsx",
				sheetName: "Obra",
				importedSections: ["Obra", "Itens do Orcamento"],
			},
			[],
			{
				itens: [item("1.1", 1)],
				baselineSchedules: [],
				scheduleRevisions: [],
				measurements: [],
				actualCosts: [],
				rowCount: 1,
			},
		);

		expect(budgetItemCreate).toHaveBeenCalledTimes(1);
		const created = budgetItemCreate.mock.calls[0][0].data;
		expect(created).toMatchObject({
			index: "1.1",
			parentId: "existing-1",
		});
	});

	it("persists measurement and actual-cost rows bound to existing work budget items", async () => {
		workUpdate.mockClear();
		budgetItemCreate.mockClear();
		measurementCreateMany.mockClear();
		actualCostCreateMany.mockClear();
		budgetItemFindMany.mockResolvedValue([
			{ id: "existing-1", index: "1" },
			{ id: "existing-1.1", index: "1.1" },
		]);
		const { replaceWorkWithImport } = await import(
			"../../../../../src/modules/construction-planning/imports/import-repository"
		);

		await replaceWorkWithImport(
			"owner-1",
			"work-1",
			{
				code: "OBRA-001",
				name: "Obra",
				clientName: null,
				baseDate: null,
				plannedStart: null,
				plannedEnd: null,
				areaM2: null,
				operationalStatus: null,
				responsibleName: null,
				fileName: "teste.xlsx",
				sheetName: "Obra",
				importedSections: ["Obra", "Medicoes", "Custos Realizados"],
			},
			[],
			{
				itens: [],
				baselineSchedules: [],
				scheduleRevisions: [],
				measurements: [measurement("1.1")],
				actualCosts: [actualCost("1.1"), actualCost(null)],
				rowCount: 3,
			},
		);

		expect(measurementCreateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: [
					expect.objectContaining({
						index: "1.1",
						budgetItemId: "existing-1.1",
					}),
				],
			}),
		);
		expect(actualCostCreateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: [
					expect.objectContaining({
						budgetIndex: "1.1",
						budgetItemId: "existing-1.1",
						appropriationStatus: "APPROPRIATED",
					}),
					expect.objectContaining({
						budgetIndex: null,
						budgetItemId: null,
						appropriationStatus: "UNAPPROPRIATED",
					}),
				],
			}),
		);
	});

	it("binds actual-cost rows with a descendant index to the closest existing ancestor item", async () => {
		workUpdate.mockClear();
		budgetItemCreate.mockClear();
		actualCostCreateMany.mockClear();
		budgetItemFindMany.mockResolvedValue([
			{ id: "existing-1", index: "1" },
			{ id: "existing-1.1", index: "1.1" },
		]);
		const { replaceWorkWithImport } = await import(
			"../../../../../src/modules/construction-planning/imports/import-repository"
		);

		await replaceWorkWithImport(
			"owner-1",
			"work-1",
			{
				code: "OBRA-001",
				name: "Obra",
				clientName: null,
				baseDate: null,
				plannedStart: null,
				plannedEnd: null,
				areaM2: null,
				operationalStatus: null,
				responsibleName: null,
				fileName: "teste.xlsx",
				sheetName: "Obra",
				importedSections: ["Obra", "Custos Realizados"],
			},
			[],
			{
				itens: [],
				baselineSchedules: [],
				scheduleRevisions: [],
				measurements: [],
				actualCosts: [actualCost("1.1.1")],
				rowCount: 1,
			},
		);

		expect(actualCostCreateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: [
					expect.objectContaining({
						budgetIndex: "1.1.1",
						budgetItemId: "existing-1.1",
					}),
				],
			}),
		);
	});

	it("rejects instead of silently discarding measurement rows without a bindable budget item", async () => {
		workUpdate.mockClear();
		budgetItemCreate.mockClear();
		measurementCreateMany.mockClear();
		budgetItemFindMany.mockResolvedValue([{ id: "existing-1", index: "1" }]);
		const { replaceWorkWithImport } = await import(
			"../../../../../src/modules/construction-planning/imports/import-repository"
		);

		await expect(
			replaceWorkWithImport(
				"owner-1",
				"work-1",
				{
					code: "OBRA-001",
					name: "Obra",
					clientName: null,
					baseDate: null,
					plannedStart: null,
					plannedEnd: null,
					areaM2: null,
					operationalStatus: null,
					responsibleName: null,
					fileName: "teste.xlsx",
					sheetName: "Obra",
					importedSections: ["Obra", "Medicoes"],
				},
				[],
				{
					itens: [],
					baselineSchedules: [],
					scheduleRevisions: [],
					measurements: [measurement("9.9")],
					actualCosts: [],
					rowCount: 1,
				},
			),
		).rejects.toThrow("sem item de orcamento vinculavel");
		expect(measurementCreateMany).not.toHaveBeenCalled();
	});
});

describe("createWorkWithImport reprocess metadata", () => {
	it("persists status, reprocessOfId and errorSummary on the import record", async () => {
		importCreate.mockClear();
		const { createWorkWithImport } = await import(
			"../../../../../src/modules/construction-planning/imports/import-repository"
		);

		await createWorkWithImport(
			"owner-1",
			{
				code: "OBRA-001",
				name: "Obra",
				clientName: null,
				baseDate: null,
				plannedStart: null,
				plannedEnd: null,
				areaM2: null,
				operationalStatus: null,
				responsibleName: null,
				fileName: "teste.xlsx",
				sheetName: "Obra",
				importedSections: ["Obra", "Orcamento"],
			},
			"cc-1",
			[item("1", 1)],
			{
				itens: [],
				baselineSchedules: [],
				scheduleRevisions: [],
				measurements: [],
				actualCosts: [],
				rowCount: 1,
				reprocessOfId: "import-0",
				errorSummary: {
					rejectedCount: 2,
					warnings: [],
					errors: [{ code: "X", message: "x", row: 3 }],
				},
			},
		);

		expect(importCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					status: "IMPORTED",
					reprocessOfId: "import-0",
					errorSummary: {
						rejectedCount: 2,
						warnings: [],
						errors: [{ code: "X", message: "x", row: 3 }],
					},
				}),
			}),
		);
	});
});

describe("replaceWorkWithImport reprocess metadata", () => {
	it("persists reprocessOfId and errorSummary on the replacement import", async () => {
		importCreate.mockClear();
		const { replaceWorkWithImport } = await import(
			"../../../../../src/modules/construction-planning/imports/import-repository"
		);

		await replaceWorkWithImport(
			"owner-1",
			"work-1",
			{
				code: "OBRA-001",
				name: "Obra",
				clientName: null,
				baseDate: null,
				plannedStart: null,
				plannedEnd: null,
				areaM2: null,
				operationalStatus: null,
				responsibleName: null,
				fileName: "teste.xlsx",
				sheetName: "Obra",
				importedSections: ["Obra", "Orcamento"],
			},
			[item("1", 1)],
			{
				itens: [],
				baselineSchedules: [],
				scheduleRevisions: [],
				measurements: [],
				actualCosts: [],
				rowCount: 1,
				reprocessOfId: "import-0",
				errorSummary: { rejectedCount: 1, warnings: [], errors: [] },
			},
		);

		expect(importCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					status: "IMPORTED",
					reprocessOfId: "import-0",
					errorSummary: { rejectedCount: 1, warnings: [], errors: [] },
				}),
			}),
		);
	});
});

describe("listImports", () => {
	it("paginates imports scoped by owner and work ordered desc by createdAt", async () => {
		importFindMany.mockResolvedValue([{ id: "import-1" }]);
		importCount.mockResolvedValue(1);
		const { listImports } = await import(
			"../../../../../src/modules/construction-planning/imports/import-repository"
		);

		const result = await listImports("owner-1", {
			workId: "work-1",
			page: 2,
			pageSize: 5,
		});

		expect(importFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { ownerId: "owner-1", workId: "work-1" },
				orderBy: { createdAt: "desc" },
				skip: 5,
				take: 5,
			}),
		);
		expect(importCount).toHaveBeenCalledWith({
			where: { ownerId: "owner-1", workId: "work-1" },
		});
		expect(result).toMatchObject({
			data: [{ id: "import-1" }],
			total: 1,
			page: 2,
			limit: 5,
		});
	});

	it("defaults to page 1, pageSize 20 and owner-only scope", async () => {
		importFindMany.mockResolvedValue([]);
		importCount.mockResolvedValue(0);
		const { listImports } = await import(
			"../../../../../src/modules/construction-planning/imports/import-repository"
		);

		await listImports("owner-1", {});

		expect(importFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { ownerId: "owner-1" },
				skip: 0,
				take: 20,
			}),
		);
	});
});

describe("getImportById", () => {
	it("fetches an import scoped by owner", async () => {
		importFindFirst.mockResolvedValue({ id: "import-1", ownerId: "owner-1" });
		const { getImportById } = await import(
			"../../../../../src/modules/construction-planning/imports/import-repository"
		);

		const result = await getImportById("owner-1", "import-1");

		expect(importFindFirst).toHaveBeenCalledWith({
			where: { id: "import-1", ownerId: "owner-1" },
		});
		expect(result).toMatchObject({ id: "import-1", ownerId: "owner-1" });
	});
});

describe("existingBudgetIndexes", () => {
	it("queries once with in for the whole sheet and returns the existing indexes", async () => {
		budgetItemFindMany.mockClear();
		budgetItemFindMany.mockResolvedValueOnce([
			{ id: "b-1", index: "1" },
			{ id: "b-1.1", index: "1.1" },
		]);
		const { existingBudgetIndexes } = await import(
			"../../../../../src/modules/construction-planning/imports/import-repository"
		);

		const result = await existingBudgetIndexes(
			{ ownerId: "owner-1", workId: "work-1" },
			["1", "1.1", "1.1.1", "2"],
		);

		expect(budgetItemFindMany).toHaveBeenCalledTimes(1);
		expect(budgetItemFindMany).toHaveBeenCalledWith({
			where: {
				ownerId: "owner-1",
				workId: "work-1",
				index: { in: ["1", "1.1", "1.1.1", "2"] },
			},
			select: { index: true },
		});
		expect(result).toEqual(new Set(["1", "1.1"]));
	});

	it("returns an empty set without querying when there is no work", async () => {
		budgetItemFindMany.mockClear();
		const { existingBudgetIndexes } = await import(
			"../../../../../src/modules/construction-planning/imports/import-repository"
		);

		const result = await existingBudgetIndexes(
			{ ownerId: "owner-1", workId: null },
			["1"],
		);

		expect(result).toEqual(new Set());
		expect(budgetItemFindMany).not.toHaveBeenCalled();
	});
});

describe("existingScheduleIndexes", () => {
	it("queries once with in plus the planned date guards", async () => {
		baselineFindMany.mockClear();
		baselineFindMany.mockResolvedValueOnce([{ id: "s-1", index: "1" }]);
		const { existingScheduleIndexes } = await import(
			"../../../../../src/modules/construction-planning/imports/import-repository"
		);

		const result = await existingScheduleIndexes(
			{ ownerId: "owner-1", workId: "work-1" },
			["1", "1.1"],
		);

		expect(baselineFindMany).toHaveBeenCalledTimes(1);
		expect(baselineFindMany).toHaveBeenCalledWith({
			where: {
				ownerId: "owner-1",
				workId: "work-1",
				index: { in: ["1", "1.1"] },
				plannedStart: { not: null },
				plannedEnd: { not: null },
			},
			select: { index: true },
		});
		expect(result).toEqual(new Set(["1"]));
	});
});
