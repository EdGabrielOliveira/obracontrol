import { beforeEach, describe, expect, it, mock } from "bun:test";
import Decimal from "decimal.js";

const workFindFirst = mock(
	async (): Promise<unknown | null> => ({
		id: "work-1",
		activeImportId: "import-1",
	}),
);
const workUpdate = mock(async (): Promise<unknown> => ({ id: "work-1" }));
const importCreate = mock(async (): Promise<unknown> => ({ id: "import-1" }));
const budgetItemCreate = mock(async ({ data }: { data: unknown }) => data);
const budgetItemFindFirst = mock(async (): Promise<unknown | null> => null);
const budgetItemAggregate = mock(
	async (): Promise<unknown> => ({
		_sum: { totalCost: null },
		_count: { _all: 0 },
	}),
);
const getWorkById = mock(
	async (): Promise<Record<string, unknown>> => ({
		id: "work-1",
		code: "OB-001",
		name: "Obra Teste",
		bdiPercentage: 0,
		items: [],
		baselineSchedules: [],
		scheduleRevisions: [],
		measurements: [],
		actualCosts: [],
	}),
);
const getPhysicalFinancialSchedule = mock(async () => ({
	stages: [],
	totals: {
		months: [],
		plannedByMonth: [],
		measuredByMonth: [],
		actualByMonth: [],
		plannedAccumulated: [],
		measuredAccumulated: [],
		actualAccumulated: [],
	},
}));
const getWorkMeasurementSummary = mock(async () => ({
	totalMeasured: 0,
	totalMeasuredPercentage: 0,
	totalBudgeted: 0,
	balanceToMeasure: 0,
	measurementCount: 0,
	lastMeasurementDate: null,
}));

mock.module(
	"../../../../src/modules/construction-planning/works/works.repository",
	() => ({ getWorkById }),
);
mock.module(
	"../../../../src/modules/construction-planning/management.repository",
	() => ({
		getPhysicalFinancialSchedule,
	}),
);
mock.module(
	"../../../../src/modules/construction-planning/work-measurement.repository",
	() => ({
		getWorkMeasurementSummary,
	}),
);

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		constructionWork: {
			findFirst: workFindFirst,
			update: workUpdate,
		},
		constructionImport: {
			create: importCreate,
		},
		constructionBudgetItem: {
			create: budgetItemCreate,
			findFirst: budgetItemFindFirst,
			aggregate: budgetItemAggregate,
		},
	},
}));

