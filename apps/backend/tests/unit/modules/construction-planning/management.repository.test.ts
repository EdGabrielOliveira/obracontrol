import { beforeEach, describe, expect, it, mock } from "bun:test";

const workFindFirst = mock(async (): Promise<unknown | null> => null);
const budgetItemFindMany = mock(async (): Promise<unknown[]> => []);
const workMeasurementFindMany = mock(async (): Promise<unknown[]> => []);
const baselineFindMany = mock(async (): Promise<unknown[]> => []);
const actualCostFindMany = mock(async (): Promise<unknown[]> => []);

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		constructionWork: { findFirst: workFindFirst },
		constructionBudgetItem: { findMany: budgetItemFindMany },
		workMeasurement: { findMany: workMeasurementFindMany },
		constructionBaselineSchedule: { findMany: baselineFindMany },
		constructionActualCost: { findMany: actualCostFindMany },
		constructionLedgerEvent: { groupBy: mock(async () => []) },
	},
}));

const getWorkWithItems = mock(async (): Promise<unknown | null> => null);
const getWorkMeasurementsForBI = mock(async (): Promise<unknown[]> => []);

mock.module(
	"../../../../src/modules/construction-planning/works/works.repository",
	() => ({
		getWorkWithItems,
		getWorkById: mock(async () => null),
	}),
);
mock.module(
	"../../../../src/modules/construction-planning/bi/budget-balance-source",
	() => ({
		getOfficialWorkBalance: mock(async () => ({
			limit: 0,
			approvedCommitted: 0,
			approvedConsumed: 0,
			dueOpen: 0,
			paid: 0,
			pendingImpact: 0,
			availableBalance: 0,
			projectedBalance: 0,
			sourceMode: "LIVE" as const,
			coverage: "UNAVAILABLE" as const,
			items: [],
		})),
	}),
);
mock.module("../../../../src/modules/construction-planning/repository", () => ({
	getWorkMeasurementsForBI,
}));
mock.module(
	"../../../../src/modules/construction-planning/work-measurement.repository",
	() => ({
		getWorkMeasurementsForBI,
	}),
);

const listContractSnapshotRows = mock(async (): Promise<unknown[]> => []);
mock.module(
	"../../../../src/modules/construction-planning/contract.repository",
	() => ({ listContractSnapshotRows }),
);

function makeStoredWork() {
	return {
		id: "work-1",
		ownerId: "owner-1",
		code: "OBRA-001",
		name: "Obra Unificada",
		clientName: "Cliente A",
		plannedStart: new Date("2026-01-01T00:00:00.000Z"),
		plannedEnd: new Date("2026-01-31T00:00:00.000Z"),
		baseDate: new Date("2026-01-15T00:00:00.000Z"),
		activeImportId: "import-1",
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		imports: [{ createdAt: new Date("2026-01-02T00:00:00.000Z") }],
		items: [
			{
				id: "stage-1",
				parentId: null,
				index: "1",
				type: "STAGE",
				description: "Fundacao",
				unit: null,
				quantity: null,
				unitCost: null,
				totalCost: 0,
				totalBudget: 0,
				plannedStart: null,
				plannedEnd: null,
				actualStart: null,
				actualEnd: null,
				completionPercentage: 0,
				providedStatus: null,
				computedStatus: "NOT_STARTED",
				sortOrder: 1,
			},
			{
				id: "item-1",
				parentId: "stage-1",
				index: "1.1",
				type: "ITEM",
				description: "Escavacao",
				unit: "m3",
				quantity: 10,
				unitCost: 55,
				totalCost: 550,
				totalBudget: 550,
				plannedStart: null,
				plannedEnd: null,
				actualStart: null,
				actualEnd: null,
				completionPercentage: 0,
				providedStatus: "Ativo",
				computedStatus: "IN_PROGRESS",
				sortOrder: 2,
			},
			{
				id: "item-2",
				parentId: "stage-1",
				index: "1.2",
				type: "ITEM",
				description: "Ignorado",
				unit: null,
				quantity: null,
				unitCost: null,
				totalCost: 200,
				totalBudget: 200,
				plannedStart: null,
				plannedEnd: null,
				actualStart: null,
				actualEnd: null,
				completionPercentage: 1,
				providedStatus: "Inativo",
				computedStatus: "IGNORED",
				sortOrder: 3,
			},
		],
		baselineSchedules: [
			{
				id: "baseline-1",
				budgetItemId: "item-1",
				index: "1.1",
				plannedStart: new Date("2026-01-01T00:00:00.000Z"),
				plannedEnd: new Date("2026-01-31T00:00:00.000Z"),
				plannedWeight: null,
			},
		],
		scheduleRevisions: [],
		measurements: [
			{
				id: "measurement-1",
				budgetItemId: "item-1",
				index: "1.1",
				measurementDate: new Date("2026-01-15T00:00:00.000Z"),
				measuredPercentageAccumulated: 0.5,
				measuredQuantityAccumulated: null,
			},
		],
		actualCosts: [
			{
				id: "cost-1",
				budgetItemId: "item-1",
				budgetIndex: "1.1",
				costDate: new Date("2026-01-10T00:00:00.000Z"),
				amount: 200,
				costType: "CURRENT",
				category: "MATERIAL",
				appropriationStatus: "APPROPRIATED",
			},
			{
				id: "cost-2",
				budgetItemId: null,
				budgetIndex: null,
				costDate: new Date("2026-01-20T00:00:00.000Z"),
				amount: 50,
				costType: "FUTURE",
				category: "RESERVA",
				appropriationStatus: "UNAPPROPRIATED",
			},
		],
	};
}

