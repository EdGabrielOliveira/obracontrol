import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { logger } from "../../../../src/lib/logger";

const findMany = mock(
	async (_args: { take?: number }): Promise<unknown[]> => [],
);
const findFirst = mock(async (): Promise<unknown | null> => null);
const findUnique = mock(async (): Promise<unknown | null> => null);
const workCount = mock(async (): Promise<number> => 0);
const importCount = mock(async (): Promise<number> => 0);
const importBatchCount = mock(async (): Promise<number> => 0);
const budgetItemCount = mock(async (): Promise<number> => 0);
const budgetVersionCount = mock(async (): Promise<number> => 0);
const budgetIdentityCount = mock(async (): Promise<number> => 0);
const baselineCount = mock(async (): Promise<number> => 0);
const revisionCount = mock(async (): Promise<number> => 0);
const scheduleVersionCount = mock(async (): Promise<number> => 0);
const measurementCount = mock(async (): Promise<number> => 0);
const supplierLinkCount = mock(async (): Promise<number> => 0);
const workMeasurementCount = mock(async (): Promise<number> => 0);
const contractCount = mock(async (): Promise<number> => 0);
const membershipCount = mock(async (): Promise<number> => 0);
const photoReportCount = mock(async (): Promise<number> => 0);
const ledgerEventCount = mock(async (): Promise<number> => 0);
const budgetImpactCount = mock(async (): Promise<number> => 0);
const monthlyFactCount = mock(async (): Promise<number> => 0);
const workCreate = mock(async (): Promise<unknown> => ({ id: "work-1" }));
const workUpdate = mock(async (): Promise<unknown> => ({ id: "work-1" }));
const workDelete = mock(async (): Promise<unknown> => ({ id: "work-1" }));
const deleteMany = mock(async (): Promise<unknown> => ({ count: 0 }));
const importCreate = mock(async (): Promise<unknown> => ({ id: "import-1" }));
const importFindFirst = mock(async (): Promise<unknown | null> => null);
const importFindMany = mock(async (): Promise<unknown[]> => []);
const importDeleteMany = mock(async (): Promise<unknown> => ({ count: 0 }));
const budgetItemCreate = mock(
	async ({ data }: { data: { index: string } }): Promise<unknown> => ({
		id: `budget-${data.index}`,
		index: data.index,
	}),
);
const budgetItemDeleteMany = mock(async (): Promise<unknown> => ({ count: 0 }));
const budgetItemFindMany = mock(async (): Promise<unknown[]> => []);
const budgetItemFindFirst = mock(async (): Promise<unknown | null> => null);
const budgetItemIdentityUpsert = mock(
	async ({ where }: { where: { workId_index: { index: string } } }) => ({
		id: `identity-${where.workId_index.index}`,
	}),
);
const baselineCreateMany = mock(async (): Promise<unknown> => ({ count: 0 }));
const baselineDeleteMany = mock(async (): Promise<unknown> => ({ count: 0 }));
const baselineFindMany = mock(async (): Promise<unknown[]> => []);
const revisionCreateMany = mock(async (): Promise<unknown> => ({ count: 0 }));
const revisionDeleteMany = mock(async (): Promise<unknown> => ({ count: 0 }));
const revisionFindMany = mock(async (): Promise<unknown[]> => []);
const measurementCreateMany = mock(
	async (): Promise<unknown> => ({ count: 0 }),
);
const measurementCreate = mock(
	async (): Promise<unknown> => ({ id: "measurement-1" }),
);
const measurementDeleteMany = mock(
	async (): Promise<unknown> => ({ count: 0 }),
);
const measurementFindMany = mock(async (): Promise<unknown[]> => []);
const measurementFindFirst = mock(async (): Promise<unknown | null> => null);
const measurementDelete = mock(
	async (): Promise<unknown> => ({ id: "measurement-1" }),
);
const actualCostCreateMany = mock(async (): Promise<unknown> => ({ count: 0 }));
const actualCostCreate = mock(async (): Promise<unknown> => ({ id: "cost-1" }));
const actualCostDeleteMany = mock(async (): Promise<unknown> => ({ count: 0 }));
const actualCostFindMany = mock(async (): Promise<unknown[]> => []);
const actualCostCount = mock(async (): Promise<number> => 0);
const actualCostFindFirst = mock(async (): Promise<unknown | null> => null);
const actualCostDelete = mock(async (): Promise<unknown> => ({ id: "cost-1" }));
const userFindUnique = mock(async (): Promise<unknown | null> => null);
const workMembershipFindMany = mock(async (): Promise<unknown[]> => []);
const costCenterMembershipFindMany = mock(async (): Promise<unknown[]> => []);
const organizationMembershipFindMany = mock(async (): Promise<unknown[]> => []);
const transaction = mock(
	async (callback: (tx: unknown) => Promise<unknown>): Promise<unknown> =>
		callback(tx),
);

function seedAccessibleWorks(workIds: string[]) {
	userFindUnique.mockResolvedValueOnce({ role: "GERENTE", banned: false });
	organizationMembershipFindMany.mockResolvedValueOnce([
		{
			organization: {
				id: "org-1",
				costCenters: [
					{
						id: "cc-1",
						works: workIds.map((id) => ({ id })),
					},
				],
			},
		},
	]);
}