describe("budget repository", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		workFindFirst.mockResolvedValue({
			id: "work-1",
			activeImportId: "import-1",
		});
		getWorkById.mockResolvedValue({
			id: "work-1",
			code: "OB-001",
			name: "Obra Teste",
			bdiPercentage: 0,
			items: [],
			baselineSchedules: [],
			scheduleRevisions: [],
			measurements: [],
			actualCosts: [],
		});
		getPhysicalFinancialSchedule.mockResolvedValue({
			stages: [],
			totals: {
				months: [],
				plannedByMonth: [],
				measuredByMonth: [],
				actualByMonth: [],
				plannedAccumulated: [],
				measuredAccumulated: [],
				actualAccumulated: [],
			},
		});
		getWorkMeasurementSummary.mockResolvedValue({
			totalMeasured: 0,
			totalMeasuredPercentage: 0,
			totalBudgeted: 0,
			balanceToMeasure: 0,
			measurementCount: 0,
			lastMeasurementDate: null,
		});
	});

	it("usa o resumo canonico de medicao no card total medido do orcamento", async () => {
		getWorkById.mockResolvedValueOnce({
			id: "work-1",
			code: "OB-001",
			name: "Obra Teste",
			bdiPercentage: 0,
			items: [
				{
					id: "item-1",
					parentId: null,
					index: "1",
					type: "ITEM",
					description: "Servico",
					unit: "un",
					quantity: 1,
					unitCost: 1000,
					totalCost: 1000,
					completionPercentage: 0,
					sortOrder: 1,
					children: [],
				},
			],
			baselineSchedules: [],
			scheduleRevisions: [],
			measurements: [],
			actualCosts: [],
			earnedValue: 0,
		});
		getWorkMeasurementSummary.mockResolvedValueOnce({
			totalMeasured: 350,
			totalMeasuredPercentage: 0.35,
			totalBudgeted: 1000,
			balanceToMeasure: 650,
			measurementCount: 2,
			lastMeasurementDate: null,
		});

		const { getBudgetView } = await import(
			"../../../../src/modules/construction-planning/budget.repository"
		);
		const result = await getBudgetView("owner-1", "work-1");

		expect(result?.summary).toMatchObject({
			totalBudgeted: 1000,
			totalMeasured: 350,
			balanceToMeasure: 650,
			measurementCount: 2,
		});
		expect(getWorkMeasurementSummary).toHaveBeenCalledWith("owner-1", "work-1");
	});

	it("permite omitir o calculo fisico-financeiro na leitura inicial", async () => {
		const { getBudgetView } = await import(
			"../../../../src/modules/construction-planning/budget.repository"
		);

		const result = await getBudgetView("owner-1", "work-1", {
			includePhysicalFinancial: false,
		});

		expect(getWorkById).toHaveBeenCalledWith("owner-1", "work-1", undefined, {
			includeOperationalChildren: false,
		});
		expect(getPhysicalFinancialSchedule).not.toHaveBeenCalled();
		expect(result?.physicalFinancial).toEqual({
			stages: [],
			totals: {
				months: [],
				plannedByMonth: [],
				measuredByMonth: [],
				actualByMonth: [],
				plannedAccumulated: [],
				measuredAccumulated: [],
				actualAccumulated: [],
			},
		});
	});

	it("normalizes manual budget item date-only fields before persisting", async () => {
		const { createBudgetItem } = await import(
			"../../../../src/modules/construction-planning/budget.repository"
		);

		await createBudgetItem("owner-1", "work-1", {
			index: "8",
			type: "STAGE",
			description: "Teste",
			plannedStart: "2026-07-15",
			plannedEnd: "2026-09-18",
		});

		expect(budgetItemCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({
				plannedStart: new Date("2026-07-15T00:00:00.000Z"),
				plannedEnd: new Date("2026-09-18T00:00:00.000Z"),
			}),
		});
	});

	it("rejects invalid manual budget item dates before Prisma create", async () => {
		const { createBudgetItem } = await import(
			"../../../../src/modules/construction-planning/budget.repository"
		);

		await expect(
			createBudgetItem("owner-1", "work-1", {
				index: "8",
				type: "STAGE",
				description: "Teste",
				plannedStart: "data-invalida",
			}),
		).rejects.toMatchObject({
			code: "INVALID_DATE",
			status: 400,
		});
		expect(budgetItemCreate).not.toHaveBeenCalled();
	});

	it("finds an item by index within the work, excluding the item being updated", async () => {
		const { findByIndex } = await import(
			"../../../../src/modules/construction-planning/budget.repository"
		);

		await findByIndex("owner-1", "work-1", "1.2");
		expect(budgetItemFindFirst).toHaveBeenLastCalledWith({
			where: { ownerId: "owner-1", workId: "work-1", index: "1.2" },
			select: { id: true },
		});

		await findByIndex("owner-1", "work-1", "1.2", "item-1");
		expect(budgetItemFindFirst).toHaveBeenLastCalledWith({
			where: {
				ownerId: "owner-1",
				workId: "work-1",
				index: "1.2",
				id: { not: "item-1" },
			},
			select: { id: true },
		});
	});

	it("sums children total cost with the parent total, rounding currency", async () => {
		const { sumChildrenTotalCost } = await import(
			"../../../../src/modules/construction-planning/budget.repository"
		);
		budgetItemFindFirst.mockResolvedValueOnce({
			totalCost: new Decimal("200.00"),
		});
		budgetItemAggregate.mockResolvedValueOnce({
			_sum: { totalCost: new Decimal("150.256") },
			_count: { _all: 2 },
		});

		const result = await sumChildrenTotalCost("owner-1", "work-1", "parent-1");

		expect(result).toEqual({
			parentTotalCost: 200,
			childrenTotalCost: 150.26,
			childrenCount: 2,
		});
		expect(budgetItemAggregate).toHaveBeenCalledWith({
			where: { parentId: "parent-1", ownerId: "owner-1", workId: "work-1" },
			_sum: { totalCost: true },
			_count: { _all: true },
		});
	});

	it("excludes the item being updated from the children total aggregate", async () => {
		const { sumChildrenTotalCost } = await import(
			"../../../../src/modules/construction-planning/budget.repository"
		);
		budgetItemFindFirst.mockResolvedValueOnce({
			totalCost: new Decimal("200.00"),
		});
		budgetItemAggregate.mockResolvedValueOnce({
			_sum: { totalCost: new Decimal("100.00") },
			_count: { _all: 1 },
		});

		const result = await sumChildrenTotalCost(
			"owner-1",
			"work-1",
			"parent-1",
			"item-1",
		);

		expect(result).toEqual({
			parentTotalCost: 200,
			childrenTotalCost: 100,
			childrenCount: 1,
		});
		expect(budgetItemAggregate).toHaveBeenCalledWith({
			where: {
				parentId: "parent-1",
				ownerId: "owner-1",
				workId: "work-1",
				id: { not: "item-1" },
			},
			_sum: { totalCost: true },
			_count: { _all: true },
		});
	});

	it("returns null from sumChildrenTotalCost when the parent is missing", async () => {
		const { sumChildrenTotalCost } = await import(
			"../../../../src/modules/construction-planning/budget.repository"
		);
		budgetItemFindFirst.mockResolvedValueOnce(null);

		await expect(
			sumChildrenTotalCost("owner-1", "work-1", "missing"),
		).resolves.toBeNull();
		expect(budgetItemAggregate).not.toHaveBeenCalled();
	});
});
