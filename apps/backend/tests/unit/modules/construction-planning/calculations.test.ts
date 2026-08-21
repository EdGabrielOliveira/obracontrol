import { describe, expect, it } from "bun:test";
import {
	actualCostForNode,
	buildActualCostByItemKey,
	computeWorkStatus,
	daysBetween,
} from "../../../../src/modules/construction-planning/bi/calculations";
import type { ItemMetricNode } from "../../../../src/modules/construction-planning/bi/metrics";
import { buildMultiworksBI } from "../../../../src/modules/construction-planning/bi/multiworks-builder";
import { buildWorkBI } from "../../../../src/modules/construction-planning/bi/work-bi-builder";
import { buildScheduleFromDbItems } from "../../../../src/modules/construction-planning/schedule/schedule-builder";

const unifiedWork = {
	id: "w-unified",
	code: "OBRA-001",
	name: "Obra Unificada",
	clientName: "Cliente A",
	plannedStart: new Date("2026-01-01T00:00:00.000Z"),
	plannedEnd: new Date("2026-01-31T00:00:00.000Z"),
	baseDate: new Date("2026-01-15T00:00:00.000Z"),
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	lastImportAt: new Date("2026-01-02T00:00:00.000Z"),
};

const unifiedRows = {
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
	scheduleRevisions: [
		{
			id: "revision-1",
			budgetItemId: "item-1",
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
			costDate: new Date("2026-01-12T00:00:00.000Z"),
			amount: 25,
			costType: "CURRENT",
			category: "OTHER",
			appropriationStatus: "UNAPPROPRIATED",
		},
		{
			id: "cost-3",
			budgetItemId: null,
			budgetIndex: null,
			costDate: new Date("2026-01-20T00:00:00.000Z"),
			amount: 50,
			costType: "FUTURE",
			category: "OTHER",
			appropriationStatus: "UNAPPROPRIATED",
		},
		{
			id: "cost-4",
			budgetItemId: null,
			budgetIndex: null,
			costDate: new Date("2026-01-25T00:00:00.000Z"),
			amount: -10,
			costType: "CURRENT",
			category: "OTHER",
			appropriationStatus: "UNAPPROPRIATED",
		},
	],
};

describe("daysBetween", () => {
	it("returns null when start is null", () => {
		expect(daysBetween(null, new Date())).toBeNull();
	});

	it("returns null when end is null", () => {
		expect(daysBetween(new Date(), null)).toBeNull();
	});

	it("calculates days between two dates", () => {
		const start = new Date("2024-01-01");
		const end = new Date("2024-01-10");
		expect(daysBetween(start, end)).toBe(10);
	});

	it("returns 1 for same day", () => {
		const d = new Date("2024-01-01");
		expect(daysBetween(d, d)).toBe(1);
	});
});

describe("computeWorkStatus", () => {
	it("computes status from measured percentage", () => {
		expect(computeWorkStatus(0)).toBe("NOT_STARTED");
		expect(computeWorkStatus(0.5)).toBe("IN_PROGRESS");
		expect(computeWorkStatus(1)).toBe("DONE");
	});
});