const tx = {
	constructionWork: {
		create: workCreate,
		update: workUpdate,
		delete: workDelete,
		count: workCount,
		findMany,
		findFirst,
		findUnique,
	},
	quotationBudgetItem: { deleteMany },
	contractRequestBudgetItem: { deleteMany },
	importBatch: { deleteMany },
	quotation: { deleteMany },
	constructionBudgetReconciliation: { deleteMany },
	constructionMonthlyFact: { deleteMany },
	constructionImport: {
		create: importCreate,
		deleteMany: importDeleteMany,
		findFirst: importFindFirst,
	},
	constructionBudgetItem: {
		create: budgetItemCreate,
		deleteMany: budgetItemDeleteMany,
		findMany: budgetItemFindMany,
		findFirst: budgetItemFindFirst,
	},
	budgetItemIdentity: { upsert: budgetItemIdentityUpsert },
	constructionBaselineSchedule: {
		createMany: baselineCreateMany,
		deleteMany: baselineDeleteMany,
		findMany: baselineFindMany,
	},
	constructionScheduleRevision: {
		createMany: revisionCreateMany,
		deleteMany: revisionDeleteMany,
		findMany: revisionFindMany,
	},
	constructionMeasurement: {
		createMany: measurementCreateMany,
		create: measurementCreate,
		deleteMany: measurementDeleteMany,
		findMany: measurementFindMany,
		findFirst: measurementFindFirst,
		delete: measurementDelete,
	},
	constructionActualCost: {
		createMany: actualCostCreateMany,
		create: actualCostCreate,
		deleteMany: actualCostDeleteMany,
		count: actualCostCount,
		findMany: actualCostFindMany,
		findFirst: actualCostFindFirst,
		delete: actualCostDelete,
	},
};

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		$transaction: transaction,
		constructionWork: {
			create: workCreate,
			update: workUpdate,
			delete: workDelete,
			count: workCount,
			findMany,
			findFirst,
			findUnique,
		},
		constructionImport: {
			create: importCreate,
			deleteMany: importDeleteMany,
			findFirst: importFindFirst,
			findMany: importFindMany,
			count: importCount,
		},
		quotationBudgetItem: { deleteMany },
		contractRequestBudgetItem: { deleteMany },
		quotation: { deleteMany },
		constructionBudgetReconciliation: { deleteMany },
		importBatch: {
			count: importBatchCount,
			deleteMany,
		},
		constructionBudgetItem: {
			create: budgetItemCreate,
			deleteMany: budgetItemDeleteMany,
			findMany: budgetItemFindMany,
			findFirst: budgetItemFindFirst,
			count: budgetItemCount,
		},
		budgetVersion: {
			count: budgetVersionCount,
		},
		budgetItemIdentity: {
			count: budgetIdentityCount,
		},
		constructionBaselineSchedule: {
			createMany: baselineCreateMany,
			deleteMany: baselineDeleteMany,
			findMany: baselineFindMany,
			count: baselineCount,
		},
		constructionScheduleRevision: {
			createMany: revisionCreateMany,
			deleteMany: revisionDeleteMany,
			findMany: revisionFindMany,
			count: revisionCount,
		},
		scheduleVersion: {
			count: scheduleVersionCount,
		},
		constructionMeasurement: {
			createMany: measurementCreateMany,
			create: measurementCreate,
			deleteMany: measurementDeleteMany,
			findMany: measurementFindMany,
			findFirst: measurementFindFirst,
			delete: measurementDelete,
			count: measurementCount,
		},
		constructionActualCost: {
			createMany: actualCostCreateMany,
			create: actualCostCreate,
			deleteMany: actualCostDeleteMany,
			count: actualCostCount,
			findMany: actualCostFindMany,
			findFirst: actualCostFindFirst,
			delete: actualCostDelete,
		},
		constructionWorkSupplier: {
			count: supplierLinkCount,
		},
		workMeasurement: {
			count: workMeasurementCount,
		},
		contract: {
			count: contractCount,
		},
		photoReport: {
			count: photoReportCount,
		},
		constructionLedgerEvent: {
			count: ledgerEventCount,
		},
		constructionBudgetImpact: {
			count: budgetImpactCount,
		},
		constructionMonthlyFact: {
			count: monthlyFactCount,
			deleteMany,
		},
		user: {
			findUnique: userFindUnique,
		},
		workMembership: {
			findMany: workMembershipFindMany,
			count: membershipCount,
		},
		costCenterMembership: {
			findMany: costCenterMembershipFindMany,
		},
		organizationMembership: {
			findMany: organizationMembershipFindMany,
		},
	},
}));

function makeWork() {
	return {
		code: "OBRA-001",
		name: "Edificio Horizonte",
		clientName: "Cliente A",
		baseDate: new Date("2026-01-15T00:00:00.000Z"),
		plannedStart: new Date("2026-01-01T00:00:00.000Z"),
		plannedEnd: new Date("2026-12-31T00:00:00.000Z"),
		areaM2: null,
		operationalStatus: null,
		responsibleName: null,
		fileName: "unificado.xlsx",
		sheetName: "Orcamento",
		importedSections: ["Obra", "Orcamento", "Cronograma Original", "Medicoes"],
	};
}

function makeItems() {
	return [
		{
			rowNumber: 2,
			index: "1",
			parentIndex: null,
			type: "STAGE" as const,
			description: "Fundacao",
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
			computedStatus: "NOT_STARTED" as const,
			sortOrder: 0,
		},
		{
			rowNumber: 3,
			index: "1.1",
			parentIndex: "1",
			type: "ITEM" as const,
			description: "Escavacao",
			unit: "m3",
			quantity: 10,
			laborUnitCost: 20,
			materialUnitCost: 30,
			equipmentUnitCost: 5,
			otherUnitCost: 0,
			unitCostTotal: 55,
			totalBudget: 550,
			unitCost: 55,
			totalCost: 550,
			plannedStart: null,
			plannedEnd: null,
			actualStart: null,
			actualEnd: null,
			completionPercentage: 0.5,
			providedStatus: "Ativo",
			computedStatus: "IN_PROGRESS" as const,
			sortOrder: 1,
		},
	];
}

