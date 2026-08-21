import { describe, expect, it, mock } from "bun:test";
import { ConstructionBIService } from "../../../../../src/modules/construction-planning/bi/bi-service";
import type { WorkForBIInput } from "../../../../../src/modules/construction-planning/bi/calculations";
import type { ResolvedMetricSource } from "../../../../../src/modules/construction-planning/bi/metric-source";
import {
	MetricSourceResolver,
	type MetricSourceResolverDependencies,
} from "../../../../../src/modules/construction-planning/bi/metric-source-resolver";
import { buildWorkMetricsSnapshot } from "../../../../../src/modules/construction-planning/bi/work-metrics-snapshot";

function workFixture(overrides: Partial<WorkForBIInput> = {}): WorkForBIInput {
	return {
		id: "work-1",
		code: "OBRA-001",
		name: "Obra",
		clientName: null,
		plannedStart: new Date("2026-01-01T00:00:00.000Z"),
		plannedEnd: new Date("2026-12-31T00:00:00.000Z"),
		baseDate: new Date("2026-01-01T00:00:00.000Z"),
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		imports: [{ createdAt: new Date("2026-01-01T00:00:00.000Z") }],
		items: [
			{
				id: "stage-1",
				parentId: null,
				index: "1",
				type: "STAGE",
				description: "Etapa 1",
				quantity: null,
				unitCost: null,
				totalCost: 100000,
				plannedStart: null,
				plannedEnd: null,
				actualStart: null,
				actualEnd: null,
				completionPercentage: 0,
				providedStatus: null,
				sortOrder: 1,
				computedStatus: "NOT_STARTED",
			},
			{
				id: "item-1",
				parentId: "stage-1",
				index: "1.1",
				type: "ITEM",
				description: "Servico 1",
				unit: "m2",
				quantity: 100,
				unitCost: 1000,
				totalCost: 100000,
				plannedStart: null,
				plannedEnd: null,
				actualStart: null,
				actualEnd: null,
				completionPercentage: 0,
				providedStatus: null,
				sortOrder: 1,
				computedStatus: "NOT_STARTED",
			},
		],
		baselineSchedules: [],
		scheduleRevisions: [],
		measurements: [],
		actualCosts: [],
		...overrides,
	};
}

function makeResolvedSource(
	overrides: Partial<ResolvedMetricSource> = {},
): ResolvedMetricSource {
	const snapshot = buildWorkMetricsSnapshot({ work: workFixture() });
	return {
		mode: "LIVE",
		workId: "work-1",
		snapshotId: null,
		version: null,
		fingerprint: "f".repeat(64),
		asOfDate: snapshot.metrics.dataDate,
		input: snapshot.input,
		metrics: snapshot.metrics,
		manualMeasurements: snapshot.manualMeasurements,
		series: { points: [] },
		contracts: [],
		quality: { missing: 0, invalid: 0, unlinked: 0, duplicated: 0, stale: 0 },
		snapshot: null,
		ledger: null,
		budgetBalance: null,
		...overrides,
	} as ResolvedMetricSource;
}

function makeService() {
	const repository = {
		getWorkWithItems: mock(async (): Promise<unknown | null> => null),
		getAllWorksWithItems: mock(async (): Promise<unknown[]> => []),
		getWorksByIdsWithItems: mock(async (): Promise<unknown[]> => []),
		getWorkMeasurementsForBI: mock(async (): Promise<unknown[]> => []),
		getWorkMeasurementsForManyWorks: mock(
			async (): Promise<Map<string, unknown[]>> => new Map(),
		),
	};
	const resolver = {
		resolve: mock(
			async (_request: { workId: string }): Promise<ResolvedMetricSource> =>
				makeResolvedSource(),
		),
	};
	const service = new ConstructionBIService(
		repository as never,
		{} as never,
		resolver as never,
	);
	return { service, repository, resolver };
}

describe("ConstructionBIService.getWorkBI via canonical source resolver", () => {
	it("resolves LIVE overview through the resolver passing asOfDate through", async () => {
		const { service, resolver } = makeService();
		const asOf = new Date("2026-01-10T00:00:00.000Z");
		resolver.resolve.mockResolvedValue(
			makeResolvedSource({ asOfDate: "2026-01-10T00:00:00.000Z" }),
		);

		const overview = await service.getWorkBI("owner-1", "work-1", asOf);

		expect(resolver.resolve).toHaveBeenCalledWith({
			ownerId: "owner-1",
			workId: "work-1",
			asOfDate: asOf,
		});
		expect(overview.sourceMode).toBe("LIVE");
		expect(overview.snapshot).toBeNull();
		expect(overview.summary.activeBudget).toBe(100000);
	});
});