describe("buildActualCostByItemKey", () => {
	const dataDate = new Date("2026-01-15T00:00:00.000Z");

	it("allocates cost amounts across allocation budget items, ignoring the direct amount", () => {
		const totals = buildActualCostByItemKey(
			[
				{
					id: "cost-allocated",
					budgetItemId: "item-a",
					budgetIndex: "1.1",
					costDate: new Date("2026-01-10T00:00:00.000Z"),
					amount: 1000,
					costType: "CURRENT",
					category: "MATERIAL",
					allocations: [
						{ budgetItemId: "item-a", percentage: 60, value: 600 },
						{ budgetItemId: "item-b", percentage: 40, value: 400 },
					],
				},
			],
			dataDate,
		);

		expect(totals.get("id:item-a")).toBe(600);
		expect(totals.get("id:item-b")).toBe(400);
	});

	it("maps direct current costs by budget item id", () => {
		const totals = buildActualCostByItemKey(
			[
				{
					id: "cost-direct",
					budgetItemId: "item-a",
					costDate: new Date("2026-01-10T00:00:00.000Z"),
					amount: 250,
					costType: "CURRENT",
					category: "MATERIAL",
				},
			],
			dataDate,
		);

		expect(totals.get("id:item-a")).toBe(250);
	});

	it("maps manual costs with only a budget index by index key", () => {
		const totals = buildActualCostByItemKey(
			[
				{
					id: "cost-manual",
					importId: null,
					budgetItemId: null,
					budgetIndex: "1.1",
					costDate: new Date("2026-01-10T00:00:00.000Z"),
					amount: 120,
					costType: "CURRENT",
					category: "MATERIAL",
				},
			],
			dataDate,
		);

		expect(totals.get("index:1.1")).toBe(120);
	});

	it("excludes future costs and current costs after data date", () => {
		const totals = buildActualCostByItemKey(
			[
				{
					id: "cost-future",
					budgetItemId: "item-a",
					costDate: new Date("2026-01-20T00:00:00.000Z"),
					amount: 100,
					costType: "FUTURE",
					category: "MATERIAL",
				},
				{
					id: "cost-late",
					budgetItemId: "item-a",
					costDate: new Date("2026-01-20T00:00:00.000Z"),
					amount: 50,
					costType: "CURRENT",
					category: "MATERIAL",
				},
			],
			dataDate,
		);

		expect(totals.size).toBe(0);
	});
});

describe("actualCostForNode", () => {
	it("rolls up own id and index costs plus descendant costs", () => {
		const node = {
			id: "stage-1",
			index: "1",
			children: [
				{ id: "item-a", index: "1.1", children: [] },
				{ id: "item-b", index: "1.2", children: [] },
			],
		} as unknown as ItemMetricNode;

		const costsByKey = new Map<string, number>([
			["id:stage-1", 10],
			["index:1", 5],
			["id:item-a", 100],
			["index:1.2", 40],
		]);

		expect(actualCostForNode(node, costsByKey)).toBe(155);
	});

	it("returns zero when no cost matches the node or its descendants", () => {
		const node = {
			id: "stage-1",
			index: "1",
			children: [{ id: "item-a", index: "1.1", children: [] }],
		} as unknown as ItemMetricNode;

		expect(actualCostForNode(node, new Map())).toBe(0);
	});
});

