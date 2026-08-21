import { describe, expect, it, mock } from "bun:test";
import type { WorkForBIInput } from "../../../../src/modules/construction-planning/bi/calculations";
import { projectPhysicalFinancialSchedule } from "../../../../src/modules/construction-planning/bi/management-projections";
import type { ResolvedMetricSource } from "../../../../src/modules/construction-planning/bi/metric-source";
import {
	buildQualitySummary,
	buildSeriesFromProjection,
} from "../../../../src/modules/construction-planning/bi/metric-source-resolver";
import { buildWorkMetricsSnapshot } from "../../../../src/modules/construction-planning/bi/work-metrics-snapshot";
import {
	OrgBIService,
	type OrgBIServiceDependencies,
} from "../../../../src/modules/organizations/bi";

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
				totalCost: 100000,
				totalBudget: 100000,
				plannedStart: null,
				plannedEnd: null,
				actualStart: null,
				actualEnd: null,
				completionPercentage: 0,
				computedStatus: "IN_PROGRESS",
				sortOrder: 0,
			},
			{
				id: "item-1",
				parentId: "stage-1",
				index: "1.1",
				type: "ITEM",
				description: "Servico",
				quantity: 100,
				totalCost: 100000,
				totalBudget: 100000,
				plannedStart: null,
				plannedEnd: null,
				actualStart: null,
				actualEnd: null,
				completionPercentage: 0,
				computedStatus: "IN_PROGRESS",
				sortOrder: 1,
			},
		],
		baselineSchedules: [
			{
				budgetItemId: "item-1",
				plannedStart: new Date("2026-01-01T00:00:00.000Z"),
				plannedEnd: new Date("2026-12-31T00:00:00.000Z"),
				plannedWeight: 1,
			},
		],
		scheduleRevisions: [],
		measurements: [
			{
				id: "m-1",
				budgetItemId: "item-1",
				measurementDate: new Date("2026-01-01T00:00:00.000Z"),
				measuredPercentageAccumulated: 30,
			},
		],
		actualCosts: [
			{
				id: "c-1",
				budgetItemId: "item-1",
				costDate: new Date("2026-01-01T00:00:00.000Z"),
				amount: 10000,
				costType: "CURRENT",
			},
		],
		...overrides,
	};
}

function makeResolvedSource(
	overrides: Partial<ResolvedMetricSource> = {},
): ResolvedMetricSource {
	const snapshot = buildWorkMetricsSnapshot({ work: workFixture() });
	return {
		mode: "LIVE",
		ownerId: "owner-1",
		workId: "work-1",
		snapshotId: null,
		version: null,
		fingerprint: "f".repeat(64),
		asOfDate: snapshot.metrics.dataDate,
		input: snapshot.input,
		metrics: snapshot.metrics,
		series: buildSeriesFromProjection(
			projectPhysicalFinancialSchedule(snapshot, "monthly"),
		),
		contracts: [],
		quality: buildQualitySummary(snapshot.metrics),
		manualMeasurements: snapshot.manualMeasurements,
		snapshot: null,
		ledger: null,
		budgetBalance: null,
		...overrides,
	};
}

function makeService() {
	const getCostCenterById = mock(async () => ({ id: "cc-1" }));
	const getOrganizationById = mock(async () => ({ id: "org-1" }));
	const getWorksByCostCenter = mock(async () => []);
	const getWorksByOrganization = mock(async () => []);
	const getWorkMeasurementsForBI = mock(async () => []);
	const getWorkMeasurementsForManyWorks = mock(
		async (): Promise<Map<string, unknown[]>> => new Map(),
	);
	const resolve = mock(
		async (_request: { workId: string }): Promise<ResolvedMetricSource> =>
			makeResolvedSource(),
	);
	const dependencies = {
		getCostCenterById,
		getOrganizationById,
		getWorksByCostCenter,
		getWorksByOrganization,
		getWorkMeasurementsForBI,
		getWorkMeasurementsForManyWorks,
		resolver: { resolve },
	} as unknown as OrgBIServiceDependencies;
	const service = new OrgBIService(dependencies);
	return {
		service,
		dependencies,
		getWorksByCostCenter,
		getWorksByOrganization,
		resolve,
	};
}

describe("OrgBIService via canonical source resolver", () => {
	it("propagates asOfDate to per-work resolution in cost center BI", async () => {
		const { service, dependencies, getWorksByCostCenter } = makeService();
		const asOf = new Date("2026-01-10T00:00:00.000Z");
		getWorksByCostCenter.mockResolvedValue([
			workFixture({ id: "work-1", costCenterId: "cc-1" }),
		] as never);

		const result = await service.getCostCenterBI(
			"owner-1",
			"org-1",
			"cc-1",
			undefined,
			asOf,
		);

		expect(dependencies.getWorksByCostCenter).toHaveBeenCalledWith(
			"owner-1",
			"cc-1",
		);
		expect(dependencies.getWorkMeasurementsForManyWorks).toHaveBeenCalledWith(
			"owner-1",
			["work-1"],
		);
		expect(result.asOfDate).toBe("2026-01-10T00:00:00.000Z");
		expect(result.sourceMode).toBe("LIVE");
		expect(result.cards.totalWorks).toBe(1);
	});

	it("aggregates LIVE works in organization BI with measurements fetched in batch", async () => {
		const { service, dependencies, getWorksByOrganization } = makeService();
		getWorksByOrganization.mockResolvedValue([
			workFixture({ id: "work-1" }),
		] as never);

		const result = await service.getOrganizationBI("owner-1", "org-1");

		expect(dependencies.getWorkMeasurementsForManyWorks).toHaveBeenCalledTimes(
			1,
		);
		expect(result.sourceMode).toBe("LIVE");
		expect(result.cards.totalWorks).toBe(1);
		expect(result.works[0]).toMatchObject({
			workId: "work-1",
			sourceMode: "LIVE",
			snapshotVersion: null,
		});
	});
});
