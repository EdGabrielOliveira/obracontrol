import { describe, expect, it } from "bun:test";
import {
	buildHierarchy,
	buildMonthlySCurve,
	calculateItemMetrics,
	calculateWorkMetrics,
	getDataDate,
	inclusiveDays,
	plannedProgressAt,
	rollupNode,
} from "../../../../src/modules/construction-planning/bi/metrics";
import type { MetricMeasurementInput } from "../../../../src/modules/construction-planning/bi/metrics-core";

const jan15 = new Date("2026-01-15T00:00:00.000Z");

describe("getDataDate", () => {
	it("uses base date, latest import, then creation date fallback", () => {
		const createdAt = new Date("2026-01-01T00:00:00.000Z");
		const lastImportAt = new Date("2026-01-02T00:00:00.000Z");
		const baseDate = new Date("2026-01-03T00:00:00.000Z");

		expect(
			getDataDate({
				id: "w1",
				name: "Obra",
				plannedStart: null,
				plannedEnd: null,
				baseDate,
				createdAt,
				lastImportAt,
			}),
		).toBe(baseDate);
		expect(
			getDataDate({
				id: "w1",
				name: "Obra",
				plannedStart: null,
				plannedEnd: null,
				baseDate: null,
				createdAt,
				lastImportAt,
			}),
		).toBe(lastImportAt);
		expect(
			getDataDate({
				id: "w1",
				name: "Obra",
				plannedStart: null,
				plannedEnd: null,
				baseDate: null,
				createdAt,
				lastImportAt: null,
			}),
		).toBe(createdAt);
	});
});

describe("inclusiveDays", () => {
	it("counts dates inclusively at UTC day precision", () => {
		expect(
			inclusiveDays(
				new Date("2026-01-01T23:00:00.000Z"),
				new Date("2026-01-10T01:00:00.000Z"),
			),
		).toBe(10);
		expect(inclusiveDays(jan15, jan15)).toBe(1);
	});
});

describe("plannedProgressAt", () => {
	it("uses inclusive date ranges and handles same-day tasks", () => {
		expect(plannedProgressAt(jan15, jan15, jan15)).toBe(1);
		expect(
			plannedProgressAt(
				new Date("2026-01-05T00:00:00.000Z"),
				new Date("2026-01-01T00:00:00.000Z"),
				new Date("2026-01-10T00:00:00.000Z"),
			),
		).toBe(0.5);
	});
});