describe("buildScheduleFromDbItems", () => {
	it("builds schedule with correct totals", () => {
		const work = {
			id: "w1",
			code: "C001",
			name: "Test Work",
			plannedStart: new Date("2024-01-01"),
			plannedEnd: new Date("2024-12-31"),
			baseDate: null,
			createdAt: new Date(),
			lastImportAt: null,
		};

		const items = [
			{
				id: "s1",
				parentId: null,
				index: "001",
				type: "STAGE",
				description: "Stage 1",
				unit: null,
				quantity: null,
				unitCost: null,
				totalCost: 0,
				plannedStart: new Date("2024-01-01"),
				plannedEnd: new Date("2024-06-30"),
				actualStart: null,
				actualEnd: null,
				completionPercentage: 0,
				providedStatus: null,
				computedStatus: "NOT_STARTED",
				sortOrder: 1,
			},
			{
				id: "i1",
				parentId: "s1",
				index: "001.01",
				type: "ITEM",
				description: "Item 1",
				unit: "m2",
				quantity: 100,
				unitCost: 50,
				totalCost: 5000,
				plannedStart: new Date("2024-01-01"),
				plannedEnd: new Date("2024-03-31"),
				actualStart: null,
				actualEnd: null,
				completionPercentage: 0.5,
				providedStatus: null,
				computedStatus: "IN_PROGRESS",
				sortOrder: 2,
			},
			{
				id: "i2",
				parentId: "s1",
				index: "001.02",
				type: "ITEM",
				description: "Item 2",
				unit: "m2",
				quantity: 50,
				unitCost: 100,
				totalCost: 5000,
				plannedStart: new Date("2024-04-01"),
				plannedEnd: new Date("2024-06-30"),
				actualStart: null,
				actualEnd: null,
				completionPercentage: 0,
				providedStatus: null,
				computedStatus: "NOT_STARTED",
				sortOrder: 3,
			},
		];

		const result = buildScheduleFromDbItems(work, { items });

		expect(result.work.id).toBe("w1");
		expect(result.work.totalBudget).toBe(10000);
		expect(result.work.measuredPercentage).toBe(0.25);
		expect(result.work.balance).toBe(7500);
		expect(result.items).toHaveLength(1);
		expect(result.items[0].type).toBe("STAGE");
		expect(result.items[0].children).toHaveLength(2);
	});

	it("normalizes budget completion percentage into progress ratio", () => {
		const work = {
			id: "w2",
			code: "C002",
			name: "Test Work 2",
			plannedStart: new Date("2024-01-01"),
			plannedEnd: new Date("2024-12-31"),
			baseDate: null,
			createdAt: new Date(),
			lastImportAt: null,
		};

		const items = [
			{
				id: "i1",
				parentId: null,
				index: "001.01",
				type: "ITEM",
				description: "Item 1",
				unit: "m2",
				quantity: 100,
				unitCost: 50,
				totalCost: 5000,
				plannedStart: new Date("2024-01-01"),
				plannedEnd: new Date("2024-03-31"),
				actualStart: null,
				actualEnd: null,
				completionPercentage: 74,
				providedStatus: null,
				computedStatus: "IN_PROGRESS",
				sortOrder: 1,
			},
		];

		const result = buildScheduleFromDbItems(work, { items });

		expect(result.work.measuredPercentage).toBe(0.74);
		expect(result.items[0].completionPercentage).toBe(0.74);
		expect(result.gantt[0].measuredPercentage).toBe(0.74);
	});

	it("builds schedule with gantt baseline and replanned ranges", () => {
		const result = buildScheduleFromDbItems(unifiedWork, unifiedRows);

		expect(result.work.id).toBe("w-unified");
		expect(result.work.baseDate).toBe("2026-01-15T00:00:00.000Z");
		expect(result.items).toHaveLength(1);
		expect(result.gantt).toEqual([
			expect.objectContaining({
				id: "item-1",
				itemId: "item-1",
				index: "1.1",
				label: "Escavacao",
				baselineStart: "2026-01-01T00:00:00.000Z",
				baselineEnd: "2026-01-31T00:00:00.000Z",
				replannedStart: "2026-01-05T00:00:00.000Z",
				replannedEnd: "2026-02-05T00:00:00.000Z",
				measuredPercentage: 0.5,
				status: "IN_PROGRESS",
			}),
		]);
	});

	it("exposes baseline and revised ends with shift deltas per item", () => {
		const result = buildScheduleFromDbItems(unifiedWork, unifiedRows);

		const item = result.items[0].children?.[0];
		expect(item?.id).toBe("item-1");
		expect(item?.baselineEnd).toBe("2026-01-31T00:00:00.000Z");
		expect(item?.revisedEnd).toBe("2026-02-05T00:00:00.000Z");
		expect(item?.deltaDays).toBe(5);
		expect(item?.deltaPercent).toBeCloseTo(5 / 31, 10);
	});

	it("summarizes replanning impact on the work", () => {
		const result = buildScheduleFromDbItems(unifiedWork, unifiedRows);

		expect(result.replanning).toEqual({
			totalRevisedItems: 1,
			latestRevisionDate: "2026-01-10T00:00:00.000Z",
			totalRevisions: 1,
			itemsShifted: 1,
			maxDeltaDays: 5,
			revisedEndAt: "2026-02-05T00:00:00.000Z",
		});
	});

	it("falls back to null shift deltas when there is no revision", () => {
		const result = buildScheduleFromDbItems(
			{
				id: "w2",
				code: "C002",
				name: "Test Work 2",
				plannedStart: new Date("2024-01-01"),
				plannedEnd: new Date("2024-12-31"),
				baseDate: null,
				createdAt: new Date(),
				lastImportAt: null,
			},
			{
				items: [
					{
						id: "i1",
						parentId: null,
						index: "001.01",
						type: "ITEM",
						description: "Item 1",
						unit: "m2",
						quantity: 100,
						unitCost: 50,
						totalCost: 5000,
						plannedStart: new Date("2024-01-01"),
						plannedEnd: new Date("2024-03-31"),
						actualStart: null,
						actualEnd: null,
						completionPercentage: 0,
						providedStatus: null,
						computedStatus: "NOT_STARTED",
						sortOrder: 1,
					},
				],
			},
		);

		expect(result.items[0].baselineEnd).toBe("2024-03-31T00:00:00.000Z");
		expect(result.items[0].revisedEnd).toBeNull();
		expect(result.items[0].deltaDays).toBeNull();
		expect(result.items[0].deltaPercent).toBeNull();
		expect(result.replanning.itemsShifted).toBe(0);
		expect(result.replanning.maxDeltaDays).toBe(0);
		expect(result.replanning.revisedEndAt).toBeNull();
	});
});