function makeIdentity() {
	return {
		id: "work-1",
		name: "Obra Unificada",
		code: "OBRA-001",
		costCenter: { id: "cc-1", name: "CC 1" },
	};
}

describe("management repository projections", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		workFindFirst.mockResolvedValue(null);
		getWorkWithItems.mockResolvedValue(null);
		getWorkMeasurementsForBI.mockResolvedValue([]);
		listContractSnapshotRows.mockResolvedValue([]);
	});

	it("projects the work report from the canonical metrics snapshot", async () => {
		workFindFirst.mockResolvedValue(makeIdentity());
		getWorkWithItems.mockResolvedValue(makeStoredWork());
		getWorkMeasurementsForBI.mockResolvedValue([]);

		const { getWorkReport } = await import(
			"../../../../src/modules/construction-planning/management.repository"
		);
		const report = await getWorkReport("owner-1", "work-1");

		expect(report).toEqual(
			expect.objectContaining({
				work: { id: "work-1", name: "Obra Unificada", code: "OBRA-001" },
				costCenter: { id: "cc-1", name: "CC 1" },
				budget: {
					total: 550,
					itemsCount: 3,
					byStatus: { active: 1, done: 0, notStarted: 1 },
				},
				measurements: { total: 275, count: 0, percentage: 0.5 },
				costs: { total: 200, balance: 350 },
				sourceMode: "LIVE",
				snapshot: null,
			}),
		);
		expect(report?.evm).toMatchObject({
			earnedValue: 275,
			actualCost: 200,
			currentBudgetBalance: 350,
			projectedBudgetBalance: 300,
			costVariance: 75,
			costPerformanceIndex: 1.375,
		});
		expect(report?.evm.plannedValue).toBeCloseTo((550 * 15) / 31, 8);
		expect(report?.evm.scheduleVariance).toBeCloseTo(275 - (550 * 15) / 31, 8);
		expect(report?.evm.schedulePerformanceIndex).toBeCloseTo(
			275 / ((550 * 15) / 31),
			8,
		);
		expect(report?.qualityIssues).toEqual([
			expect.objectContaining({
				code: "UNAPPROPRIATED_FUTURE_COSTS",
				severity: "MEDIUM",
				metric: "AC",
				workId: "work-1",
			}),
		]);
	});

	it("cuts the dashboard by asOfDate in LIVE mode", async () => {
		workFindFirst.mockResolvedValue(makeIdentity());
		getWorkWithItems.mockResolvedValue(makeStoredWork());
		getWorkMeasurementsForBI.mockResolvedValue([]);

		const { getWorkManagementDashboard } = await import(
			"../../../../src/modules/construction-planning/management.repository"
		);
		const dashboard = await getWorkManagementDashboard(
			"owner-1",
			"work-1",
			new Date("2026-01-01T00:00:00.000Z"),
		);

		expect(dashboard?.sourceMode).toBe("LIVE");
		expect(dashboard?.budgeted).toBe(550);
		expect(dashboard?.spent).toBe(0);
		expect(dashboard?.balance).toBe(550);
	});

	it("cuts the work report EVM by asOfDate in LIVE mode", async () => {
		workFindFirst.mockResolvedValue(makeIdentity());
		getWorkWithItems.mockResolvedValue(makeStoredWork());
		getWorkMeasurementsForBI.mockResolvedValue([]);

		const { getWorkReport } = await import(
			"../../../../src/modules/construction-planning/management.repository"
		);
		const report = await getWorkReport(
			"owner-1",
			"work-1",
			new Date("2026-01-01T00:00:00.000Z"),
		);

		expect(report).not.toBeNull();
		if (!report) return;

		expect(report.sourceMode).toBe("LIVE");
		expect(report.measurements.total).toBe(0);
		expect(report.evm.earnedValue).toBe(0);
		expect(report.evm.plannedValue).toBeCloseTo((550 * 1) / 31, 8);
		expect(report.evm.actualCost).toBe(0);
		expect(report.evm.costVariance).toBeNull();
		expect(report.evm.schedulePerformanceIndex).toBeNull();
		expect(report.costs.total).toBe(0);
	});

	it("projects the physical-financial schedule from the resolved source with asOfDate cut", async () => {
		workFindFirst.mockResolvedValue(makeIdentity());
		getWorkWithItems.mockResolvedValue(makeStoredWork());
		getWorkMeasurementsForBI.mockResolvedValue([]);

		const { getPhysicalFinancialSchedule } = await import(
			"../../../../src/modules/construction-planning/management.repository"
		);

		const schedule = await getPhysicalFinancialSchedule(
			"owner-1",
			"work-1",
			"monthly",
			new Date("2026-01-05T00:00:00.000Z"),
		);

		// Cost 1 (2026-01-10) e a medicao (2026-01-15) ficam apos o corte.
		expect(schedule.totals.actualAccumulated).toEqual([0]);
		expect(schedule.totals.measuredAccumulated).toEqual([0]);
		expect(schedule.sourceMode).toBe("LIVE");
		expect(schedule.snapshot).toBeNull();
	});

	it("keeps post-cutoff facts in the schedule when no asOfDate is given", async () => {
		workFindFirst.mockResolvedValue(makeIdentity());
		getWorkWithItems.mockResolvedValue(makeStoredWork());
		getWorkMeasurementsForBI.mockResolvedValue([]);

		const { getPhysicalFinancialSchedule } = await import(
			"../../../../src/modules/construction-planning/management.repository"
		);

		const schedule = await getPhysicalFinancialSchedule("owner-1", "work-1");

		expect(schedule.totals.actualAccumulated).toEqual([250]);
		expect(schedule.totals.measuredAccumulated).toEqual([275]);
		expect(schedule.sourceMode).toBe("LIVE");
	});

	it("returns report, dashboard and schedule from a single resolution via the context", async () => {
		workFindFirst.mockResolvedValue(makeIdentity());
		getWorkWithItems.mockResolvedValue(makeStoredWork());
		getWorkMeasurementsForBI.mockResolvedValue([]);

		const { getWorkManagementReportContext } = await import(
			"../../../../src/modules/construction-planning/management.repository"
		);

		const context = await getWorkManagementReportContext("owner-1", "work-1");

		expect(context).not.toBeNull();
		if (!context) return;

		expect(context.report.budget.total).toBe(context.dashboard.budgeted);
		expect(context.report.costs.total).toBe(context.dashboard.spent);
		expect(context.report.costs.balance).toBe(context.dashboard.balance);
		expect(context.schedule.totals.actualAccumulated).toEqual([250]);
		expect(context.report.sourceMode).toBe("LIVE");
		expect(context.dashboard.sourceMode).toBe("LIVE");
		expect(getWorkWithItems).toHaveBeenCalledTimes(1);
	});
});