describe("ConstructionBIService.getMultiworksBI via canonical source resolver", () => {
	it("aggregates LIVE rows and reports LIVE source mode with null snapshot version", async () => {
		const { service, repository } = makeService();
		repository.getAllWorksWithItems.mockResolvedValue([
			{ ...workFixture({ id: "work-l", code: "OBRA-L" }), ownerId: "owner-1" },
		] as never[]);
		repository.getWorkMeasurementsForManyWorks.mockResolvedValue(new Map());

		const result = await service.getMultiworksBI("owner-1");

		expect(result.sourceMode).toBe("LIVE");
		expect(result.cards.totalWorks).toBe(1);
		expect(result.works[0]).toMatchObject({
			workId: "work-l",
			sourceMode: "LIVE",
			snapshotVersion: null,
		});
	});

	it("LIVE aggregate row equals the LIVE overview resolved values for the same work", async () => {
		const work = workFixture({ id: "work-live", code: "OBRA-LIVE" });
		const manualMeasurements = [
			{
				date: new Date("2026-01-01T00:00:00.000Z"),
				items: [{ budgetItemId: "item-1", accumulatedPercentage: 50 }],
			},
		];
		const repository = {
			getWorkWithItems: mock(async (): Promise<unknown | null> => work),
			getAllWorksWithItems: mock(
				async (): Promise<unknown[]> => [{ ...work, ownerId: "owner-1" }],
			),
			getWorksByIdsWithItems: mock(async (): Promise<unknown[]> => []),
			getWorkMeasurementsForBI: mock(
				async (): Promise<unknown[]> => manualMeasurements,
			),
			getWorkMeasurementsForManyWorks: mock(
				async (): Promise<Map<string, unknown[]>> =>
					new Map([["work-live", manualMeasurements]]),
			),
		};
		const deps: MetricSourceResolverDependencies = {
			getWork: mock(async () => work),
			getManualMeasurements: mock(async () => manualMeasurements),
			listContracts: mock(async () => []),
			getLedgerSummary: mock(async () => null),
			getBudgetBalance: mock(async () => null),
		};
		const resolver = new MetricSourceResolver(deps);
		const service = new ConstructionBIService(
			repository as never,
			{} as never,
			resolver,
		);

		const [result, overview] = await Promise.all([
			service.getMultiworksBI("owner-1"),
			service.getWorkBI("owner-1", "work-live"),
		]);

		expect(result.works[0]).toMatchObject({
			activeBudget: overview.summary.activeBudget,
			plannedValue: overview.summary.plannedValue,
			earnedValue: overview.summary.earnedValue,
			actualCost: overview.summary.actualCost,
			measuredPercentage: overview.summary.measuredPercentage,
			plannedPercentage: overview.summary.plannedPercentage,
			schedulePerformanceIndex: overview.summary.schedulePerformanceIndex,
			costPerformanceIndex: overview.summary.costPerformanceIndex,
			currentBudgetBalance: overview.summary.currentBudgetBalance,
			projectedBudgetBalance: overview.summary.projectedBudgetBalance,
		});
		expect(result.costsByWork[0]).toMatchObject({
			workId: "work-live",
			activeBudget: overview.summary.activeBudget,
			earnedValue: overview.summary.earnedValue,
			actualCost: overview.summary.actualCost,
			measuredPercentage: overview.summary.measuredPercentage,
		});
	});

	it("filters multiworks status from resolved metrics including manual measurements", async () => {
		const { service, repository } = makeService();
		repository.getAllWorksWithItems.mockResolvedValue([
			{
				...workFixture({ id: "work-mm", code: "OBRA-MM", measurements: [] }),
				ownerId: "owner-1",
			},
		] as never[]);
		repository.getWorkMeasurementsForManyWorks.mockResolvedValue(
			new Map([
				[
					"work-mm",
					[
						{
							date: new Date("2026-01-01T00:00:00.000Z"),
							items: [{ budgetItemId: "item-1", accumulatedPercentage: 50 }],
						},
					],
				],
			]),
		);

		const inProgress = await service.getMultiworksBI("owner-1", {
			status: "IN_PROGRESS",
		});
		expect(inProgress.cards.totalWorks).toBe(1);
		expect(inProgress.works[0]).toMatchObject({
			workId: "work-mm",
			measuredPercentage: 0.5,
		});

		const notStarted = await service.getMultiworksBI("owner-1", {
			status: "NOT_STARTED",
		});
		expect(notStarted.cards.totalWorks).toBe(0);

		repository.getWorkMeasurementsForManyWorks.mockResolvedValue(new Map());
		const withoutManual = await service.getMultiworksBI("owner-1", {
			status: "IN_PROGRESS",
		});
		expect(withoutManual.cards.totalWorks).toBe(0);
	});

	it("BI-004: N obras LIVE consomem 1 query em lote para medicoes, nao N+1", async () => {
		const { service, repository } = makeService();
		repository.getAllWorksWithItems.mockResolvedValue([
			{ ...workFixture({ id: "work-1", code: "OBRA-1" }), ownerId: "owner-1" },
			{ ...workFixture({ id: "work-2", code: "OBRA-2" }), ownerId: "owner-1" },
			{ ...workFixture({ id: "work-3", code: "OBRA-3" }), ownerId: "owner-1" },
		] as never[]);
		repository.getWorkMeasurementsForManyWorks.mockResolvedValue(new Map());

		const result = await service.getMultiworksBI("owner-1");

		expect(result.cards.totalWorks).toBe(3);
		expect(repository.getWorkMeasurementsForManyWorks).toHaveBeenCalledTimes(1);
		expect(repository.getWorkMeasurementsForManyWorks).toHaveBeenCalledWith(
			"owner-1",
			["work-1", "work-2", "work-3"],
		);
		expect(repository.getWorkMeasurementsForBI).not.toHaveBeenCalled();
	});

	it("BI-004: getCompareBI filtra obras nao acessiveis ao actor", async () => {
		const { service, repository } = makeService();
		// O repository resolve obras acessiveis (owner direto + grant/membership);
		// aqui retorna apenas a obra acessivel do owner-1.
		repository.getWorksByIdsWithItems.mockResolvedValue([
			workFixture({ id: "work-1", code: "OBRA-1" }),
		] as never[]);

		const result = await service.getCompareBI("grantee-1", [
			"work-1",
			"work-outro-dono",
		]);

		expect(repository.getWorksByIdsWithItems).toHaveBeenCalledWith(
			"grantee-1",
			["work-1", "work-outro-dono"],
		);
		// A obra nao acessivel nao entra no resultado (o repository filtra).
		const works = (result as { works: Array<{ workId: string }> }).works;
		expect(works.map((w) => w.workId)).toEqual(["work-1"]);
	});
});