describe("buildMultiworksBI", () => {
	it("builds cards correctly", () => {
		const works = [
			{
				id: "w1",
				name: "Work 1",
				plannedStart: new Date("2024-01-01"),
				plannedEnd: new Date("2024-12-31"),
				baseDate: new Date("2024-06-01"),
				createdAt: new Date("2024-01-01"),
				lastImportAt: new Date("2024-01-02"),
				items: [
					{
						id: "i1",
						parentId: null,
						index: "001.01",
						type: "ITEM",
						description: "Item 1",
						totalCost: 10000,
						plannedStart: new Date("2024-01-01"),
						plannedEnd: new Date("2024-06-30"),
						actualStart: null,
						actualEnd: null,
						completionPercentage: 0.5,
						computedStatus: "IN_PROGRESS",
						sortOrder: 1,
					},
					{
						id: "i2",
						parentId: null,
						index: "001.02",
						type: "ITEM",
						description: "Item 2",
						totalCost: 5000,
						plannedStart: new Date("2024-07-01"),
						plannedEnd: new Date("2024-12-31"),
						actualStart: null,
						actualEnd: null,
						completionPercentage: 0,
						computedStatus: "NOT_STARTED",
						sortOrder: 2,
					},
				],
			},
		];

		const result = buildMultiworksBI(works);

		expect(result.cards.totalWorks).toBe(1);
		expect(result.cards.totalActiveBudget).toBe(15000);
		expect(result.cards.totalEarnedValue).toBe(5000);
		expect(result.cards.totalBudgetBalance).toBe(10000);
		expect(result.cards.worksBelowCost).toBeNull();
		expect(result.cards.worksAboveCost).toBeNull();
		expect(result.costsByWork).toHaveLength(1);
		expect(result.costsByWork[0].budget).toBe(15000);
		expect(result.costsByWork[0].costVariance).toBeNull();
		expect(result.scheduleByWork).toHaveLength(1);
	});

	it("counts works ahead and behind schedule by monetary schedule variance", () => {
		const result = buildMultiworksBI([
			{
				id: "w1",
				name: "Ahead by value",
				plannedStart: new Date("2026-01-01T00:00:00.000Z"),
				plannedEnd: new Date("2026-01-31T00:00:00.000Z"),
				baseDate: new Date("2026-02-01T00:00:00.000Z"),
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				lastImportAt: null,
				items: [
					{
						id: "planned",
						parentId: null,
						index: "001",
						type: "ITEM",
						description: "Planned complete",
						totalCost: 100,
						plannedStart: new Date("2026-01-01T00:00:00.000Z"),
						plannedEnd: new Date("2026-01-31T00:00:00.000Z"),
						actualStart: null,
						actualEnd: null,
						completionPercentage: 1,
						computedStatus: "DONE",
						sortOrder: 1,
					},
					{
						id: "unplanned-progress",
						parentId: null,
						index: "002",
						type: "ITEM",
						description: "Unplanned progress",
						totalCost: 100,
						plannedStart: null,
						plannedEnd: null,
						actualStart: null,
						actualEnd: null,
						completionPercentage: 0.2,
						computedStatus: "IN_PROGRESS",
						sortOrder: 2,
					},
				],
			},
		]);

		expect(result.scheduleByWork[0].scheduleVariation).toBeLessThan(0);
		expect(result.scheduleByWork[0].scheduleVariance).toBe(20);
		expect(result.cards.worksAheadSchedule).toBe(1);
		expect(result.cards.worksBehindSchedule).toBe(0);
	});

	it("builds portfolio chart, rankings, works and completeness from unified rows", () => {
		const result = buildMultiworksBI([{ ...unifiedWork, ...unifiedRows }]);

		expect(result.cards.totalWorks).toBe(1);
		expect(result.cards.totalActualCost).toBe(225);
		expect(result.rankings.costPerformance[0]).toMatchObject({
			workId: "w-unified",
		});
		expect(result.portfolioChart[0]).toMatchObject({
			workId: "w-unified",
			workName: "Obra Unificada",
			activeBudget: 550,
			plannedValue: expect.any(Number),
			earnedValue: 275,
			actualCost: 225,
			spi: expect.any(Number),
			cpi: expect.any(Number),
		});
		expect(result.works[0]).toMatchObject({
			workId: "w-unified",
			clientName: "Cliente A",
			actualCost: 225,
			currentBudgetBalance: 325,
		});
		expect(result.dataCompleteness.hasActualCosts).toBe(true);
		expect(result.qualityIssues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "UNAPPROPRIATED_ACTUAL_COSTS",
					workId: "w-unified",
				}),
			]),
		);
	});
});

