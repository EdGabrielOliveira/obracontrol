import { describe, expect, mock, test } from "bun:test";
import type {
	ExecutionViewRepository,
	ScheduleVersionIdentity,
} from "../../../../../src/modules/construction-planning/bi/execution-view.repository";
import { ExecutionViewService } from "../../../../../src/modules/construction-planning/bi/execution-view.service";
import type { ResolvedMetricSource } from "../../../../../src/modules/construction-planning/bi/metric-source";

function makeResolvedSource(overrides: Partial<ResolvedMetricSource> = {}) {
	return {
		mode: "LIVE" as const,
		ownerId: "owner-1",
		workId: "work-1",
		snapshotId: null,
		version: null,
		fingerprint: "fp-1",
		asOfDate: "2026-08-05T00:00:00.000Z",
		input: {} as ResolvedMetricSource["input"],
		metrics: {
			activeBudget: 100_000,
			actualCost: 40_000,
			currentBudgetBalance: 60_000,
			plannedValue: 50_000,
			earnedValue: 45_000,
			indicators: {} as ResolvedMetricSource["metrics"]["indicators"],
			dataCompleteness: {
				hasBaselineSchedule: true,
				hasMeasurements: true,
				hasActualCosts: true,
				hasFutureCosts: false,
				hasUnappropriatedActualCosts: false,
				hasUnappropriatedFutureCosts: false,
			},
		} as ResolvedMetricSource["metrics"],
		manualMeasurements: [],
		series: { points: [] },
		contracts: [],
		quality: { missing: 0, invalid: 0, unlinked: 0, duplicated: 0, stale: 0 },
		snapshot: null,
		ledger: null,
		budgetBalance: null,
		...overrides,
	} as ResolvedMetricSource;
}

function makeSchedule() {
	return {
		work: {
			id: "work-1",
			code: "O-01",
			name: "Obra 1",
			clientName: null,
			plannedStart: null,
			plannedEnd: null,
			baseDate: null,
			createdAt: new Date(),
			lastImportAt: null,
		},
		items: [
			{
				id: "sched-1",
				parentId: null,
				index: "1.1",
				type: "ITEM",
				description: "Fundacao",
				unit: "m3",
				quantity: 100,
				unitCost: 10,
				totalCost: 1000,
				plannedStart: "2026-01-01T00:00:00.000Z",
				plannedEnd: "2026-02-01T00:00:00.000Z",
				actualStart: "2026-01-10T00:00:00.000Z",
				actualEnd: "2026-03-01T00:00:00.000Z",
				durationDays: 32,
				baselineEnd: "2026-02-01T00:00:00.000Z",
				revisedEnd: "2026-03-01T00:00:00.000Z",
				deltaDays: 28,
				deltaPercent: 0.9,
				completionPercentage: 100,
				executedValue: 1000,
				activeBudget: 1000,
				ignoredBudget: 0,
				suspendedBudget: 0,
				plannedValue: 1000,
				earnedValue: 1000,
				plannedPercentage: 1,
				scheduleVariance: 0,
				schedulePerformanceIndex: 1,
				balance: 0,
				providedStatus: null,
				computedStatus: "CONCLUIDO",
			},
			{
				id: "sched-2",
				parentId: null,
				index: "1.2",
				type: "ITEM",
				description: "Estrutura",
				unit: null,
				quantity: null,
				unitCost: null,
				totalCost: 2000,
				plannedStart: "2026-02-01T00:00:00.000Z",
				plannedEnd: "2026-04-01T00:00:00.000Z",
				actualStart: null,
				actualEnd: null,
				durationDays: 60,
				baselineEnd: "2026-04-01T00:00:00.000Z",
				revisedEnd: "2026-04-01T00:00:00.000Z",
				deltaDays: 0,
				deltaPercent: 0,
				completionPercentage: 0,
				executedValue: 0,
				activeBudget: 2000,
				ignoredBudget: 0,
				suspendedBudget: 0,
				plannedValue: 2000,
				earnedValue: 0,
				plannedPercentage: 0,
				scheduleVariance: 0,
				schedulePerformanceIndex: 1,
				balance: 2000,
				providedStatus: null,
				computedStatus: "EM_ANDAMENTO",
			},
			{
				id: "sched-3",
				parentId: null,
				index: "1.3",
				type: "ITEM",
				description: "Sem cronograma",
				unit: null,
				quantity: null,
				unitCost: null,
				totalCost: 0,
				plannedStart: null,
				plannedEnd: null,
				actualStart: null,
				actualEnd: null,
				durationDays: null,
				baselineEnd: null,
				revisedEnd: null,
				deltaDays: null,
				deltaPercent: null,
				completionPercentage: 0,
				executedValue: 0,
				activeBudget: 0,
				ignoredBudget: 0,
				suspendedBudget: 0,
				plannedValue: 0,
				earnedValue: 0,
				plannedPercentage: null,
				scheduleVariance: null,
				schedulePerformanceIndex: null,
				balance: 0,
				providedStatus: null,
				computedStatus: "NAO_INICIADO",
			},
		],
		gantt: [],
		replanning: {
			totalRevisedItems: 1,
			latestRevisionDate: "2026-03-01T00:00:00.000Z",
			totalRevisions: 1,
			itemsShifted: 1,
			maxDeltaDays: 28,
			revisedEndAt: "2026-03-01T00:00:00.000Z",
		},
	};
}