function makeOptions() {
	return {
		baselineSchedules: [
			{
				rowNumber: 2,
				index: "1.1",
				plannedStart: new Date("2026-01-01T00:00:00.000Z"),
				plannedEnd: new Date("2026-01-31T00:00:00.000Z"),
				plannedWeight: null,
			},
		],
		scheduleRevisions: [
			{
				rowNumber: 2,
				index: "1.1",
				version: "R1",
				replannedStart: new Date("2026-01-05T00:00:00.000Z"),
				replannedEnd: new Date("2026-02-05T00:00:00.000Z"),
				revisionDate: new Date("2026-01-10T00:00:00.000Z"),
				reason: "Chuva",
			},
		],
		measurements: [
			{
				rowNumber: 2,
				index: "1.1",
				measurementDate: new Date("2026-01-15T00:00:00.000Z"),
				measuredPercentageAccumulated: 0.5,
				measuredQuantityAccumulated: 5,
				notes: "Parcial",
			},
		],
		actualCosts: [
			{
				rowNumber: 2,
				costDate: new Date("2026-01-20T00:00:00.000Z"),
				budgetIndex: "1.1",
				category: "MATERIAL" as const,
				description: "NF",
				amount: 200,
				costType: "CURRENT" as const,
				sourceDocument: "NF-1",
				appropriationStatus: "APPROPRIATED" as const,
				supplierName: null,
				costGroup: null,
				paymentStatus: "OPEN" as const,
				competenceDate: null,
				dueDate: null,
				paymentDate: null,
				documentNumber: null,
			},
			{
				rowNumber: 3,
				costDate: new Date("2026-02-20T00:00:00.000Z"),
				budgetIndex: null,
				category: "OTHER" as const,
				description: "Reserva",
				amount: 50,
				costType: "FUTURE" as const,
				sourceDocument: "Planilha",
				appropriationStatus: "UNAPPROPRIATED" as const,
				supplierName: null,
				costGroup: null,
				paymentStatus: "OPEN" as const,
				competenceDate: null,
				dueDate: null,
				paymentDate: null,
				documentNumber: null,
			},
		],
		rowCount: 2,
	};
}

