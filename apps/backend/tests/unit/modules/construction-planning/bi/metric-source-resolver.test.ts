import { describe, expect, it, mock } from "bun:test";
import type { WorkForBIInput } from "../../../../../src/modules/construction-planning/bi/calculations";
import type { MetricSourceRequest } from "../../../../../src/modules/construction-planning/bi/metric-source";
import {
	MetricSourceResolver,
	type MetricSourceResolverDependencies,
	seriesPointStatus,
} from "../../../../../src/modules/construction-planning/bi/metric-source-resolver";

function workFixture(overrides: Partial<WorkForBIInput> = {}): WorkForBIInput {
	return {
		id: "work-1",
		code: "OBRA-001",
		name: "Obra",
		clientName: null,
		plannedStart: null,
		plannedEnd: null,
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
				description: "Servico E2E",
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

function _workWithBudget(budget: number): WorkForBIInput {
	const stage = {
		id: "stage-1",
		parentId: null,
		index: "1",
		type: "STAGE",
		description: "Etapa 1",
		quantity: null,
		totalCost: budget,
		totalBudget: budget,
		plannedStart: null,
		plannedEnd: null,
		actualStart: null,
		actualEnd: null,
		completionPercentage: 0,
		computedStatus: "IN_PROGRESS",
		sortOrder: 0,
	};
	const item = {
		id: "item-1",
		parentId: "stage-1",
		index: "1.1",
		type: "ITEM",
		description: "Servico E2E",
		quantity: budget / 1000,
		totalCost: budget,
		totalBudget: budget,
		plannedStart: null,
		plannedEnd: null,
		actualStart: null,
		actualEnd: null,
		completionPercentage: 0,
		computedStatus: "IN_PROGRESS",
		sortOrder: 1,
	};
	return {
		...workFixture(),
		items: [stage, item],
	};
}

function makeDeps(overrides: Partial<MetricSourceResolverDependencies> = {}) {
	const getWork = mock<MetricSourceResolverDependencies["getWork"]>(
		async () => null,
	);
	const getManualMeasurements = mock<
		MetricSourceResolverDependencies["getManualMeasurements"]
	>(async () => []);
	const listContracts = mock<MetricSourceResolverDependencies["listContracts"]>(
		async () => [],
	);
	const getLedgerSummary = mock<
		MetricSourceResolverDependencies["getLedgerSummary"]
	>(async () => null);
	const getBudgetBalance = mock<
		MetricSourceResolverDependencies["getBudgetBalance"]
	>(async () => null);
	return {
		dependencies: {
			getWork,
			getManualMeasurements,
			listContracts,
			getLedgerSummary,
			getBudgetBalance,
			...overrides,
		} as MetricSourceResolverDependencies,
		getWork,
		getManualMeasurements,
		listContracts,
		getLedgerSummary,
		getBudgetBalance,
	};
}

describe("MetricSourceResolver LIVE", () => {
	it("resolves work with active children and returns the full envelope", async () => {
		const deps = makeDeps();
		deps.getWork.mockResolvedValue(workFixture());
		deps.listContracts.mockResolvedValue([
			{
				id: "contract-1",
				contractValue: 50000,
				measuredValue: null,
				paidValue: 0,
				status: "ATIVO",
			},
		]);
		const resolver = new MetricSourceResolver(deps.dependencies);

		const result = await resolver.resolve({
			ownerId: "owner-1",
			workId: "work-1",
		});

		expect(result.mode).toBe("LIVE");
		expect(result.ownerId).toBe("owner-1");
		expect(result.workId).toBe("work-1");
		expect(result.snapshotId).toBeNull();
		expect(result.version).toBeNull();
		expect(result.snapshot).toBeNull();
		expect(result.fingerprint).toMatch(/^[0-9a-f]{64}$/);
		expect(result.asOfDate).toBe("2026-01-01T00:00:00.000Z");
		expect(result.metrics.activeBudget).toBe(100000);
		expect(result.metrics.earnedValue).toBe(30000);
		expect(result.metrics.actualCost).toBe(10000);
		expect(result.input.items.find((item) => item.type === "ITEM")?.id).toBe(
			"item-1",
		);
		expect(result.input.measurements).toHaveLength(1);
		expect(result.series.points.length).toBe(12);
		expect(result.series.points[0]).toMatchObject({
			period: "2026-01",
			earnedValue: 30000,
			actualCost: 10000,
			status: "AVAILABLE",
		});
		expect(result.contracts).toEqual([
			{
				id: "contract-1",
				contractValue: 50000,
				measuredValue: null,
				paidValue: 0,
				status: "ATIVO",
			},
		]);
		expect(result.quality).toEqual({
			missing: 0,
			invalid: 0,
			unlinked: 0,
			duplicated: 0,
			stale: 0,
		});
		expect(deps.getWork).toHaveBeenCalledWith("owner-1", "work-1");
	});

	it("cuts costs after asOfDate", async () => {
		const deps = makeDeps();
		deps.getWork.mockResolvedValue(
			workFixture({
				actualCosts: [
					{
						id: "c-1",
						budgetItemId: "item-1",
						costDate: new Date("2026-01-01T00:00:00.000Z"),
						amount: 10000,
						costType: "CURRENT",
					},
					{
						id: "c-2",
						budgetItemId: "item-1",
						costDate: new Date("2026-01-20T00:00:00.000Z"),
						amount: 5000,
						costType: "CURRENT",
					},
				],
			}),
		);
		const resolver = new MetricSourceResolver(deps.dependencies);

		const before = await resolver.resolve({
			ownerId: "owner-1",
			workId: "work-1",
			asOfDate: new Date("2026-01-10T00:00:00.000Z"),
		});
		const after = await resolver.resolve({
			ownerId: "owner-1",
			workId: "work-1",
			asOfDate: new Date("2026-06-01T00:00:00.000Z"),
		});

		expect(before.metrics.actualCost).toBe(10000);
		expect(before.asOfDate).toBe("2026-01-10T00:00:00.000Z");
		expect(after.metrics.actualCost).toBe(15000);
		expect(after.asOfDate).toBe("2026-06-01T00:00:00.000Z");
	});

	it("computes a stable fingerprint for the same envelope and a different one when it changes", async () => {
		const deps = makeDeps();
		deps.getWork.mockResolvedValue(workFixture());
		const resolver = new MetricSourceResolver(deps.dependencies);
		const request: MetricSourceRequest = {
			ownerId: "owner-1",
			workId: "work-1",
		};

		const first = await resolver.resolve(request);
		const second = await resolver.resolve(request);
		expect(second.fingerprint).toBe(first.fingerprint);

		deps.getWork.mockResolvedValue(
			workFixture({
				items: [
					{
						id: "item-1",
						parentId: null,
						index: "1.1",
						type: "ITEM",
						description: "Servico E2E",
						quantity: 100,
						totalCost: 999999,
						totalBudget: 999999,
						plannedStart: null,
						plannedEnd: null,
						actualStart: null,
						actualEnd: null,
						completionPercentage: 0,
						computedStatus: "IN_PROGRESS",
						sortOrder: 1,
					},
				],
			}),
		);
		const changed = await resolver.resolve(request);
		expect(changed.fingerprint).not.toBe(first.fingerprint);
	});

	it("throws NOT_FOUND when the work is missing", async () => {
		const deps = makeDeps();
		deps.getWork.mockResolvedValue(null);
		const resolver = new MetricSourceResolver(deps.dependencies);

		await expect(
			resolver.resolve({ ownerId: "owner-1", workId: "missing" }),
		).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
	});

	it("derives quality counts from data completeness", async () => {
		const deps = makeDeps();
		deps.getWork.mockResolvedValue(
			workFixture({
				baselineSchedules: [],
				measurements: [],
				actualCosts: [],
			}),
		);
		const resolver = new MetricSourceResolver(deps.dependencies);

		const result = await resolver.resolve({
			ownerId: "owner-1",
			workId: "work-1",
		});

		expect(result.quality).toEqual({
			missing: 3,
			invalid: 0,
			unlinked: 0,
			duplicated: 0,
			stale: 0,
		});

		deps.getWork.mockResolvedValue(
			workFixture({
				baselineSchedules: [],
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
						costDate: new Date("2026-01-01T00:00:00.000Z"),
						amount: 0,
						costType: "CURRENT",
					},
				],
			}),
		);
		const withInvalid = await resolver.resolve({
			ownerId: "owner-1",
			workId: "work-1",
		});
		expect(withInvalid.quality.missing).toBe(1);
		expect(withInvalid.quality.invalid).toBe(1);

		deps.getWork.mockResolvedValue(
			workFixture({
				actualCosts: [
					{
						id: "c-1",
						costDate: new Date("2026-01-01T00:00:00.000Z"),
						amount: 10000,
						costType: "CURRENT",
					},
				],
			}),
		);
		const withUnlinked = await resolver.resolve({
			ownerId: "owner-1",
			workId: "work-1",
		});
		expect(withUnlinked.quality.unlinked).toBe(1);
	});
});

describe("seriesPointStatus", () => {
	it("is UNAVAILABLE when all values are null and AVAILABLE otherwise", () => {
		expect(seriesPointStatus(null, null, null)).toBe("UNAVAILABLE");
		expect(seriesPointStatus(0, null, null)).toBe("AVAILABLE");
		expect(seriesPointStatus(null, 0, null)).toBe("AVAILABLE");
		expect(seriesPointStatus(null, null, 0)).toBe("AVAILABLE");
	});
});
