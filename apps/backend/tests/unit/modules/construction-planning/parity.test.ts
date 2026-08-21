import { beforeEach, describe, expect, it, mock } from "bun:test";
import { roundCurrency } from "../../../../src/lib/math-utils";

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
		biSnapshotScope: { findUnique: mock(async () => null) },
		contract: { findMany: mock(async () => []) },
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

const jan1 = new Date("2026-01-01T00:00:00.000Z");
const jan15 = new Date("2026-01-15T00:00:00.000Z");
const feb1 = new Date("2026-02-01T00:00:00.000Z");
const feb5 = new Date("2026-02-05T00:00:00.000Z");
const feb10 = new Date("2026-02-10T00:00:00.000Z");
const feb15 = new Date("2026-02-15T00:00:00.000Z");
const feb28 = new Date("2026-02-28T00:00:00.000Z");
const mar31 = new Date("2026-03-31T00:00:00.000Z");

function makeIdentity() {
	return {
		id: "parity-work-1",
		name: "Obra Paridade",
		code: "OBRA-PARITY",
		costCenter: { id: "cc-1", name: "CC 1" },
	};
}

function makeStage() {
	return {
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
	};
}

function makeItem(
	id: string,
	index: string,
	totalCost: number,
	quantity: number,
) {
	return {
		id,
		parentId: "stage-1",
		index,
		type: "ITEM",
		description: `Item ${index}`,
		unit: "m3",
		quantity,
		unitCost: totalCost / quantity,
		totalCost,
		totalBudget: totalCost,
		plannedStart: null,
		plannedEnd: null,
		actualStart: null,
		actualEnd: null,
		completionPercentage: 0,
		providedStatus: "Ativo",
		computedStatus: "IN_PROGRESS",
		sortOrder: 2,
	};
}

function makeParityWork() {
	return {
		id: "parity-work-1",
		ownerId: "owner-1",
		code: "OBRA-PARITY",
		name: "Obra Paridade",
		clientName: "Cliente Paridade",
		plannedStart: jan1,
		plannedEnd: mar31,
		baseDate: feb15,
		activeImportId: "import-1",
		createdAt: jan1,
		imports: [{ createdAt: new Date("2026-01-02T00:00:00.000Z") }],
		items: [
			makeStage(),
			makeItem("item-1", "1.1", 1000, 10),
			makeItem("item-2", "1.2", 2000, 10),
		],
		baselineSchedules: [
			{
				id: "baseline-1",
				budgetItemId: "item-1",
				index: "1.1",
				plannedStart: jan1,
				plannedEnd: feb28,
				plannedWeight: null,
			},
			{
				id: "baseline-2",
				budgetItemId: "item-2",
				index: "1.2",
				plannedStart: jan1,
				plannedEnd: mar31,
				plannedWeight: null,
			},
		],
		scheduleRevisions: [],
		measurements: [],
		actualCosts: [],
	};
}

function makeActualCosts() {
	return [
		{
			id: "cost-1",
			budgetItemId: "item-1",
			budgetIndex: "1.1",
			costDate: feb1,
			amount: 400,
			costType: "CURRENT",
			category: "MATERIAL",
			appropriationStatus: "APPROPRIATED",
		},
		{
			id: "cost-2",
			budgetItemId: null,
			budgetIndex: null,
			costDate: feb5,
			amount: 100,
			costType: "FUTURE",
			category: "RESERVA",
			appropriationStatus: "UNAPPROPRIATED",
		},
	];
}

function makeManualMeasurement() {
	return {
		id: "wm-1",
		date: feb10,
		items: [
			{
				budgetItemId: "item-1",
				measuredValue: 200,
				accumulatedValue: 600,
				accumulatedPercentage: 0.9,
			},
		],
	};
}

async function runParityProjections() {
	const { getWorkManagementDashboard, getWorkMetricsSnapshot, getWorkReport } =
		await import(
			"../../../../src/modules/construction-planning/management.repository"
		);
	const { ConstructionBIService } = await import(
		"../../../../src/modules/construction-planning/bi/bi-service"
	);

	const service = new ConstructionBIService({
		getWorkWithItems,
		getWorkMeasurementsForBI,
	} as never);

	const [dashboard, snapshot, report, overview] = await Promise.all([
		getWorkManagementDashboard("owner-1", "parity-work-1"),
		getWorkMetricsSnapshot("owner-1", "parity-work-1"),
		getWorkReport("owner-1", "parity-work-1"),
		service.getWorkBI("owner-1", "parity-work-1"),
	]);

	return { dashboard, snapshot, report, overview };
}