describe("construction repository imports", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		workCreate.mockResolvedValue({ id: "work-1" });
		workUpdate.mockResolvedValue({ id: "work-1" });
		importCreate.mockResolvedValue({ id: "import-1" });
		budgetItemCreate.mockImplementation(
			async ({ data }: { data: { index: string } }): Promise<unknown> => ({
				id: `budget-${data.index}`,
				index: data.index,
			}),
		);
		transaction.mockImplementation(
			async (
				callback: (transactionClient: unknown) => Promise<unknown>,
			): Promise<unknown> => callback(tx),
		);
	});

	it("does not expose legacy helpers that bypass active-import traceability", async () => {
		const repository = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		expect("replaceWorkItems" in repository).toBe(false);
		expect("getWorkItems" in repository).toBe(false);
	});

	it("reads a work without active import falling back to the latest import", async () => {
		userFindUnique.mockResolvedValueOnce({ role: "ADMIN" });
		findMany.mockResolvedValueOnce([{ id: "work-1" }]);
		findFirst.mockResolvedValueOnce({
			id: "work-1",
			ownerId: "user-1",
			activeImportId: null,
			code: "OBRA-001",
			name: "Obra",
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			imports: [],
		});
		importFindFirst.mockResolvedValueOnce({ id: "import-latest" });
		budgetItemFindMany.mockResolvedValueOnce([
			{ id: "budget-legacy", importId: "import-latest" },
		]);
		measurementFindMany.mockResolvedValueOnce([]);
		actualCostFindMany.mockResolvedValueOnce([]);
		const { getWorkWithItems } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		const result = await getWorkWithItems("user-1", "work-1");

		expect(importFindFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { ownerId: "user-1", workId: "work-1" },
			}),
		);
		expect(budgetItemFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					ownerId: "user-1",
					workId: "work-1",
					importId: "import-latest",
				},
			}),
		);
		expect(result).toMatchObject({
			items: [{ id: "budget-legacy", importId: "import-latest" }],
		});
	});

	it("creates a unified import and marks it active without deleting older imports", async () => {
		const { createWorkWithImport } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		const result = await createWorkWithImport(
			"user-1",
			makeWork(),
			"cc-test",
			makeItems(),
			makeOptions(),
		);

		expect(result.importId).toBe("import-1");
		expect(workCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ clientName: "Cliente A" }),
			}),
		);
		expect(importCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					importedSections: expect.arrayContaining(["Orcamento"]),
				}),
			}),
		);
		expect(budgetItemCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					laborUnitCost: 20,
					materialUnitCost: 30,
					equipmentUnitCost: 5,
					otherUnitCost: 0,
					unitCostTotal: 55,
					totalBudget: 550,
				}),
			}),
		);
		expect(baselineCreateMany).toHaveBeenCalled();
		expect(revisionCreateMany).toHaveBeenCalled();
		expect(measurementCreateMany).toHaveBeenCalled();
		expect(actualCostCreateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.arrayContaining([
					expect.objectContaining({ budgetItemId: "budget-1.1" }),
					expect.objectContaining({
						budgetItemId: null,
						appropriationStatus: "UNAPPROPRIATED",
					}),
				]),
			}),
		);
		expect(workUpdate).toHaveBeenCalledWith(
			expect.objectContaining({ data: { activeImportId: "import-1" } }),
		);
		expect(budgetItemDeleteMany).not.toHaveBeenCalled();
	});

	it("replaces a work by creating a new active import without deleting older import rows", async () => {
		const { replaceWorkWithImport } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		await replaceWorkWithImport(
			"user-1",
			"work-1",
			makeWork(),
			makeItems(),
			makeOptions(),
		);

		expect(importCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ workId: "work-1" }),
			}),
		);
		expect(budgetItemDeleteMany).not.toHaveBeenCalled();
		expect(workUpdate).toHaveBeenCalledWith(
			expect.objectContaining({ data: { activeImportId: "import-1" } }),
		);
	});

	it("reads a work with active-import rows plus manual measurement and cost rows excluding old imports", async () => {
		seedAccessibleWorks(["work-1"]);
		const activeWork = {
			id: "work-1",
			ownerId: "user-1",
			activeImportId: "import-active",
			code: "OBRA-001",
			name: "Obra",
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			imports: [],
		};
		findFirst.mockResolvedValueOnce(activeWork);
		importFindFirst.mockResolvedValueOnce({ id: "import-active" });
		budgetItemFindMany.mockResolvedValueOnce([
			{ id: "budget-1", importId: "import-active" },
		]);
		baselineFindMany.mockResolvedValueOnce([
			{ id: "baseline-1", importId: "import-active" },
		]);
		revisionFindMany.mockResolvedValueOnce([
			{ id: "revision-1", importId: "import-active" },
		]);
		measurementFindMany.mockResolvedValueOnce([
			{ id: "measurement-active", importId: "import-active" },
			{ id: "measurement-manual", importId: null },
		]);
		actualCostFindMany.mockResolvedValueOnce([
			{ id: "cost-active", importId: "import-active" },
			{ id: "cost-manual", importId: null },
		]);
		const { getWorkWithItems } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		const result = await getWorkWithItems("user-1", "work-1");

		expect(budgetItemFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					ownerId: "user-1",
					workId: "work-1",
					importId: "import-active",
				},
			}),
		);
		expect(baselineFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					ownerId: "user-1",
					workId: "work-1",
					importId: "import-active",
				},
			}),
		);
		const scopedManualOrActiveRows = {
			OR: expect.arrayContaining([
				{ ownerId: "user-1", workId: "work-1", importId: "import-active" },
				{ ownerId: "user-1", workId: "work-1", importId: null },
			]),
		};
		expect(measurementFindMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: scopedManualOrActiveRows }),
		);
		expect(actualCostFindMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: scopedManualOrActiveRows }),
		);
		expect(result).toMatchObject({
			items: [{ id: "budget-1", importId: "import-active" }],
			baselineSchedules: [{ id: "baseline-1", importId: "import-active" }],
			scheduleRevisions: [{ id: "revision-1", importId: "import-active" }],
			measurements: [
				{ id: "measurement-active", importId: "import-active" },
				{ id: "measurement-manual", importId: null },
			],
			actualCosts: [
				{ id: "cost-active", importId: "import-active" },
				{ id: "cost-manual", importId: null },
			],
		});
	});

	it("reads all works with active-import rows plus manual measurement and cost rows excluding old imports", async () => {
		seedAccessibleWorks(["work-1"]);
		findMany.mockResolvedValueOnce([
			{
				id: "work-1",
				ownerId: "user-1",
				activeImportId: "import-active",
				code: "OBRA-001",
				name: "Obra",
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				imports: [],
			},
		]);
		budgetItemFindMany.mockResolvedValueOnce([
			{ id: "budget-active", workId: "work-1", importId: "import-active" },
		]);
		baselineFindMany.mockResolvedValueOnce([]);
		revisionFindMany.mockResolvedValueOnce([]);
		measurementFindMany.mockResolvedValueOnce([
			{ id: "measurement-active", workId: "work-1", importId: "import-active" },
			{ id: "measurement-manual", workId: "work-1", importId: null },
		]);
		actualCostFindMany.mockResolvedValueOnce([
			{ id: "cost-active", workId: "work-1", importId: "import-active" },
			{ id: "cost-manual", workId: "work-1", importId: null },
		]);
		const { getAllWorksWithItems } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		const result = await getAllWorksWithItems("user-1");

		const scopedManualOrActiveRows = [
			{ ownerId: "user-1", workId: "work-1", importId: "import-active" },
			{ ownerId: "user-1", workId: "work-1", importId: null },
		];
		expect(budgetItemFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					OR: [
						{ ownerId: "user-1", workId: "work-1", importId: "import-active" },
					],
				},
			}),
		);
		expect(measurementFindMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { OR: scopedManualOrActiveRows } }),
		);
		expect(actualCostFindMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { OR: scopedManualOrActiveRows } }),
		);
		expect(result[0]).toMatchObject({
			items: [{ id: "budget-active", importId: "import-active" }],
			measurements: [
				{ id: "measurement-active", importId: "import-active" },
				{ id: "measurement-manual", importId: null },
			],
			actualCosts: [
				{ id: "cost-active", importId: "import-active" },
				{ id: "cost-manual", importId: null },
			],
		});
	});

	it("does not return a work owned by another user", async () => {
		const { getWorkById } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		const result = await getWorkById("owner-a", "work-owned-by-owner-b");

		expect(result).toBeNull();
		expect(findFirst).not.toHaveBeenCalled();
	});

	it("caps multiworks aggregation at 1000 works and warns when the cap is hit", async () => {
		const warnSpy = spyOn(logger, "warn");
		const workIds = Array.from({ length: 1001 }, (_, i) => `work-${i}`);
		seedAccessibleWorks(workIds);
		const works = Array.from({ length: 1001 }, (_, i) => ({
			id: `work-${i}`,
			ownerId: "user-1",
			activeImportId: "import-active",
			code: `OBRA-${i}`,
			name: `Obra ${i}`,
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			imports: [],
		}));
		findMany.mockImplementationOnce(async (args: { take?: number }) =>
			works.slice(0, args.take),
		);
		const { getAllWorksWithItems } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		const result = await getAllWorksWithItems("user-1");

		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				take: 1000,
				orderBy: { createdAt: "desc" },
			}),
		);
		expect(result).toHaveLength(1000);
		expect(warnSpy).toHaveBeenCalledWith("bi.multiworks.cap", {
			ownerId: "user-1",
			limit: 1000,
		});
	});

	it("does not warn for multiworks aggregation below the cap", async () => {
		const warnSpy = spyOn(logger, "warn");
		seedAccessibleWorks(["work-1"]);
		findMany.mockResolvedValueOnce([
			{
				id: "work-1",
				ownerId: "user-1",
				activeImportId: null,
				code: "OBRA-001",
				name: "Obra",
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				imports: [],
			},
		]);
		const { getAllWorksWithItems } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		const result = await getAllWorksWithItems("user-1");

		expect(result).toHaveLength(1);
		expect(warnSpy).not.toHaveBeenCalledWith(
			"bi.multiworks.cap",
			expect.anything(),
		);
	});

	it("updates a work with owner scope in the mutation predicate", async () => {
		findFirst.mockResolvedValueOnce({
			id: "work-owned-by-owner-a",
			ownerId: "owner-a",
		});
		const { updateWork } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		await updateWork("owner-a", "work-owned-by-owner-a", {
			name: "Obra Atualizada",
		});

		expect(workUpdate).toHaveBeenCalledWith({
			where: { id: "work-owned-by-owner-a", ownerId: "owner-a" },
			data: { name: "Obra Atualizada" },
		});
	});

	it("does not delete a work owned by another user", async () => {
		const { deleteWork } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		findFirst.mockResolvedValueOnce(null);
		const result = await deleteWork("owner-a", "work-owned-by-owner-b");

		expect(result).toBeNull();
		expect(findFirst).toHaveBeenCalledWith({
			where: { id: "work-owned-by-owner-b", ownerId: "owner-a" },
		});
		expect(workDelete).not.toHaveBeenCalled();
	});

	it("returns the deleted work and keeps delete predicates owner-scoped", async () => {
		const work = { id: "work-owned-by-owner-a", ownerId: "owner-a" };
		findFirst.mockResolvedValueOnce(work);
		workDelete.mockResolvedValueOnce(work);
		const { deleteWork } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		const result = await deleteWork("owner-a", "work-owned-by-owner-a");

		expect(result).toMatchObject(work);
		expect(workDelete).toHaveBeenCalledWith({
			where: { id: "work-owned-by-owner-a", ownerId: "owner-a" },
		});
	});

	it("counts work dependencies scoped by owner and work id", async () => {
		importCount.mockResolvedValueOnce(1);
		contractCount.mockResolvedValueOnce(3);
		membershipCount.mockResolvedValueOnce(2);
		const { getWorkDependencyCounts } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		const result = await getWorkDependencyCounts("owner-a", "work-1");

		expect(result).toEqual({
			imports: 1,
			importBatches: 0,
			budgetItems: 0,
			budgetVersions: 0,
			budgetIdentities: 0,
			baselines: 0,
			scheduleRevisions: 0,
			scheduleVersions: 0,
			measurements: 0,
			actualCosts: 0,
			supplierLinks: 0,
			workMeasurements: 0,
			contracts: 3,
			memberships: 2,
			photoReports: 0,
			ledgerEvents: 0,
			budgetImpacts: 0,
			monthlyFacts: 0,
		});
		expect(importCount).toHaveBeenCalledWith({
			where: { ownerId: "owner-a", workId: "work-1" },
		});
		expect(contractCount).toHaveBeenCalledWith({
			where: { ownerId: "owner-a", workId: "work-1" },
		});
		expect(membershipCount).toHaveBeenCalledWith({
			where: { workId: "work-1" },
		});
	});

	it("creates manual measurements with null import id and owner-scoped work connect", async () => {
		findFirst.mockResolvedValueOnce({ activeImportId: "import-active" });
		budgetItemFindFirst.mockResolvedValueOnce({ id: "budget-1" });
		const { createMeasurement } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		await createMeasurement("owner-a", "work-owned-by-owner-a", null, {
			index: "1.1",
			measurementDate: "2026-01-15",
			measuredPercentageAccumulated: 50,
		});

		const createCall = (
			measurementCreate.mock.calls as unknown as Array<
				[{ data: Record<string, unknown> }]
			>
		)[0]?.[0];
		expect(createCall).toBeDefined();
		const createData = createCall?.data ?? {};
		expect(createData).toMatchObject({
			ownerId: "owner-a",
			work: { connect: { id: "work-owned-by-owner-a", ownerId: "owner-a" } },
			budgetItem: {
				connect: {
					id: "budget-1",
					ownerId: "owner-a",
					workId: "work-owned-by-owner-a",
				},
			},
		});
		expect(createData).not.toHaveProperty("import");
		expect(createData).not.toHaveProperty("importId");
	});

	it("looks up measurement budget items inside the work active import", async () => {
		findFirst.mockResolvedValueOnce({ activeImportId: "import-active" });
		budgetItemFindFirst.mockResolvedValueOnce({ id: "budget-active" });
		const { createMeasurement } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		await createMeasurement("owner-a", "work-owned-by-owner-a", null, {
			index: "1.1",
			measurementDate: "2026-01-15",
			measuredPercentageAccumulated: 50,
		});

		expect(findFirst).toHaveBeenCalledWith({
			where: { id: "work-owned-by-owner-a", ownerId: "owner-a" },
			select: { activeImportId: true },
		});
		expect(budgetItemFindFirst).toHaveBeenCalledWith({
			where: {
				ownerId: "owner-a",
				workId: "work-owned-by-owner-a",
				importId: "import-active",
				index: "1.1",
			},
			select: { id: true },
		});
	});

	it("lists measurements only from the active import and manual rows", async () => {
		findFirst.mockResolvedValueOnce({ activeImportId: "import-active" });
		const { listMeasurements } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		await listMeasurements("owner-a", "work-owned-by-owner-a");

		expect(findFirst).toHaveBeenCalledWith({
			where: { id: "work-owned-by-owner-a", ownerId: "owner-a" },
			select: { activeImportId: true },
		});
		expect(measurementFindMany).toHaveBeenCalledWith({
			where: {
				OR: [
					{
						ownerId: "owner-a",
						workId: "work-owned-by-owner-a",
						importId: "import-active",
					},
					{
						ownerId: "owner-a",
						workId: "work-owned-by-owner-a",
						importId: null,
					},
				],
			},
			orderBy: { measurementDate: "asc" },
		});
	});

	it("lists only manual measurements when the work has no active import", async () => {
		findFirst.mockResolvedValueOnce({ activeImportId: null });
		const { listMeasurements } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		await listMeasurements("owner-a", "work-owned-by-owner-a");

		expect(measurementFindMany).toHaveBeenCalledWith({
			where: {
				ownerId: "owner-a",
				workId: "work-owned-by-owner-a",
				importId: null,
			},
			orderBy: { measurementDate: "asc" },
		});
	});

	it("does not delete a measurement owned by another user", async () => {
		const { deleteMeasurement } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		const result = await deleteMeasurement(
			"owner-a",
			"work-owned-by-owner-a",
			"measurement-owned-by-owner-b",
		);

		expect(result).toBeNull();
		expect(measurementFindFirst).toHaveBeenCalledWith({
			where: {
				id: "measurement-owned-by-owner-b",
				ownerId: "owner-a",
				workId: "work-owned-by-owner-a",
			},
		});
		expect(measurementDelete).not.toHaveBeenCalled();
	});

	it("deletes measurements with owner scope in the mutation predicate", async () => {
		measurementFindFirst.mockResolvedValueOnce({
			id: "measurement-1",
			ownerId: "owner-a",
		});
		const { deleteMeasurement } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		await deleteMeasurement(
			"owner-a",
			"work-owned-by-owner-a",
			"measurement-1",
		);

		expect(measurementDelete).toHaveBeenCalledWith({
			where: {
				id: "measurement-1",
				ownerId: "owner-a",
				workId: "work-owned-by-owner-a",
			},
		});
	});

	it("lists actual costs only from the active import and manual rows", async () => {
		findFirst.mockResolvedValueOnce({ activeImportId: "import-active" });
		actualCostCount.mockResolvedValueOnce(0);
		const { listActualCosts } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		await listActualCosts("owner-a", "work-owned-by-owner-a");

		expect(findFirst).toHaveBeenCalledWith({
			where: { id: "work-owned-by-owner-a", ownerId: "owner-a" },
			select: { activeImportId: true },
		});
		expect(actualCostFindMany).toHaveBeenCalledWith({
			where: {
				AND: [
					{ ownerId: "owner-a", workId: "work-owned-by-owner-a" },
					{ OR: [{ importId: "import-active" }, { importId: null }] },
				],
			},
			orderBy: { costDate: "asc" },
			skip: 0,
			take: 10,
			include: {
				allocations: {
					include: {
						budgetItem: {
							select: {
								id: true,
								index: true,
								type: true,
								description: true,
								unit: true,
							},
						},
					},
				},
				supplier: { select: { id: true, name: true } },
			},
		});
		expect(actualCostCount).toHaveBeenCalled();
	});

	it("lists only manual actual costs when the work has no active import", async () => {
		findFirst.mockResolvedValueOnce({ activeImportId: null });
		actualCostCount.mockResolvedValueOnce(0);
		const { listActualCosts } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		await listActualCosts("owner-a", "work-owned-by-owner-a");

		expect(actualCostFindMany).toHaveBeenCalledWith({
			where: {
				AND: [
					{ ownerId: "owner-a", workId: "work-owned-by-owner-a" },
					{ importId: null },
				],
			},
			orderBy: { costDate: "asc" },
			skip: 0,
			take: 10,
			include: {
				allocations: {
					include: {
						budgetItem: {
							select: {
								id: true,
								index: true,
								type: true,
								description: true,
								unit: true,
							},
						},
					},
				},
				supplier: { select: { id: true, name: true } },
			},
		});
		expect(actualCostCount).toHaveBeenCalled();
	});

	it("creates manual actual costs with null import id and owner-scoped work connect", async () => {
		const { createActualCost } = await import(
			"../../../../src/modules/construction-planning/repository"
		);
		budgetItemFindMany.mockResolvedValueOnce([{ id: "item-a" }]);

		await createActualCost("owner-a", "work-owned-by-owner-a", null, {
			costDate: "2026-01-20",
			category: "MATERIAL",
			amount: 123,
			costType: "CURRENT",
			paymentStatus: "OPEN",
			allocations: [{ budgetItemId: "item-a", percentage: 100 }],
		});

		const createCall = (
			actualCostCreate.mock.calls as unknown as Array<
				[{ data: Record<string, unknown> }]
			>
		)[0]?.[0];
		expect(createCall).toBeDefined();
		const createData = createCall?.data ?? {};
		expect(createData).toMatchObject({
			ownerId: "owner-a",
			work: { connect: { id: "work-owned-by-owner-a", ownerId: "owner-a" } },
		});
		expect(createData).not.toHaveProperty("import");
		expect(createData).not.toHaveProperty("importId");
	});

	it("looks up actual cost budget items inside the work active import", async () => {
		findFirst.mockResolvedValueOnce({ activeImportId: "import-active" });
		budgetItemFindFirst.mockResolvedValueOnce({ id: "budget-active" });
		budgetItemFindMany.mockResolvedValueOnce([{ id: "item-a" }]);
		const { createActualCost } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		await createActualCost("owner-a", "work-owned-by-owner-a", null, {
			costDate: "2026-01-20",
			budgetIndex: "1.1",
			category: "MATERIAL",
			amount: 123,
			costType: "CURRENT",
			paymentStatus: "OPEN",
			allocations: [{ budgetItemId: "item-a", percentage: 100 }],
		});

		expect(findFirst).toHaveBeenCalledWith({
			where: { id: "work-owned-by-owner-a", ownerId: "owner-a" },
			select: { activeImportId: true },
		});
		expect(budgetItemFindFirst).toHaveBeenCalledWith({
			where: {
				ownerId: "owner-a",
				workId: "work-owned-by-owner-a",
				importId: "import-active",
				index: "1.1",
			},
			select: { id: true },
		});
	});

	it("does not delete an actual cost owned by another user", async () => {
		const { deleteActualCost } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		const result = await deleteActualCost(
			"owner-a",
			"work-owned-by-owner-a",
			"cost-owned-by-owner-b",
		);

		expect(result).toBeNull();
		expect(actualCostFindFirst).toHaveBeenCalledWith({
			where: {
				id: "cost-owned-by-owner-b",
				ownerId: "owner-a",
				workId: "work-owned-by-owner-a",
			},
		});
		expect(actualCostDelete).not.toHaveBeenCalled();
	});

	it("deletes actual costs with owner scope in the mutation predicate", async () => {
		actualCostFindFirst.mockResolvedValueOnce({
			id: "cost-1",
			ownerId: "owner-a",
		});
		const { deleteActualCost } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		await deleteActualCost("owner-a", "work-owned-by-owner-a", "cost-1");

		expect(actualCostDelete).toHaveBeenCalledWith({
			where: {
				id: "cost-1",
				ownerId: "owner-a",
				workId: "work-owned-by-owner-a",
			},
		});
	});
});