describe("buildWorkBI", () => {
	it("uses base date and returns schedule metrics without fake cost performance", () => {
		const result = buildWorkBI(
			{
				id: "w1",
				name: "Obra",
				plannedStart: new Date("2026-01-01T00:00:00.000Z"),
				plannedEnd: new Date("2026-01-10T00:00:00.000Z"),
				baseDate: new Date("2026-01-05T00:00:00.000Z"),
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				lastImportAt: new Date("2026-01-02T00:00:00.000Z"),
			},
			{
				items: [
					{
						id: "i1",
						parentId: null,
						index: "001.01",
						type: "ITEM",
						description: "Item",
						totalCost: 1000,
						plannedStart: new Date("2026-01-01T00:00:00.000Z"),
						plannedEnd: new Date("2026-01-10T00:00:00.000Z"),
						actualStart: null,
						actualEnd: null,
						completionPercentage: 0.25,
						computedStatus: "IN_PROGRESS",
						sortOrder: 1,
					},
				],
			},
		);

		expect(result.summary.dataDate).toBe("2026-01-05T00:00:00.000Z");
		expect(result.summary.plannedValue).toBe(500);
		expect(result.summary.earnedValue).toBe(250);
		expect(result.summary.scheduleVariance).toBe(-250);
		expect(result.summary.schedulePerformanceIndex).toBe(0.5);
		expect(result.summary.costPerformanceIndex).toBeNull();
	});

	it("BI-003: SPI baixo dispara alerta de cronograma no response", () => {
		const result = buildWorkBI(
			{
				id: "w1",
				name: "Obra",
				plannedStart: new Date("2026-01-01T00:00:00.000Z"),
				plannedEnd: new Date("2026-01-10T00:00:00.000Z"),
				baseDate: new Date("2026-01-05T00:00:00.000Z"),
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				lastImportAt: new Date("2026-01-02T00:00:00.000Z"),
			},
			{
				items: [
					{
						id: "i1",
						parentId: null,
						index: "001.01",
						type: "ITEM",
						description: "Item",
						totalCost: 1000,
						plannedStart: new Date("2026-01-01T00:00:00.000Z"),
						plannedEnd: new Date("2026-01-10T00:00:00.000Z"),
						actualStart: null,
						actualEnd: null,
						completionPercentage: 0.25,
						computedStatus: "IN_PROGRESS",
						sortOrder: 1,
					},
				],
			},
		);

		expect(result.alerts).toContainEqual(
			expect.objectContaining({
				code: "SPI_BELOW",
				severity: "HIGH",
				metric: "SPI",
				value: 0.5,
			}),
		);
	});

	it("builds work BI with chart series, metric indicators and calculation audit", () => {
		const result = buildWorkBI(unifiedWork, unifiedRows);

		expect(result.indicators.costPerformanceIndex.formula).toBe("EV / AC");
		expect(result.indicators.costPerformanceIndex.status).toBe("AVAILABLE");
		expect(result.sCurve[0]).toHaveProperty("trendProjected");
		expect(result.costByStage[0]).toMatchObject({
			stageId: "stage-1",
			activeBudget: 550,
			earnedValue: 275,
			actualCost: 200,
		});
		expect(result.costByStage[0]).toMatchObject({ actualCost: 200 });
		expect(result.unappropriatedCosts).toMatchObject({
			totalActual: 25,
			totalFuture: 50,
		});
		// BI-002: custo negativo (estorno/credito) e preservado com estado de
		// revisao em vez de descartado silenciosamente.
		expect(result.unappropriatedCosts.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ amount: -10, needsReview: true }),
			]),
		);
		expect(result.unappropriatedCosts.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ amount: 25, needsReview: false }),
			]),
		);
		expect(result.qualityIssues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "UNAPPROPRIATED_ACTUAL_COSTS",
					metric: "AC",
					workId: "w-unified",
				}),
				expect.objectContaining({
					code: "UNAPPROPRIATED_FUTURE_COSTS",
					metric: "AC",
					workId: "w-unified",
				}),
			]),
		);
		expect(result.calculationAudit).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					source: "Cronograma Original",
					formula: expect.any(String),
				}),
				expect.objectContaining({
					source: "Medicoes",
					formula: expect.any(String),
				}),
				expect.objectContaining({
					source: "Custos Realizados",
					formula: "EV / AC",
				}),
				expect.objectContaining({ key: "saldo", result: 325 }),
			]),
		);
	});

	it("allocates manual actual costs by active budget index while preserving imported id matching", () => {
		const result = buildWorkBI(
			{
				id: "w-manual-cost",
				name: "Obra com custo manual",
				plannedStart: null,
				plannedEnd: null,
				baseDate: new Date("2026-01-15T00:00:00.000Z"),
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				lastImportAt: new Date("2026-01-02T00:00:00.000Z"),
			},
			{
				items: [
					{
						id: "active-item",
						parentId: null,
						index: "1",
						type: "STAGE",
						description: "Etapa ativa",
						totalCost: 0,
						totalBudget: 0,
						plannedStart: null,
						plannedEnd: null,
						actualStart: null,
						actualEnd: null,
						completionPercentage: 0,
						computedStatus: "NOT_STARTED",
						sortOrder: 1,
					},
				],
				actualCosts: [
					{
						id: "manual-cost",
						importId: null,
						budgetItemId: "old-item",
						budgetIndex: "1",
						costDate: new Date("2026-01-10T00:00:00.000Z"),
						amount: 123,
						costType: "CURRENT",
						category: "MATERIAL",
						appropriationStatus: "APPROPRIATED",
					},
					{
						id: "imported-cost",
						importId: "active-import",
						budgetItemId: "active-item",
						budgetIndex: "old-index",
						costDate: new Date("2026-01-10T00:00:00.000Z"),
						amount: 45,
						costType: "CURRENT",
						category: "MATERIAL",
						appropriationStatus: "APPROPRIATED",
					},
				],
			},
		);

		expect(result.costByStage[0]).toMatchObject({
			stageId: "active-item",
			stageIndex: "1",
			actualCost: 168,
		});
	});
});