describe("cross-route parity of the canonical metrics snapshot", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		workFindFirst.mockResolvedValue(null);
		budgetItemFindMany.mockResolvedValue([]);
		workMeasurementFindMany.mockResolvedValue([]);
		baselineFindMany.mockResolvedValue([]);
		actualCostFindMany.mockResolvedValue([]);
		getWorkWithItems.mockResolvedValue(null);
		getWorkMeasurementsForBI.mockResolvedValue([]);
	});

	it("keeps budgeted, spent, balance and execution identical across dashboard, overview and report", async () => {
		workFindFirst.mockResolvedValue(makeIdentity());
		getWorkWithItems.mockResolvedValue({
			...makeParityWork(),
			measurements: [
				{
					id: "m-item-1",
					budgetItemId: "item-1",
					index: "1.1",
					measurementDate: feb10,
					measuredPercentageAccumulated: 0.5,
					measuredQuantityAccumulated: null,
				},
				{
					id: "m-item-2",
					budgetItemId: "item-2",
					index: "1.2",
					measurementDate: feb10,
					measuredPercentageAccumulated: 0.25,
					measuredQuantityAccumulated: null,
				},
			],
			actualCosts: makeActualCosts(),
		});

		const { dashboard, snapshot, report, overview } =
			await runParityProjections();

		expect(dashboard).not.toBeNull();
		expect(snapshot).not.toBeNull();
		expect(report).not.toBeNull();
		if (!dashboard || !snapshot || !report) return;

		expect(dashboard.budgeted).toBe(3000);
		expect(dashboard.spent).toBe(400);
		expect(dashboard.balance).toBe(2600);
		expect(dashboard.executionPercentage).toBe(13.33);

		expect(report.budget.total).toBe(dashboard.budgeted);
		expect(report.costs.total).toBe(dashboard.spent);
		expect(report.costs.balance).toBe(dashboard.balance);
		expect(report.measurements.total).toBe(overview.summary.earnedValue);
		expect(report.measurements.total).toBe(overview.summary.executedValue);
		expect(report.measurements.percentage).toBe(
			overview.summary.measuredPercentage,
		);

		expect(overview.summary.activeBudget).toBe(dashboard.budgeted);
		expect(overview.summary.actualCost).toBe(dashboard.spent);
		expect(overview.summary.currentBudgetBalance).toBe(dashboard.balance);
		expect(overview.indicators.earnedValue.value).toBe(
			overview.summary.earnedValue,
		);

		expect(snapshot.metrics.activeBudget).toBe(overview.summary.activeBudget);
		expect(snapshot.metrics.earnedValue).toBe(overview.summary.earnedValue);
		expect(snapshot.metrics.actualCost).toBe(overview.summary.actualCost);
		expect(snapshot.metrics.currentBudgetBalance).toBe(
			overview.summary.currentBudgetBalance,
		);
		expect(snapshot.metrics.measuredPercentage).toBe(
			overview.summary.measuredPercentage,
		);

		expect(overview.summary.measuredPercentage).toBeCloseTo(1000 / 3000, 8);
		expect(dashboard.executionPercentage).toBe(
			roundCurrency((report.costs.total / report.budget.total) * 100),
		);
	});

	it("reflects budget edits in getWorkBI", async () => {
		workFindFirst.mockResolvedValue(makeIdentity());
		const work = {
			...makeParityWork(),
			items: [
				makeStage(),
				makeItem("item-1", "1.1", 1000, 10),
				makeItem("item-2", "1.2", 2000, 10),
			],
		};
		getWorkWithItems.mockResolvedValue(work);

		const { ConstructionBIService } = await import(
			"../../../../src/modules/construction-planning/bi/bi-service"
		);
		const service = new ConstructionBIService({
			getWorkWithItems,
			getWorkMeasurementsForBI,
		} as never);

		const before = await service.getWorkBI("owner-1", "parity-work-1");
		expect(before.summary.activeBudget).toBe(3000);
		expect(before.sourceMode).toBe("LIVE");

		getWorkWithItems.mockResolvedValue({
			...work,
			items: [
				makeStage(),
				makeItem("item-1", "1.1", 1500, 10),
				makeItem("item-2", "1.2", 2000, 10),
			],
		});

		const after = await service.getWorkBI("owner-1", "parity-work-1");
		expect(after.summary.activeBudget).toBe(3500);
	});

	it("feeds the same monetary measurement value into overview EV and report measurements.total", async () => {
		workFindFirst.mockResolvedValue(makeIdentity());
		getWorkWithItems.mockResolvedValue({
			...makeParityWork(),
			measurements: [
				{
					id: "m-item-2",
					budgetItemId: "item-2",
					index: "1.2",
					measurementDate: feb10,
					measuredValueAccumulated: 500,
					measuredPercentageAccumulated: 0.4,
					measuredQuantityAccumulated: 8,
				},
			],
			actualCosts: makeActualCosts(),
		});
		getWorkMeasurementsForBI.mockResolvedValue([makeManualMeasurement()]);

		const { dashboard, snapshot, report, overview } =
			await runParityProjections();

		expect(dashboard).not.toBeNull();
		expect(snapshot).not.toBeNull();
		expect(report).not.toBeNull();
		if (!dashboard || !snapshot || !report) return;

		const item1 = snapshot.metrics.items.find((item) => item.id === "item-1");
		const item2 = snapshot.metrics.items.find((item) => item.id === "item-2");

		expect(item1?.earnedValue).toBe(600);
		expect(item2?.earnedValue).toBe(500);

		expect(report.measurements.total).toBe(1100);
		expect(report.measurements.count).toBe(1);
		expect(overview.summary.earnedValue).toBe(1100);
		expect(overview.indicators.earnedValue.value).toBe(1100);
		expect(snapshot.metrics.earnedValue).toBe(1100);

		expect(report.measurements.total).toBe(overview.summary.earnedValue);
		expect(report.measurements.total).toBe(snapshot.metrics.earnedValue);
		expect(overview.summary.measuredPercentage).toBe(
			report.measurements.percentage,
		);
		expect(overview.summary.measuredPercentage).toBeCloseTo(1100 / 3000, 8);
	});

	it("documents the permitted time-series divergence of the physical-financial schedule with repeated measurements", async () => {
		workFindFirst.mockResolvedValue(makeIdentity());
		budgetItemFindMany.mockResolvedValue([
			{
				id: "stage-1",
				index: "1",
				description: "Fundacao",
				type: "STAGE",
				totalCost: 0,
			},
			{
				id: "item-1",
				index: "1.1",
				description: "Escavacao",
				type: "ITEM",
				totalCost: 1000,
			},
		]);
		workMeasurementFindMany.mockResolvedValue([
			{
				id: "wm-1",
				date: jan15,
				items: [
					{
						budgetItemId: "item-1",
						accumulatedValue: 300,
						measuredValue: 100,
					},
				],
			},
			{
				id: "wm-2",
				date: feb15,
				items: [
					{
						budgetItemId: "item-1",
						accumulatedValue: 600,
						measuredValue: 300,
					},
				],
			},
		]);
		baselineFindMany.mockResolvedValue([
			{
				budgetItemId: "item-1",
				plannedStart: jan1,
				plannedEnd: feb28,
				plannedWeight: null,
			},
		]);
		actualCostFindMany.mockResolvedValue([]);

		getWorkWithItems.mockResolvedValue({
			...makeParityWork(),
			measurements: [
				{
					id: "m1",
					budgetItemId: "item-1",
					index: "1.1",
					measurementDate: jan15,
					measuredValueAccumulated: 300,
					measuredPercentageAccumulated: null,
					measuredQuantityAccumulated: null,
				},
				{
					id: "m2",
					budgetItemId: "item-1",
					index: "1.1",
					measurementDate: feb15,
					measuredValueAccumulated: 600,
					measuredPercentageAccumulated: null,
					measuredQuantityAccumulated: null,
				},
			],
		});

		const { getPhysicalFinancialSchedule, getWorkMetricsSnapshot } =
			await import(
				"../../../../src/modules/construction-planning/management.repository"
			);

		const [schedule, snapshot] = await Promise.all([
			getPhysicalFinancialSchedule("owner-1", "parity-work-1"),
			getWorkMetricsSnapshot("owner-1", "parity-work-1"),
		]);

		expect(schedule).not.toBeNull();
		expect(snapshot).not.toBeNull();
		if (!schedule || !snapshot) return;

		expect(schedule.totals.measuredByMonth).toEqual([300, 600, 0]);
		expect(schedule.totals.measuredAccumulated).toEqual([300, 900, 900]);
		expect(snapshot.metrics.earnedValue).toBe(600);

		// Divergencia CONHECIDA e permitida (serie temporal): a curva fisico-financeira
		// soma o valor acumulado de CADA medicao por mes, enquanto o EV canonico usa
		// apenas a medicao mais recente ate a data-base. Com duas medicoes no item-1,
		// o acumulado da curva (900) diverge do EV canonico (600). Nao corrigir aqui:
		// mudaria o contrato HTTP da curva sem spec. (brief Task 4)
		expect(
			schedule.totals.measuredAccumulated[
				schedule.totals.measuredAccumulated.length - 1
			],
		).not.toBe(snapshot.metrics.earnedValue);
	});

	it("documents that the curve aggregates the canonical merged measurements while EV keeps only the latest per item", async () => {
		workFindFirst.mockResolvedValue(makeIdentity());
		getWorkWithItems.mockResolvedValue({
			...makeParityWork(),
			measurements: [
				{
					id: "m-imported",
					budgetItemId: "item-1",
					index: "1.1",
					measurementDate: feb5,
					measuredValueAccumulated: 400,
					measuredPercentageAccumulated: null,
					measuredQuantityAccumulated: null,
				},
			],
		});
		getWorkMeasurementsForBI.mockResolvedValue([
			{
				id: "wm-1",
				date: feb10,
				items: [
					{
						budgetItemId: "item-1",
						measuredValue: 200,
						accumulatedValue: 700,
						accumulatedPercentage: 0.9,
					},
				],
			},
		]);

		const { getPhysicalFinancialSchedule, getWorkMetricsSnapshot } =
			await import(
				"../../../../src/modules/construction-planning/management.repository"
			);

		const [schedule, snapshot] = await Promise.all([
			getPhysicalFinancialSchedule("owner-1", "parity-work-1"),
			getWorkMetricsSnapshot("owner-1", "parity-work-1"),
		]);

		expect(schedule).not.toBeNull();
		expect(snapshot).not.toBeNull();
		if (!schedule || !snapshot) return;

		expect(schedule.totals.measuredByMonth).toEqual([0, 1100, 0]);
		expect(schedule.totals.measuredAccumulated).toEqual([0, 1100, 1100]);
		expect(snapshot.metrics.earnedValue).toBe(700);

		// Divergencia CONHECIDA e permitida (fonte das medicoes): a curva
		// fisico-financeira agrega o conjunto CANONICO MESCLADO de medicoes
		// (manual + importada) somando o valor acumulado de CADA medicao por mes,
		// enquanto o EV canonico usa apenas a medicao mais recente por item ate a
		// data-base. Com a importada (400 em feb5) e a manual (700 em feb10) no
		// mesmo item-1, o acumulado final da curva (1100) diverge do EV canonico
		// (700). Nao corrigir aqui: mudaria o contrato HTTP da curva sem spec.
		expect(
			schedule.totals.measuredAccumulated[
				schedule.totals.measuredAccumulated.length - 1
			],
		).toBe(1100);
		expect(
			schedule.totals.measuredAccumulated[
				schedule.totals.measuredAccumulated.length - 1
			],
		).not.toBe(snapshot.metrics.earnedValue);
	});

	it("MET-MVP-001: projecoes puras reproduzem progresso fisico e EV; ausencia nao vira zero", async () => {
		workFindFirst.mockResolvedValue(makeIdentity());
		getWorkWithItems.mockResolvedValue({
			...makeParityWork(),
			items: [makeStage(), makeItem("item-1", "1.1", 1000, 100)],
			baselineSchedules: [],
			measurements: [
				{
					id: "m-met-1",
					budgetItemId: "item-1",
					index: "1.1",
					measurementDate: feb15,
					measuredPercentageAccumulated: 0.5,
					measuredQuantityAccumulated: null,
				},
			],
			actualCosts: [
				{
					id: "cost-met-1",
					budgetItemId: "item-1",
					budgetIndex: "1.1",
					costDate: feb15,
					amount: 50,
					costType: "CURRENT",
					category: "SERVICOS",
					appropriationStatus: "APPROPRIATED",
				},
			],
		});

		const { overview } = await runParityProjections();

		// Fixture MET-MVP-001 (sem ledger): progresso fisico 0,5 e EV 500.
		expect(overview.summary.measuredPercentage).toBeCloseTo(0.5, 6);
		expect(overview.summary.executedValue).toBeCloseTo(500, 2);
		expect(overview.summary.earnedValue).toBeCloseTo(500, 2);
		// AC do fluxo legado (custos reais) = 50; o AC canonico do ledger
		// (incurred 400) e coberto no e2e-db e fica para a Task 3 do Plano 6.
		expect(overview.summary.actualCost).toBeCloseTo(50, 2);
		// Sem baseline de cronograma: PV ausente -> SPI indisponivel (null),
		// nunca indice zero silencioso (ACE-019).
		expect(overview.summary.schedulePerformanceIndex).toBeNull();
		// Ledger sem eventos nesta obra pura: zero conhecido (ACE-019), nao null.
		expect(overview.ledgerSummary?.committed ?? null).toBe(0);
	});
});