describe("listWorks", () => {
	beforeEach(() => {
		mock.clearAllMocks();
	});

	it("uses active budget semantics for list totals", async () => {
		findMany.mockResolvedValueOnce([
			{
				id: "w1",
				code: "C001",
				name: "Work",
				costCenterId: "cc-1",
				activeImportId: "import-active",
				plannedStart: null,
				plannedEnd: null,
				baseDate: new Date("2026-01-15T00:00:00.000Z"),
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				imports: [{ createdAt: new Date("2026-01-02T00:00:00.000Z") }],
				costCenter: {
					id: "cc-1",
					name: "CC 1",
					organizationId: "org-1",
					organization: { id: "org-1", name: "Org 1" },
				},
			},
		]);
		budgetItemFindMany.mockResolvedValueOnce([
			{
				id: "i1",
				workId: "w1",
				importId: "import-active",
				parentId: null,
				index: "001",
				type: "ITEM",
				description: "Item 1",
				quantity: null,
				laborUnitCost: null,
				materialUnitCost: null,
				equipmentUnitCost: null,
				otherUnitCost: null,
				totalBudget: 100,
				totalCost: 100,
				plannedStart: null,
				plannedEnd: null,
				actualStart: null,
				actualEnd: null,
				completionPercentage: 0.5,
				computedStatus: "IN_PROGRESS",
				sortOrder: 1,
			},
			{
				id: "i2",
				workId: "w1",
				importId: "import-active",
				parentId: null,
				index: "002",
				type: "ITEM",
				description: "Item 2",
				quantity: null,
				laborUnitCost: null,
				materialUnitCost: null,
				equipmentUnitCost: null,
				otherUnitCost: null,
				totalBudget: 200,
				totalCost: 200,
				plannedStart: null,
				plannedEnd: null,
				actualStart: null,
				actualEnd: null,
				completionPercentage: 1,
				computedStatus: "IGNORED",
				sortOrder: 2,
			},
			{
				id: "i3",
				workId: "w1",
				importId: "import-active",
				parentId: null,
				index: "003",
				type: "ITEM",
				description: "Item 3",
				quantity: null,
				laborUnitCost: null,
				materialUnitCost: null,
				equipmentUnitCost: null,
				otherUnitCost: null,
				totalBudget: 300,
				totalCost: 300,
				plannedStart: null,
				plannedEnd: null,
				actualStart: null,
				actualEnd: null,
				completionPercentage: 0,
				computedStatus: "SUSPENDED",
				sortOrder: 3,
			},
		]);
		baselineFindMany.mockResolvedValueOnce([]);
		revisionFindMany.mockResolvedValueOnce([]);
		measurementFindMany.mockResolvedValueOnce([]);
		actualCostFindMany.mockResolvedValueOnce([]);

		const { listWorks } = await import(
			"../../../../src/modules/construction-planning/repository"
		);
		const result = await listWorks("owner-1", { page: 1, limit: 10 });

		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				include: expect.objectContaining({
					costCenter: expect.objectContaining({
						select: expect.objectContaining({
							organizationId: true,
						}),
					}),
				}),
			}),
		);
		expect(result.data[0]).toMatchObject({
			baseDate: "2026-01-15T00:00:00.000Z",
			costCenterId: "cc-1",
			costCenterName: "CC 1",
			organizationId: "org-1",
			organizationName: "Org 1",
			totalBudget: 400,
			measuredPercentage: 0.125,
			balance: 350,
			computedStatus: "IN_PROGRESS",
		});
	});
});