function makeRepository() {
	return {
		getWorkIdentity: mock(async () => ({
			id: "work-1",
			code: "O-01",
			name: "Obra 1",
		})),
		listContractExecutionNodes: mock(async () => [
			{
				id: "contract-1",
				code: "C-01",
				supplierName: "Fornecedor A",
				contractValue: 55_000,
				amendmentNet: 5_000,
				status: "EM_ANDAMENTO",
				linkedBudgetItems: [
					{ id: "budget-1", index: "1.1", description: "Fundacao" },
				],
			},
		]),
		getScheduleVersionIdentity: mock(
			async (): Promise<ScheduleVersionIdentity | null> => ({
				id: "schedule-version-1",
				label: "Baseline",
				versionNumber: 1,
			}),
		),
	} satisfies ExecutionViewRepository;
}

function makeVersionResolver() {
	return mock(async () => ({
		budgetVersionId: "budget-version-1",
		scheduleVersionId: null,
		mode: "EFFECTIVE" as const,
	}));
}

function makeService(
	resolved: ResolvedMetricSource = makeResolvedSource(),
	schedule: ReturnType<typeof makeSchedule> = makeSchedule(),
) {
	return new ExecutionViewService(
		makeRepository() as unknown as ExecutionViewRepository,
		{ resolve: mock(async () => resolved) } as unknown as never,
		{ getWorkSchedule: mock(async () => schedule) } as unknown as never,
		makeVersionResolver() as unknown as never,
	);
}

