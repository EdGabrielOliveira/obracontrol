import { describe, expect, it } from "bun:test";
import {
	projectManagementDashboard,
	projectPhysicalFinancialSchedule,
	projectWorkReport,
} from "../../../../../src/modules/construction-planning/bi/management-projections";
import type { WorkMetricsSnapshot } from "../../../../../src/modules/construction-planning/bi/work-metrics-snapshot";

const snapshot = {
	input: {
		items: [],
		baselineSchedules: [],
		measurements: [],
		actualCosts: [],
	},
	manualMeasurements: [
		{ date: new Date("2026-01-15T00:00:00.000Z"), items: [] },
	],
	metrics: {
		activeBudget: 1000,
		plannedValue: 500,
		earnedValue: 400,
		actualCost: 250,
		currentBudgetBalance: 750,
		projectedBudgetBalance: 700,
		scheduleVariance: 100,
		schedulePerformanceIndex: 1.25,
		costVariance: 150,
		costPerformanceIndex: 1.375,
		measuredPercentage: 0.4,
		items: [
			{ computedStatus: "IN_PROGRESS" },
			{ computedStatus: "DONE" },
			{ computedStatus: "NOT_STARTED" },
		],
		financial: { byCategory: [], bySupplier: [] },
		dataCompleteness: {
			hasBaselineSchedule: true,
			hasMeasurements: true,
			hasActualCosts: true,
			hasFutureCosts: false,
			hasUnappropriatedActualCosts: false,
			hasUnappropriatedFutureCosts: false,
		},
	},
} as unknown as WorkMetricsSnapshot;

describe("management projections", () => {
	it("projects dashboard and work report from the same metric values", () => {
		const dashboard = projectManagementDashboard(snapshot);
		const report = projectWorkReport(snapshot, {
			work: { id: "work-1", name: "Obra", code: "OBRA-001" },
			costCenter: { id: "cc-1", name: "CC 1" },
		});

		expect(dashboard.budgeted).toBe(report.budget.total);
		expect(dashboard.spent).toBe(report.costs.total);
		expect(dashboard.balance).toBe(report.costs.balance);
		expect(report.measurements.total).toBe(400);
		expect(report.measurements.count).toBe(1);
	});

	it("exposes the evm block with raw metric values in the work report", () => {
		const report = projectWorkReport(snapshot, {
			work: { id: "work-1", name: "Obra", code: "OBRA-001" },
			costCenter: { id: "cc-1", name: "CC 1" },
		});

		expect(report.evm).toEqual({
			plannedValue: 500,
			earnedValue: 400,
			actualCost: 250,
			scheduleVariance: 100,
			costVariance: 150,
			schedulePerformanceIndex: 1.25,
			costPerformanceIndex: 1.375,
			currentBudgetBalance: 750,
			projectedBudgetBalance: 700,
		});
		expect(report.qualityIssues).toEqual([]);
	});

	it("exposes null evm fields and completeness issues when data is missing", () => {
		const incomplete = {
			...snapshot,
			metrics: {
				...snapshot.metrics,
				plannedValue: 0,
				scheduleVariance: null,
				schedulePerformanceIndex: null,
				costVariance: null,
				costPerformanceIndex: null,
				dataCompleteness: {
					hasBaselineSchedule: false,
					hasMeasurements: false,
					hasActualCosts: false,
					hasFutureCosts: false,
					hasUnappropriatedActualCosts: false,
					hasUnappropriatedFutureCosts: false,
				},
			},
		} as unknown as WorkMetricsSnapshot;

		const report = projectWorkReport(incomplete, {
			work: { id: "work-1", name: "Obra", code: "OBRA-001" },
			costCenter: { id: "cc-1", name: "CC 1" },
		});

		expect(report.evm.scheduleVariance).toBeNull();
		expect(report.evm.costVariance).toBeNull();
		expect(report.evm.schedulePerformanceIndex).toBeNull();
		expect(report.evm.costPerformanceIndex).toBeNull();
		expect(new Set(report.qualityIssues.map((issue) => issue.code))).toEqual(
			new Set([
				"MISSING_BASELINE_SCHEDULE",
				"MISSING_MEASUREMENTS",
				"MISSING_ACTUAL_COSTS",
			]),
		);
	});

	it("projects physical-financial totals from the snapshot", () => {
		const schedule = projectPhysicalFinancialSchedule(snapshot);

		expect(schedule).toEqual({
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

	const physicalSnapshot = {
		input: {
			items: [
				{
					id: "item-1",
					type: "ITEM",
					index: "1.1",
					description: "Servico",
					totalCost: 1000,
				},
				{
					id: "stage-1",
					type: "STAGE",
					index: "1",
					description: "Etapa 1",
					totalCost: 1000,
				},
			],
			baselineSchedules: [
				{
					budgetItemId: "item-1",
					plannedStart: new Date("2026-01-05T00:00:00.000Z"),
					plannedEnd: new Date("2026-01-18T00:00:00.000Z"),
					plannedWeight: 0.5,
				},
			],
			measurements: [
				{
					budgetItemId: "item-1",
					measurementDate: new Date("2026-01-12T00:00:00.000Z"),
					measuredValueAccumulated: 400,
				},
			],
			actualCosts: [
				{
					costDate: new Date("2026-01-13T00:00:00.000Z"),
					amount: 250,
				},
			],
		},
		manualMeasurements: [],
		metrics: {
			activeBudget: 1000,
			actualCost: 250,
			currentBudgetBalance: 750,
			earnedValue: 400,
			measuredPercentage: 0.4,
			items: [],
			financial: { byCategory: [], bySupplier: [] },
		},
	} as unknown as WorkMetricsSnapshot;

	it("projects physical-financial by month by default", () => {
		const schedule = projectPhysicalFinancialSchedule(physicalSnapshot);

		expect(schedule.totals.months).toEqual(["2026-01"]);
		expect(schedule.totals.plannedByMonth).toEqual([500]);
		expect(schedule.totals.measuredByMonth).toEqual([400]);
		expect(schedule.totals.actualByMonth).toEqual([250]);
	});

	it("projects physical-financial by week of the month", () => {
		const schedule = projectPhysicalFinancialSchedule(
			physicalSnapshot,
			"weekly",
		);

		expect(schedule.totals.months).toEqual([
			"2026-01-1",
			"2026-01-2",
			"2026-01-3",
		]);
		expect(schedule.totals.plannedByMonth).toEqual([500, 500, 500]);
		expect(schedule.totals.measuredByMonth).toEqual([0, 400, 0]);
		expect(schedule.totals.actualByMonth).toEqual([0, 250, 0]);
		expect(schedule.totals.measuredAccumulated).toEqual([0, 400, 400]);
	});

	it("projects physical-financial by calendar fortnight", () => {
		const schedule = projectPhysicalFinancialSchedule(
			physicalSnapshot,
			"biweekly",
		);

		expect(schedule.totals.months).toEqual(["2026-01-1", "2026-01-2"]);
		expect(schedule.totals.plannedByMonth).toEqual([500, 500]);
		expect(schedule.totals.measuredByMonth).toEqual([400, 0]);
		expect(schedule.totals.actualByMonth).toEqual([250, 0]);
	});
});