const costCenterFindMany = mock(async (): Promise<unknown[]> => []);

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		$transaction: transaction,
		costCenter: {
			findMany: costCenterFindMany,
		},
		constructionWork: {
			create: workCreate,
			update: workUpdate,
			delete: workDelete,
			count: workCount,
			findMany,
			findFirst,
			findUnique,
		},
		constructionImport: {
			create: importCreate,
			findFirst: importFindFirst,
			deleteMany: importDeleteMany,
			findMany: importFindMany,
			count: importCount,
		},
		importBatch: {
			count: importBatchCount,
		},
		constructionBudgetItem: {
			create: budgetItemCreate,
			deleteMany: budgetItemDeleteMany,
			findMany: budgetItemFindMany,
			findFirst: budgetItemFindFirst,
			count: budgetItemCount,
		},
		budgetVersion: {
			count: budgetVersionCount,
		},
		budgetItemIdentity: {
			count: budgetIdentityCount,
		},
		constructionBaselineSchedule: {
			createMany: baselineCreateMany,
			deleteMany: baselineDeleteMany,
			findMany: baselineFindMany,
			count: baselineCount,
		},
		constructionScheduleRevision: {
			createMany: revisionCreateMany,
			deleteMany: revisionDeleteMany,
			findMany: revisionFindMany,
			count: revisionCount,
		},
		scheduleVersion: {
			count: scheduleVersionCount,
		},
		constructionMeasurement: {
			createMany: measurementCreateMany,
			create: measurementCreate,
			deleteMany: measurementDeleteMany,
			findMany: measurementFindMany,
			findFirst: measurementFindFirst,
			delete: measurementDelete,
			count: measurementCount,
		},
		constructionActualCost: {
			createMany: actualCostCreateMany,
			create: actualCostCreate,
			deleteMany: actualCostDeleteMany,
			count: actualCostCount,
			findMany: actualCostFindMany,
			findFirst: actualCostFindFirst,
			delete: actualCostDelete,
		},
		constructionWorkSupplier: {
			count: supplierLinkCount,
		},
		workMeasurement: {
			count: workMeasurementCount,
		},
		contract: {
			count: contractCount,
		},
		photoReport: {
			count: photoReportCount,
		},
		constructionLedgerEvent: {
			count: ledgerEventCount,
		},
		constructionBudgetImpact: {
			count: budgetImpactCount,
		},
		constructionMonthlyFact: {
			count: monthlyFactCount,
		},
		user: {
			findUnique: userFindUnique,
		},
		workMembership: {
			findMany: workMembershipFindMany,
			count: membershipCount,
		},
		costCenterMembership: {
			findMany: costCenterMembershipFindMany,
		},
		organizationMembership: {
			findMany: organizationMembershipFindMany,
		},
	},
}));
describe("getWorksByCostCenter", () => {
	beforeEach(() => {
		mock.clearAllMocks();
	});

	it("returns works with items for a specific cost center", async () => {
		seedAccessibleWorks(["work-cc1"]);
		findMany.mockResolvedValueOnce([
			{
				id: "work-cc1",
				ownerId: "owner-1",
				activeImportId: "import-active",
				code: "OBRA-001",
				name: "Obra CC1",
				clientName: null,
				plannedStart: null,
				plannedEnd: null,
				baseDate: null,
				costCenterId: "cc-1",
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				imports: [{ createdAt: new Date("2026-01-02T00:00:00.000Z") }],
			},
		]);
		budgetItemFindMany.mockResolvedValueOnce([
			{
				id: "budget-active",
				workId: "work-cc1",
				importId: "import-active",
				parentId: null,
				index: "1",
				type: "ITEM",
				description: "Item",
				quantity: null,
				laborUnitCost: null,
				materialUnitCost: null,
				equipmentUnitCost: null,
				otherUnitCost: null,
				totalBudget: 100,
				totalCost: 100,
				plannedStart: null,
				plannedEnd: null,
				actualStart: null,
				actualEnd: null,
				completionPercentage: 0,
				computedStatus: "NOT_STARTED",
				sortOrder: 1,
			},
		]);
		baselineFindMany.mockResolvedValueOnce([]);
		revisionFindMany.mockResolvedValueOnce([]);
		measurementFindMany.mockResolvedValueOnce([]);
		actualCostFindMany.mockResolvedValueOnce([]);

		const { getWorksByCostCenter } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		const result = await getWorksByCostCenter("owner-1", "cc-1");

		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: { in: ["work-cc1"] }, costCenterId: "cc-1" },
			}),
		);
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			id: "work-cc1",
			items: [{ id: "budget-active" }],
		});
	});

	it("returns empty array when cost center has no works", async () => {
		findMany.mockResolvedValueOnce([]);

		const { getWorksByCostCenter } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		const result = await getWorksByCostCenter("owner-1", "empty-cc");

		expect(result).toEqual([]);
	});

	it("filters by owner scope for cost center works", async () => {
		findMany.mockResolvedValueOnce([]);

		const { getWorksByCostCenter } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		await getWorksByCostCenter("owner-a", "cc-shared");

		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: { in: [] }, costCenterId: "cc-shared" },
			}),
		);
	});
});