describe("execution view service", () => {
	test("monta a resposta raiz com identidade, origem, versao e data de corte", async () => {
		const service = makeService();

		const result = await service.getExecutionView("owner-1", "work-1");

		expect(result.work).toEqual({ id: "work-1", code: "O-01", name: "Obra 1" });
		expect(result.sourceMode).toBe("LIVE");
		expect(result.budgetVersionId).toBe("budget-version-1");
		expect(result.snapshotVersion).toBeNull();
		expect(result.asOfDate).toBe("2026-08-05T00:00:00.000Z");
		expect(result.generatedAt).toBeDefined();
		expect(Array.isArray(result.qualityIssues)).toBe(true);
	});

	test("metricas bloqueadas retornam null, UNAVAILABLE e issue PENDING_DEFINITION", async () => {
		const _repository = makeRepository();
		const service = makeService();

		const result = await service.getExecutionView("owner-1", "work-1");

		for (const key of ["grossMargin", "grossProfit", "billing"] as const) {
			expect(result.financial[key]).toEqual({
				budgeted: null,
				realized: null,
				variance: null,
				completeness: "UNAVAILABLE",
			});
		}
		const issueCodes = result.financial.issues.map((i) => i.code);
		expect(issueCodes).toContain("PENDING_DEFINITION");
		expect(issueCodes.length).toBeGreaterThanOrEqual(3);
	});

	test("custo orcado x realizado fica COMPLETE quando ha custos", async () => {
		const _repository = makeRepository();
		const service = makeService();

		const result = await service.getExecutionView("owner-1", "work-1");

		expect(result.financial.costs).toEqual({
			budgeted: 100_000,
			realized: 40_000,
			variance: 60_000,
			completeness: "COMPLETE",
		});
	});

	test("custo realizado vira null e PARTIAL quando nao ha custos", async () => {
		const resolved = makeResolvedSource({
			metrics: {
				...makeResolvedSource().metrics,
				actualCost: 0,
				currentBudgetBalance: 100_000,
				dataCompleteness: {
					...makeResolvedSource().metrics.dataCompleteness,
					hasActualCosts: false,
				},
			},
		});
		const service = makeService(resolved);

		const result = await service.getExecutionView("owner-1", "work-1");

		expect(result.financial.costs).toEqual({
			budgeted: 100_000,
			realized: null,
			variance: null,
			completeness: "PARTIAL",
		});
	});

	test("nos de contrato trazem identidade, valor com aditivos, itens vinculados e financeiro PARTIAL", async () => {
		const _repository = makeRepository();
		const service = makeService();

		const result = await service.getExecutionView("owner-1", "work-1");

		expect(result.contracts).toHaveLength(1);
		const contract = result.contracts[0];
		expect(contract.contractId).toBe("contract-1");
		expect(contract.code).toBe("C-01");
		expect(contract.supplierName).toBe("Fornecedor A");
		expect(contract.contractValue).toBe(55_000);
		expect(contract.linkedBudgetItems).toEqual([
			{ id: "budget-1", index: "1.1", description: "Fundacao" },
		]);
		expect(contract.financial.costs).toEqual({
			budgeted: 55_000,
			realized: null,
			variance: null,
			completeness: "PARTIAL",
		});
	});

	test("desvios operacionais derivam status estavel dos itens do cronograma", async () => {
		const _repository = makeRepository();
		const service = makeService();

		const result = await service.getExecutionView("owner-1", "work-1");

		expect(result.schedule.deviations).toHaveLength(3);
		const [delayed, onTrack, noData] = result.schedule.deviations;

		expect(delayed.status).toBe("DELAYED");
		expect(delayed.varianceDays).toBe(28);
		expect(delayed.plannedEnd).toBe("2026-02-01T00:00:00.000Z");
		expect(delayed.realizedEnd).toBe("2026-03-01T00:00:00.000Z");
		expect(delayed.cause).toBeNull();
		expect(delayed.action).toBeNull();
		expect(delayed.responsibleId).toBeNull();
		expect(delayed.dueDate).toBeNull();

		expect(onTrack.status).toBe("ON_TRACK");
		expect(noData.status).toBe("NO_DATA");
	});

	test("no de cronograma expoe identidade de baseline e revisao", async () => {
		const _repository = makeRepository();
		const service = makeService();

		const result = await service.getExecutionView("owner-1", "work-1");

		expect(result.schedule.baselineVersionId).toBe("schedule-version-1");
		expect(result.schedule.baselineLabel).toBe("Baseline");
		expect(result.schedule.revisionCount).toBe(1);
		expect(result.schedule.latestRevisionDate).toBe("2026-03-01T00:00:00.000Z");
		expect(result.schedule.maxDeltaDays).toBe(28);
		expect(result.schedule.items).toBe(3);
	});
});