describe("calculateWorkMetrics", () => {
	const unifiedWork = {
		id: "w-unified",
		name: "Obra Unificada",
		plannedStart: new Date("2026-01-01T00:00:00.000Z"),
		plannedEnd: new Date("2026-01-31T00:00:00.000Z"),
		baseDate: new Date("2026-01-15T00:00:00.000Z"),
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		lastImportAt: null,
	};

	const unifiedBudgetItems = [
		{
			id: "item-active",
			parentId: null,
			index: "1.1",
			type: "ITEM",
			description: "Escavacao",
			quantity: 10,
			laborCost: 200,
			materialCost: 300,
			equipmentCost: 50,
			otherCost: 0,
			totalCost: 550,
			plannedStart: null,
			plannedEnd: null,
			actualStart: null,
			actualEnd: null,
			completionPercentage: 0,
			computedStatus: "IN_PROGRESS",
			sortOrder: 1,
		},
		{
			id: "item-ignored",
			parentId: null,
			index: "1.2",
			type: "ITEM",
			description: "Ignorado",
			quantity: 1,
			laborCost: 100,
			materialCost: 0,
			equipmentCost: 0,
			otherCost: 0,
			totalCost: 100,
			plannedStart: null,
			plannedEnd: null,
			actualStart: null,
			actualEnd: null,
			completionPercentage: 0,
			computedStatus: "IGNORED",
			sortOrder: 2,
		},
		{
			id: "item-suspended",
			parentId: null,
			index: "1.3",
			type: "ITEM",
			description: "Suspenso",
			quantity: 1,
			laborCost: 0,
			materialCost: 200,
			equipmentCost: 0,
			otherCost: 0,
			totalCost: 200,
			plannedStart: null,
			plannedEnd: null,
			actualStart: null,
			actualEnd: null,
			completionPercentage: 0,
			computedStatus: "SUSPENDED",
			sortOrder: 3,
		},
	];

	const unifiedBaselineSchedules = [
		{
			id: "baseline-active",
			budgetItemId: "item-active",
			budgetItemIndex: "1.1",
			plannedStart: new Date("2026-01-01T00:00:00.000Z"),
			plannedEnd: new Date("2026-01-31T00:00:00.000Z"),
		},
	];

	const unifiedMeasurements = [
		{
			id: "measurement-active",
			budgetItemId: "item-active",
			budgetItemIndex: "1.1",
			measurementDate: new Date("2026-01-15T00:00:00.000Z"),
			measuredPercentageAccumulated: 0.5,
			measuredQuantityAccumulated: null,
		},
		{
			id: "measurement-future",
			budgetItemId: "item-active",
			budgetItemIndex: "1.1",
			measurementDate: new Date("2026-01-20T00:00:00.000Z"),
			measuredPercentageAccumulated: 0.75,
			measuredQuantityAccumulated: null,
		},
	];

	const unifiedActualCosts = [
		{
			id: "actual-current",
			budgetItemId: "item-active",
			budgetItemIndex: "1.1",
			costDate: new Date("2026-01-10T00:00:00.000Z"),
			amount: 200,
			costType: "CURRENT",
			category: "MATERIAL",
		},
		{
			id: "actual-future",
			budgetItemId: "item-active",
			budgetItemIndex: "1.1",
			costDate: new Date("2026-01-20T00:00:00.000Z"),
			amount: 50,
			costType: "FUTURE",
			category: "MATERIAL",
		},
	];

	it("calculates PV, EV, AC, balances, SPI and CPI from unified data", () => {
		const metrics = calculateWorkMetrics(
			unifiedWork,
			unifiedBudgetItems,
			unifiedBaselineSchedules,
			unifiedMeasurements,
			unifiedActualCosts,
		);

		expect(metrics.activeBudget).toBe(750);
		expect(metrics.ignoredBudget).toBe(100);
		expect(metrics.suspendedBudget).toBe(200);
		expect(metrics.plannedValue).toBeCloseTo(550 * (15 / 31), 8);
		expect(metrics.earnedValue).toBe(275);
		expect(metrics.actualCost).toBe(200);
		expect(metrics.currentBudgetBalance).toBe(550);
		expect(metrics.projectedBudgetBalance).toBe(500);
		expect(metrics.scheduleVariance).toBeCloseTo(275 - 550 * (15 / 31), 8);
		expect(metrics.schedulePerformanceIndex).toBeCloseTo(
			275 / (550 * (15 / 31)),
			8,
		);
		expect(metrics.idp).toBe(metrics.schedulePerformanceIndex);
		expect(metrics.costVariance).toBe(75);
		expect(metrics.costPerformanceIndex).toBe(1.375);
		expect(metrics.idc).toBe(1.375);
		expect(metrics.indicators.plannedValue.status).toBe("AVAILABLE");
		expect(metrics.indicators.plannedValue.formula).toBe(
			"sum(active item budget * baseline planned progress at dataDate)",
		);
		expect(metrics.indicators.actualCost.value).toBe(200);
		expect(metrics.dataCompleteness.hasBaselineSchedule).toBe(true);
		expect(metrics.dataCompleteness.hasMeasurements).toBe(true);
		expect(metrics.dataCompleteness.hasActualCosts).toBe(true);
	});

	it("derives earned value from monetary measurement data when percentage is missing", () => {
		const metrics = calculateWorkMetrics(
			unifiedWork,
			unifiedBudgetItems,
			unifiedBaselineSchedules,
			[
				{
					id: "measurement-money",
					budgetItemId: "item-active",
					index: "1.1",
					measurementDate: new Date("2026-01-15T00:00:00.000Z"),
					measuredPercentageAccumulated: null,
					measuredQuantityAccumulated: null,
					measuredValueAccumulated: 250,
				} satisfies MetricMeasurementInput,
			],
			[],
		);

		expect(metrics.measuredPercentage).toBeCloseTo(250 / 750, 8);
		expect(metrics.earnedValue).toBe(250);
	});

	it("keeps suspended items in active budget while also tracking suspended budget", () => {
		const metrics = calculateWorkMetrics(
			unifiedWork,
			unifiedBudgetItems,
			[],
			[],
			[],
		);

		const suspended = metrics.items.find(
			(item) => item.id === "item-suspended",
		);

		expect(metrics.activeBudget).toBe(750);
		expect(metrics.ignoredBudget).toBe(100);
		expect(metrics.suspendedBudget).toBe(200);
		expect(suspended?.activeBudget).toBe(200);
		expect(suspended?.suspendedBudget).toBe(200);
	});

	it("marks financial indicators unavailable when actual costs are absent", () => {
		const metrics = calculateWorkMetrics(
			unifiedWork,
			unifiedBudgetItems,
			unifiedBaselineSchedules,
			unifiedMeasurements,
			[],
		);

		expect(metrics.indicators.actualCost.status).toBe("UNAVAILABLE");
		expect(metrics.indicators.actualCost.value).toBeNull();
		expect(metrics.indicators.costPerformanceIndex.value).toBeNull();
		expect(metrics.indicators.costPerformanceIndex.unavailableReason).toContain(
			"Custos Realizados",
		);
		expect(metrics.costPerformanceIndex).toBeNull();
	});

	it("derives EV from measured quantity and keeps unappropriated actual and future costs", () => {
		const metrics = calculateWorkMetrics(
			unifiedWork,
			unifiedBudgetItems,
			unifiedBaselineSchedules,
			[
				{
					id: "quantity-measurement",
					budgetItemId: "item-active",
					budgetItemIndex: "1.1",
					measurementDate: new Date("2026-01-15T00:00:00.000Z"),
					measuredPercentageAccumulated: null,
					measuredQuantityAccumulated: 5,
				},
			],
			[
				...unifiedActualCosts,
				{
					id: "actual-unappropriated",
					budgetItemId: null,
					budgetItemIndex: null,
					costDate: new Date("2026-01-12T00:00:00.000Z"),
					amount: 25,
					costType: "CURRENT",
					category: "OTHER",
				},
				{
					id: "future-unappropriated",
					budgetItemId: null,
					budgetItemIndex: null,
					costDate: new Date("2026-01-22T00:00:00.000Z"),
					amount: 10,
					costType: "FUTURE",
					category: "OTHER",
				},
			],
		);

		expect(metrics.earnedValue).toBe(275);
		expect(metrics.actualCost).toBe(225);
		expect(metrics.futureCost).toBe(60);
		expect(metrics.unappropriatedActualCost).toBe(25);
		expect(metrics.unappropriatedFutureCost).toBe(10);
	});

	it("builds S-curve points with planned, measured and trend projections", () => {
		const metrics = calculateWorkMetrics(
			unifiedWork,
			unifiedBudgetItems,
			unifiedBaselineSchedules,
			unifiedMeasurements,
			unifiedActualCosts,
		);

		const curve = buildMonthlySCurve(metrics.items, new Date(metrics.dataDate));

		expect(curve[0]).toEqual(
			expect.objectContaining({
				period: "2026-01",
				measuredAccumulated: 275 / 750,
				trendProjected: 275 / 750,
			}),
		);
		expect(curve[0].plannedAccumulated).toBe(1);
	});

	it("calculates PV, EV, SV and IDP without actual cost", () => {
		const metrics = calculateWorkMetrics(
			{
				id: "w1",
				name: "Obra",
				plannedStart: new Date("2026-01-01T00:00:00.000Z"),
				plannedEnd: new Date("2026-01-10T00:00:00.000Z"),
				baseDate: new Date("2026-01-05T00:00:00.000Z"),
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				lastImportAt: new Date("2026-01-02T00:00:00.000Z"),
			},
			[
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
		);

		expect(metrics.dataDate).toBe("2026-01-05T00:00:00.000Z");
		expect(metrics.activeBudget).toBe(1000);
		expect(metrics.plannedValue).toBe(500);
		expect(metrics.earnedValue).toBe(250);
		expect(metrics.measuredPercentage).toBe(0.25);
		expect(metrics.plannedPercentage).toBe(0.5);
		expect(metrics.scheduleVariance).toBe(-250);
		expect(metrics.scheduleDifference).toBe(-0.25);
		expect(metrics.schedulePerformanceIndex).toBe(0.5);
		expect(metrics.costPerformanceIndex).toBeNull();
	});

	it("marks PV and dependent schedule indicators unavailable without usable baseline", () => {
		const metrics = calculateWorkMetrics(
			unifiedWork,
			[unifiedBudgetItems[0]],
			[
				{
					id: "baseline-unmatched",
					budgetItemId: "other-item",
					budgetItemIndex: "9.9",
					plannedStart: new Date("2026-01-01T00:00:00.000Z"),
					plannedEnd: new Date("2026-01-31T00:00:00.000Z"),
				},
				{
					id: "baseline-invalid",
					budgetItemId: "item-active",
					budgetItemIndex: "1.1",
					plannedStart: new Date("2026-01-31T00:00:00.000Z"),
					plannedEnd: new Date("2026-01-01T00:00:00.000Z"),
				},
			],
			unifiedMeasurements,
			unifiedActualCosts,
		);

		expect(metrics.dataCompleteness.hasBaselineSchedule).toBe(false);
		expect(metrics.indicators.plannedValue.status).toBe("UNAVAILABLE");
		expect(metrics.indicators.scheduleVariance.status).toBe("UNAVAILABLE");
		expect(metrics.indicators.schedulePerformanceIndex.status).toBe(
			"UNAVAILABLE",
		);
		expect(metrics.indicators.earnedValue.status).toBe("AVAILABLE");
	});

	it("marks EV and dependent schedule indicators unavailable without usable measurements", () => {
		const metrics = calculateWorkMetrics(
			unifiedWork,
			[unifiedBudgetItems[0]],
			unifiedBaselineSchedules,
			[
				{
					id: "measurement-unmatched",
					budgetItemId: "other-item",
					budgetItemIndex: "9.9",
					measurementDate: new Date("2026-01-15T00:00:00.000Z"),
					measuredPercentageAccumulated: 0.5,
					measuredQuantityAccumulated: null,
				},
				{
					id: "measurement-future-only",
					budgetItemId: "item-active",
					budgetItemIndex: "1.1",
					measurementDate: new Date("2026-01-20T00:00:00.000Z"),
					measuredPercentageAccumulated: 0.5,
					measuredQuantityAccumulated: null,
				},
			],
			unifiedActualCosts,
		);

		expect(metrics.dataCompleteness.hasMeasurements).toBe(false);
		expect(metrics.indicators.plannedValue.status).toBe("AVAILABLE");
		expect(metrics.indicators.earnedValue.status).toBe("UNAVAILABLE");
		expect(metrics.indicators.scheduleVariance.status).toBe("UNAVAILABLE");
		expect(metrics.indicators.schedulePerformanceIndex.status).toBe(
			"UNAVAILABLE",
		);
		expect(metrics.scheduleVariance).toBeNull();
		expect(metrics.schedulePerformanceIndex).toBeNull();
		expect(metrics.idp).toBeNull();
		expect(metrics.costPerformanceIndex).toBeNull();
		expect(metrics.idc).toBeNull();
		expect(metrics.indicators.costPerformanceIndex.status).toBe("UNAVAILABLE");
	});

	it("keeps top-level schedule and cost performance metrics null when measurements are missing", () => {
		const metrics = calculateWorkMetrics(
			unifiedWork,
			[unifiedBudgetItems[0]],
			unifiedBaselineSchedules,
			[],
			unifiedActualCosts,
		);

		expect(metrics.dataCompleteness.hasBaselineSchedule).toBe(true);
		expect(metrics.dataCompleteness.hasMeasurements).toBe(false);
		expect(metrics.dataCompleteness.hasActualCosts).toBe(true);
		expect(metrics.indicators.earnedValue.status).toBe("UNAVAILABLE");
		expect(metrics.indicators.scheduleVariance.status).toBe("UNAVAILABLE");
		expect(metrics.indicators.schedulePerformanceIndex.status).toBe(
			"UNAVAILABLE",
		);
		expect(metrics.indicators.costPerformanceIndex.status).toBe("UNAVAILABLE");
		expect(metrics.scheduleVariance).toBeNull();
		expect(metrics.schedulePerformanceIndex).toBeNull();
		expect(metrics.costPerformanceIndex).toBeNull();
		expect(metrics.idp).toBeNull();
		expect(metrics.idc).toBeNull();
	});

	it("does not make AC and dependent cost indicators available from current costs after data date", () => {
		const metrics = calculateWorkMetrics(
			unifiedWork,
			[unifiedBudgetItems[0]],
			unifiedBaselineSchedules,
			unifiedMeasurements,
			[
				{
					id: "actual-after-data-date",
					budgetItemId: "item-active",
					budgetItemIndex: "1.1",
					costDate: new Date("2026-01-20T00:00:00.000Z"),
					amount: 200,
					costType: "CURRENT",
					category: "MATERIAL",
				},
			],
		);

		expect(metrics.actualCost).toBe(0);
		expect(metrics.dataCompleteness.hasActualCosts).toBe(false);
		expect(metrics.indicators.actualCost.status).toBe("UNAVAILABLE");
		expect(metrics.indicators.costVariance.status).toBe("UNAVAILABLE");
		expect(metrics.indicators.costPerformanceIndex.status).toBe("UNAVAILABLE");
	});

	it("excludes ignored budget and tracks suspended budget", () => {
		const metrics = calculateWorkMetrics(
			{
				id: "w1",
				name: "Obra",
				plannedStart: null,
				plannedEnd: null,
				baseDate: jan15,
				createdAt: jan15,
				lastImportAt: null,
			},
			[
				{
					id: "a",
					parentId: null,
					index: "001",
					type: "ITEM",
					description: "Ativo",
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
					id: "i",
					parentId: null,
					index: "002",
					type: "ITEM",
					description: "Ignorado",
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
					id: "s",
					parentId: null,
					index: "003",
					type: "ITEM",
					description: "Suspenso",
					totalCost: 300,
					plannedStart: null,
					plannedEnd: null,
					actualStart: null,
					actualEnd: null,
					completionPercentage: 0,
					computedStatus: "SUSPENDED",
					sortOrder: 3,
				},
			],
		);

		expect(metrics.activeBudget).toBe(400);
		expect(metrics.ignoredBudget).toBe(200);
		expect(metrics.suspendedBudget).toBe(300);
		expect(metrics.earnedValue).toBe(50);
	});

	it("rolls up nested stage descendants recursively", () => {
		const metrics = calculateWorkMetrics(
			{
				id: "w1",
				name: "Obra",
				plannedStart: null,
				plannedEnd: null,
				baseDate: jan15,
				createdAt: jan15,
				lastImportAt: null,
			},
			[
				{
					id: "stage",
					parentId: null,
					index: "001",
					type: "STAGE",
					description: "Stage",
					totalCost: 0,
					plannedStart: null,
					plannedEnd: null,
					actualStart: null,
					actualEnd: null,
					completionPercentage: 0,
					computedStatus: "NOT_STARTED",
					sortOrder: 1,
				},
				{
					id: "sub",
					parentId: "stage",
					index: "001.01",
					type: "STAGE",
					description: "Sub",
					totalCost: 0,
					plannedStart: null,
					plannedEnd: null,
					actualStart: null,
					actualEnd: null,
					completionPercentage: 0,
					computedStatus: "NOT_STARTED",
					sortOrder: 2,
				},
				{
					id: "item",
					parentId: "sub",
					index: "001.01.01",
					type: "ITEM",
					description: "Item",
					totalCost: 1000,
					plannedStart: null,
					plannedEnd: null,
					actualStart: null,
					actualEnd: null,
					completionPercentage: 0.5,
					computedStatus: "IN_PROGRESS",
					sortOrder: 3,
				},
			],
		);

		const [stage] = buildHierarchy(metrics.items);
		const rollup = rollupNode(stage);

		expect(rollup.activeBudget).toBe(1000);
		expect(rollup.earnedValue).toBe(500);
		expect(stage.children[0].children[0].id).toBe("item");
	});

	it("calculates financial breakdown from actual costs", () => {
		const metrics = calculateWorkMetrics(
			{ ...unifiedWork, areaM2: 200 },
			unifiedBudgetItems,
			unifiedBaselineSchedules,
			unifiedMeasurements,
			[
				{
					id: "cost-1",
					budgetItemId: "item-active",
					budgetItemIndex: "1.1",
					costDate: new Date("2026-01-10T00:00:00.000Z"),
					amount: 100000,
					costType: "CURRENT",
					category: "MATERIAL",
					supplierName: "Fornecedor A",
					costGroup: "Materiais",
					paymentStatus: "PAID",
				},
				{
					id: "cost-2",
					budgetItemId: "item-active",
					budgetItemIndex: "1.1",
					costDate: new Date("2026-01-12T00:00:00.000Z"),
					amount: 50000,
					costType: "CURRENT",
					category: "SERVICO",
					supplierName: "Fornecedor B",
					costGroup: "Servicos",
					paymentStatus: "OPEN",
				},
			],
		);

		expect(metrics.financial.budgetCostPerM2).toBeCloseTo(750 / 200, 8);
		expect(metrics.financial.actualCostPerM2).toBeCloseTo(150000 / 200, 8);
		expect(metrics.financial.paidAmount).toBe(100000);
		expect(metrics.financial.openAmount).toBe(50000);
		expect(metrics.financial.bySupplier[0]).toMatchObject({
			supplierName: "Fornecedor A",
			totalAmount: 100000,
			paidAmount: 100000,
			openAmount: 0,
		});
		expect(metrics.financial.bySupplier[1]).toMatchObject({
			supplierName: "Fornecedor B",
			totalAmount: 50000,
			paidAmount: 0,
			openAmount: 50000,
		});
		expect(metrics.financial.byGroup).toHaveLength(2);
		expect(metrics.financial.byCategory).toHaveLength(2);
	});

	it("builds monthly planned S-curve without measured history", () => {
		const metrics = calculateWorkMetrics(
			{
				id: "w1",
				name: "Obra",
				plannedStart: null,
				plannedEnd: null,
				baseDate: new Date("2026-02-15T00:00:00.000Z"),
				createdAt: jan15,
				lastImportAt: null,
			},
			[
				{
					id: "i1",
					parentId: null,
					index: "001.01",
					type: "ITEM",
					description: "Jan",
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
					id: "i2",
					parentId: null,
					index: "001.02",
					type: "ITEM",
					description: "Feb",
					totalCost: 100,
					plannedStart: new Date("2026-02-01T00:00:00.000Z"),
					plannedEnd: new Date("2026-02-28T00:00:00.000Z"),
					actualStart: null,
					actualEnd: null,
					completionPercentage: 0.25,
					computedStatus: "IN_PROGRESS",
					sortOrder: 2,
				},
			],
		);

		const curve = buildMonthlySCurve(metrics.items, new Date(metrics.dataDate));

		expect(curve.map((point) => point.period)).toEqual(["2026-01", "2026-02"]);
		expect(curve[0].plannedAccumulated).toBe(0.5);
		expect(curve[0].measuredAccumulated).toBeCloseTo(0.3125, 8);
		expect(curve[0].trendProjected).toBeCloseTo(0.3125, 8);
		expect(curve[1].measuredAccumulated).toBe(0.625);
	});

	it("prefers accumulated monetary value over percentage and quantity", () => {
		const metrics = calculateWorkMetrics(
			unifiedWork,
			[unifiedBudgetItems[0]],
			unifiedBaselineSchedules,
			[
				{
					id: "measurement-precedence",
					budgetItemId: "item-active",
					budgetItemIndex: "1.1",
					measurementDate: new Date("2026-01-15T00:00:00.000Z"),
					measuredValueAccumulated: 330,
					measuredPercentageAccumulated: 0.9,
					measuredQuantityAccumulated: 9,
				},
			],
			[],
		);

		expect(metrics.items[0].completionPercentage).toBe(0.6);
		expect(metrics.earnedValue).toBe(330);
		expect(metrics.measuredPercentage).toBe(0.6);
	});

	it("uses monetary measurement before percentage and quantity", () => {
		const metrics = calculateWorkMetrics(
			unifiedWork,
			[unifiedBudgetItems[0]],
			unifiedBaselineSchedules,
			[
				{
					id: "measurement-money-precedence",
					budgetItemId: "item-active",
					measurementDate: new Date("2026-01-15T00:00:00.000Z"),
					measuredValueAccumulated: 110,
					measuredPercentageAccumulated: 0.9,
					measuredQuantityAccumulated: 9,
				} satisfies MetricMeasurementInput,
			],
			[],
		);

		expect(metrics.earnedValue).toBe(110);
		expect(metrics.measuredPercentage).toBeCloseTo(110 / 550, 8);
	});

	it("uses percentage before quantity when monetary value is missing", () => {
		const metrics = calculateWorkMetrics(
			unifiedWork,
			[unifiedBudgetItems[0]],
			unifiedBaselineSchedules,
			[
				{
					id: "measurement-percentage-precedence",
					budgetItemId: "item-active",
					measurementDate: new Date("2026-01-15T00:00:00.000Z"),
					measuredValueAccumulated: null,
					measuredPercentageAccumulated: 0.4,
					measuredQuantityAccumulated: 9,
				} satisfies MetricMeasurementInput,
			],
			[],
		);

		expect(metrics.earnedValue).toBe(220);
		expect(metrics.measuredPercentage).toBeCloseTo(0.4, 8);
	});

	it("falls back to accumulated percentage when the item has no total cost", () => {
		const metrics = calculateWorkMetrics(
			unifiedWork,
			[
				{
					...unifiedBudgetItems[0],
					totalCost: 0,
				},
			],
			unifiedBaselineSchedules,
			[
				{
					id: "measurement-percentage",
					budgetItemId: "item-active",
					budgetItemIndex: "1.1",
					measurementDate: new Date("2026-01-15T00:00:00.000Z"),
					measuredValueAccumulated: 500,
					measuredPercentageAccumulated: 0.3,
					measuredQuantityAccumulated: 9,
				},
			],
			[],
		);

		expect(metrics.items[0].completionPercentage).toBe(0.3);
		expect(metrics.earnedValue).toBe(0);
		expect(metrics.indicators.earnedValue.status).toBe("AVAILABLE");
		expect(metrics.indicators.earnedValue.value).toBe(0);
	});

	it("derives earned value from accumulated quantity when percentage is absent", () => {
		const metrics = calculateWorkMetrics(
			unifiedWork,
			[unifiedBudgetItems[0]],
			unifiedBaselineSchedules,
			[
				{
					id: "measurement-quantity",
					budgetItemId: "item-active",
					budgetItemIndex: "1.1",
					measurementDate: new Date("2026-01-15T00:00:00.000Z"),
					measuredValueAccumulated: null,
					measuredPercentageAccumulated: null,
					measuredQuantityAccumulated: 5,
				},
			],
			[],
		);

		expect(metrics.earnedValue).toBe(275);
		expect(metrics.measuredPercentage).toBe(0.5);
	});

	it("ignores accumulated quantity when the item has no quantity", () => {
		const metrics = calculateWorkMetrics(
			unifiedWork,
			[
				{
					...unifiedBudgetItems[0],
					quantity: null,
				},
			],
			unifiedBaselineSchedules,
			[
				{
					id: "measurement-quantity-no-item-quantity",
					budgetItemId: "item-active",
					budgetItemIndex: "1.1",
					measurementDate: new Date("2026-01-15T00:00:00.000Z"),
					measuredValueAccumulated: null,
					measuredPercentageAccumulated: null,
					measuredQuantityAccumulated: 2,
				},
			],
			[],
		);

		expect(metrics.earnedValue).toBe(0);
		expect(metrics.dataCompleteness.hasMeasurements).toBe(false);
		expect(metrics.indicators.earnedValue.status).toBe("UNAVAILABLE");
		expect(metrics.indicators.earnedValue.unavailableReason).toContain(
			"Medicoes",
		);
	});

	it("returns zero numerics and unavailable indicators without active items", () => {
		const metrics = calculateWorkMetrics(
			unifiedWork,
			[
				unifiedBudgetItems[1],
				{
					id: "stage-only",
					parentId: null,
					index: "2",
					type: "STAGE",
					description: "Etapa sem itens",
					totalCost: 300,
					plannedStart: null,
					plannedEnd: null,
					actualStart: null,
					actualEnd: null,
					completionPercentage: 0,
					computedStatus: "NOT_STARTED",
					sortOrder: 4,
				},
			],
			[],
			[],
			[],
		);

		expect(metrics.activeBudget).toBe(0);
		expect(metrics.ignoredBudget).toBe(100);
		expect(metrics.suspendedBudget).toBe(0);
		expect(metrics.plannedBudget).toBe(0);
		expect(metrics.earnedValue).toBe(0);
		expect(metrics.plannedValue).toBe(0);
		expect(metrics.measuredPercentage).toBe(0);
		expect(metrics.plannedPercentage).toBeNull();
		expect(metrics.scheduleVariance).toBeNull();
		expect(metrics.scheduleDifference).toBeNull();
		expect(metrics.schedulePerformanceIndex).toBeNull();
		expect(metrics.idp).toBeNull();
		expect(metrics.actualCost).toBe(0);
		expect(metrics.costVariance).toBeNull();
		expect(metrics.costPerformanceIndex).toBeNull();
		expect(metrics.idc).toBeNull();
		expect(metrics.currentBudgetBalance).toBe(0);
		expect(metrics.projectedBudgetBalance).toBe(0);
		expect(metrics.balance).toBe(0);
		expect(metrics.indicators.plannedValue.status).toBe("UNAVAILABLE");
		expect(metrics.indicators.earnedValue.status).toBe("UNAVAILABLE");
		expect(metrics.indicators.actualCost.status).toBe("UNAVAILABLE");
		expect(metrics.indicators.currentBudgetBalance.status).toBe("UNAVAILABLE");
		expect(metrics.indicators.projectedBudgetBalance.status).toBe(
			"UNAVAILABLE",
		);
		expect(metrics.indicators.scheduleVariance.status).toBe("UNAVAILABLE");
		expect(metrics.indicators.schedulePerformanceIndex.status).toBe(
			"UNAVAILABLE",
		);
		expect(metrics.indicators.costVariance.status).toBe("UNAVAILABLE");
		expect(metrics.indicators.costPerformanceIndex.status).toBe("UNAVAILABLE");
		expect(metrics.dataCompleteness.hasBaselineSchedule).toBe(false);
		expect(metrics.dataCompleteness.hasMeasurements).toBe(false);
		expect(metrics.dataCompleteness.hasActualCosts).toBe(false);
		expect(metrics.dataCompleteness.hasFutureCosts).toBe(false);
	});

	it("keeps unappropriated costs visible when the work has no active items", () => {
		const metrics = calculateWorkMetrics(
			unifiedWork,
			[],
			[],
			[],
			[
				{
					id: "actual-unappropriated-only",
					budgetItemId: null,
					budgetItemIndex: null,
					costDate: new Date("2026-01-10T00:00:00.000Z"),
					amount: 100,
					costType: "CURRENT",
					category: "OTHER",
				},
				{
					id: "future-unappropriated-only",
					budgetItemId: null,
					budgetItemIndex: null,
					costDate: new Date("2026-01-22T00:00:00.000Z"),
					amount: 50,
					costType: "FUTURE",
					category: "OTHER",
				},
			],
		);

		expect(metrics.activeBudget).toBe(0);
		expect(metrics.actualCost).toBe(100);
		expect(metrics.futureCost).toBe(50);
		expect(metrics.unappropriatedActualCost).toBe(100);
		expect(metrics.unappropriatedFutureCost).toBe(50);
		expect(metrics.currentBudgetBalance).toBe(-100);
		expect(metrics.projectedBudgetBalance).toBe(-150);
		expect(metrics.balance).toBe(-100);
		expect(metrics.costVariance).toBeNull();
		expect(metrics.costPerformanceIndex).toBeNull();
		expect(metrics.idc).toBeNull();
		expect(metrics.dataCompleteness.hasActualCosts).toBe(true);
		expect(metrics.dataCompleteness.hasFutureCosts).toBe(true);
		expect(metrics.dataCompleteness.hasUnappropriatedActualCosts).toBe(true);
		expect(metrics.dataCompleteness.hasUnappropriatedFutureCosts).toBe(true);
		expect(metrics.indicators.actualCost.status).toBe("AVAILABLE");
		expect(metrics.indicators.actualCost.value).toBe(100);
		expect(metrics.indicators.currentBudgetBalance.value).toBe(-100);
		expect(metrics.indicators.costPerformanceIndex.status).toBe("UNAVAILABLE");
	});

	it("withholds schedule indicators when no baseline exists while keeping EV and cost metrics", () => {
		const metrics = calculateWorkMetrics(
			unifiedWork,
			[
				{
					...unifiedBudgetItems[0],
					plannedStart: new Date("2026-01-01T00:00:00.000Z"),
					plannedEnd: new Date("2026-01-31T00:00:00.000Z"),
				},
			],
			[],
			unifiedMeasurements,
			unifiedActualCosts,
		);

		expect(metrics.dataCompleteness.hasBaselineSchedule).toBe(false);
		expect(metrics.dataCompleteness.hasMeasurements).toBe(true);
		expect(metrics.dataCompleteness.hasActualCosts).toBe(true);
		expect(metrics.earnedValue).toBe(275);
		expect(metrics.plannedValue).toBeCloseTo(550 * (15 / 31), 8);
		expect(metrics.plannedPercentage).toBeCloseTo(15 / 31, 8);
		expect(metrics.scheduleVariance).toBeNull();
		expect(metrics.schedulePerformanceIndex).toBeNull();
		expect(metrics.idp).toBeNull();
		expect(metrics.indicators.plannedValue.status).toBe("UNAVAILABLE");
		expect(metrics.indicators.plannedValue.unavailableReason).toContain(
			"Cronograma Original",
		);
		expect(metrics.indicators.scheduleVariance.status).toBe("UNAVAILABLE");
		expect(metrics.indicators.schedulePerformanceIndex.status).toBe(
			"UNAVAILABLE",
		);
		expect(metrics.costVariance).toBe(75);
		expect(metrics.costPerformanceIndex).toBeCloseTo(275 / 200, 8);
	});

	it("does not count costs without a cost date as actual costs", () => {
		const metrics = calculateWorkMetrics(
			unifiedWork,
			[unifiedBudgetItems[0]],
			unifiedBaselineSchedules,
			unifiedMeasurements,
			[
				{
					id: "actual-no-date",
					budgetItemId: "item-active",
					budgetItemIndex: "1.1",
					costDate: null,
					amount: 200,
					costType: "CURRENT",
					category: "MATERIAL",
				},
			],
		);

		expect(metrics.actualCost).toBe(0);
		expect(metrics.dataCompleteness.hasActualCosts).toBe(false);
		expect(metrics.indicators.actualCost.status).toBe("UNAVAILABLE");
		expect(metrics.indicators.actualCost.unavailableReason).toContain(
			"Custos Realizados",
		);
		expect(metrics.costVariance).toBeNull();
		expect(metrics.costPerformanceIndex).toBeNull();
		expect(metrics.idc).toBeNull();
		expect(metrics.currentBudgetBalance).toBe(550);
		expect(metrics.balance).toBe(275);
	});

	it("flags unappropriated actual and future costs in dataCompleteness", () => {
		const withAppropriatedOnly = calculateWorkMetrics(
			unifiedWork,
			[unifiedBudgetItems[0]],
			unifiedBaselineSchedules,
			unifiedMeasurements,
			unifiedActualCosts,
		);

		expect(
			withAppropriatedOnly.dataCompleteness.hasUnappropriatedActualCosts,
		).toBe(false);
		expect(
			withAppropriatedOnly.dataCompleteness.hasUnappropriatedFutureCosts,
		).toBe(false);

		const withUnappropriated = calculateWorkMetrics(
			unifiedWork,
			[unifiedBudgetItems[0]],
			unifiedBaselineSchedules,
			unifiedMeasurements,
			[
				...unifiedActualCosts,
				{
					id: "actual-unappropriated",
					budgetItemId: null,
					budgetItemIndex: null,
					costDate: new Date("2026-01-12T00:00:00.000Z"),
					amount: 25,
					costType: "CURRENT",
					category: "OTHER",
				},
				{
					id: "future-unappropriated",
					budgetItemId: null,
					budgetItemIndex: null,
					costDate: new Date("2026-01-22T00:00:00.000Z"),
					amount: 10,
					costType: "FUTURE",
					category: "OTHER",
				},
			],
		);

		expect(
			withUnappropriated.dataCompleteness.hasUnappropriatedActualCosts,
		).toBe(true);
		expect(
			withUnappropriated.dataCompleteness.hasUnappropriatedFutureCosts,
		).toBe(true);
		expect(withUnappropriated.unappropriatedActualCost).toBe(25);
		expect(withUnappropriated.unappropriatedFutureCost).toBe(10);
	});

	it("flags unappropriated costs even when the source amount is negative", () => {
		const metrics = calculateWorkMetrics(
			unifiedWork,
			[unifiedBudgetItems[0]],
			unifiedBaselineSchedules,
			unifiedMeasurements,
			[
				{
					id: "negative-unappropriated-current",
					budgetItemId: null,
					budgetItemIndex: null,
					costDate: new Date("2026-01-12T00:00:00.000Z"),
					amount: -15,
					costType: "CURRENT",
					category: "OTHER",
				},
				{
					id: "negative-unappropriated-future",
					budgetItemId: null,
					budgetItemIndex: null,
					costDate: new Date("2026-01-22T00:00:00.000Z"),
					amount: -20,
					costType: "FUTURE",
					category: "OTHER",
				},
			],
		);

		expect(metrics.unappropriatedActualCost).toBe(-15);
		expect(metrics.unappropriatedFutureCost).toBe(-20);
		expect(metrics.dataCompleteness.hasUnappropriatedActualCosts).toBe(true);
		expect(metrics.dataCompleteness.hasUnappropriatedFutureCosts).toBe(true);
	});

	it("produces identical output for identical input across calls", () => {
		const first = calculateWorkMetrics(
			unifiedWork,
			unifiedBudgetItems,
			unifiedBaselineSchedules,
			unifiedMeasurements,
			unifiedActualCosts,
		);
		const second = calculateWorkMetrics(
			unifiedWork,
			unifiedBudgetItems,
			unifiedBaselineSchedules,
			unifiedMeasurements,
			unifiedActualCosts,
		);

		expect(second).toEqual(first);
	});
});

describe("calculateItemMetrics", () => {
	it("calculates item budgets and values from status and progress", () => {
		const metric = calculateItemMetrics(
			{
				id: "i1",
				parentId: null,
				index: "001",
				type: "ITEM",
				description: "Item",
				totalCost: 100,
				plannedStart: new Date("2026-01-01T00:00:00.000Z"),
				plannedEnd: new Date("2026-01-10T00:00:00.000Z"),
				actualStart: null,
				actualEnd: null,
				completionPercentage: 0.25,
				computedStatus: "IN_PROGRESS",
				sortOrder: 1,
			},
			new Date("2026-01-05T00:00:00.000Z"),
		);

		expect(metric.activeBudget).toBe(100);
		expect(metric.ignoredBudget).toBe(0);
		expect(metric.suspendedBudget).toBe(0);
		expect(metric.plannedProgress).toBe(0.5);
		expect(metric.plannedValue).toBe(50);
		expect(metric.earnedValue).toBe(25);
	});
});