describe("getWorksByOrganization", () => {
	beforeEach(() => {
		mock.clearAllMocks();
	});

	it("returns works for all cost centers of an organization", async () => {
		costCenterFindMany.mockResolvedValueOnce([{ id: "cc-1" }, { id: "cc-2" }]);
		seedAccessibleWorks(["work-1", "work-2"]);
		findMany.mockResolvedValueOnce([
			{
				id: "work-1",
				ownerId: "owner-1",
				activeImportId: "import-active",
				code: "OBRA-001",
				name: "Obra 1",
				clientName: null,
				plannedStart: null,
				plannedEnd: null,
				baseDate: null,
				costCenterId: "cc-1",
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				imports: [{ createdAt: new Date("2026-01-02T00:00:00.000Z") }],
			},
			{
				id: "work-2",
				ownerId: "owner-1",
				activeImportId: null,
				code: "OBRA-002",
				name: "Obra 2",
				clientName: null,
				plannedStart: null,
				plannedEnd: null,
				baseDate: null,
				costCenterId: "cc-2",
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				imports: [],
			},
		]);
		budgetItemFindMany.mockResolvedValueOnce([]);
		baselineFindMany.mockResolvedValueOnce([]);
		revisionFindMany.mockResolvedValueOnce([]);
		measurementFindMany.mockResolvedValueOnce([]);
		actualCostFindMany.mockResolvedValueOnce([]);

		const { getWorksByOrganization } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		const result = await getWorksByOrganization("owner-1", "org-1");

		expect(costCenterFindMany).toHaveBeenCalledWith({
			where: { ownerId: "owner-1", organizationId: "org-1" },
			select: { id: true },
		});
		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					id: { in: ["work-1", "work-2"] },
					costCenterId: { in: ["cc-1", "cc-2"] },
				},
			}),
		);
		expect(result).toHaveLength(2);
		expect(result[0].id).toBe("work-1");
		expect(result[1].id).toBe("work-2");
	});

	it("returns empty array when organization has no cost centers", async () => {
		costCenterFindMany.mockResolvedValueOnce([]);

		const { getWorksByOrganization } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		const result = await getWorksByOrganization("owner-1", "empty-org");

		expect(result).toEqual([]);
		expect(findMany).not.toHaveBeenCalled();
	});

	it("filters by owner scope for organization works", async () => {
		costCenterFindMany.mockResolvedValueOnce([]);

		const { getWorksByOrganization } = await import(
			"../../../../src/modules/construction-planning/repository"
		);

		await getWorksByOrganization("owner-b", "org-shared");

		expect(costCenterFindMany).toHaveBeenCalledWith({
			where: { ownerId: "owner-b", organizationId: "org-shared" },
			select: { id: true },
		});
	});
});
