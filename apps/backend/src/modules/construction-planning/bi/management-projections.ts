import { roundCurrency } from "../../../lib/math-utils";
import { toFiniteNumber } from "../../../lib/number-utils";
import {
	fillPeriodGaps,
	periodBounds,
	periodKeyOf,
	type SchedulePeriod,
} from "../../../lib/period-utils";
import { workMeasurementsToMetricInputs } from "./execution-facts";
import { budgetItemMatches, inclusiveDays } from "./metrics-core";
import { buildDataQualityIssues } from "./metrics-quality";
import { normalizePercentage } from "./percent-utils";
import type { WorkMetricsSnapshot } from "./work-metrics-snapshot";

export type WorkReportIdentity = {
	work: { id: string; name: string; code: string };
	costCenter: { id: string; name: string } | null;
};

function countMeasuredItems(snapshot: WorkMetricsSnapshot): number {
	const inputMeasurements = snapshot.input.measurements ?? [];
	return snapshot.manualMeasurements.length > 0
		? snapshot.manualMeasurements.length
		: inputMeasurements.length;
}

function measuredValueForItem(
	item: WorkMetricsSnapshot["input"]["items"][number],
	measurement: NonNullable<
		WorkMetricsSnapshot["input"]["measurements"]
	>[number],
	bdiFactor: number,
) {
	const totalCost = toFiniteNumber(item.totalCost) * bdiFactor;

	if (measurement.measuredValueAccumulated != null) {
		return toFiniteNumber(measurement.measuredValueAccumulated) * bdiFactor;
	}

	if (measurement.measuredPercentageAccumulated != null) {
		return (
			totalCost *
			normalizePercentage(
				toFiniteNumber(measurement.measuredPercentageAccumulated),
			)
		);
	}

	const quantity = toFiniteNumber(item.quantity);
	if (measurement.measuredQuantityAccumulated != null && quantity > 0) {
		return (
			totalCost *
			(toFiniteNumber(measurement.measuredQuantityAccumulated) / quantity)
		);
	}

	return 0;
}

function overlapDays(
	left: Date,
	right: Date,
	periodStart: Date,
	periodEnd: Date,
): number {
	const start = new Date(Math.max(left.getTime(), periodStart.getTime()));
	const end = new Date(Math.min(right.getTime(), periodEnd.getTime()));
	return start <= end ? inclusiveDays(start, end) : 0;
}

export function projectPhysicalFinancialSchedule(
	snapshot: WorkMetricsSnapshot,
	period: SchedulePeriod = "monthly",
) {
	const budgetItems = snapshot.input.items;
	const measurements = snapshot.sourceMeasurements
		? [
				...snapshot.sourceMeasurements,
				...workMeasurementsToMetricInputs(snapshot.manualMeasurements),
			]
		: (snapshot.input.measurements ?? []);
	const baselines = snapshot.input.baselineSchedules ?? [];
	const actualCosts = snapshot.input.actualCosts ?? [];
	const bdiFactor =
		1 + Math.max(0, toFiniteNumber(snapshot.input.bdiPercentage)) / 100;
	const allMonths = new Set<string>();
	for (const date of [snapshot.input.plannedStart, snapshot.input.plannedEnd]) {
		if (date) allMonths.add(periodKeyOf(date, period));
	}

	for (const baseline of baselines) {
		if (baseline.plannedStart)
			allMonths.add(periodKeyOf(baseline.plannedStart, period));
		if (baseline.plannedEnd)
			allMonths.add(periodKeyOf(baseline.plannedEnd, period));
	}

	for (const measurement of measurements) {
		if (measurement.measurementDate) {
			allMonths.add(periodKeyOf(measurement.measurementDate, period));
		}
	}

	for (const cost of actualCosts) {
		if (cost.costDate) allMonths.add(periodKeyOf(cost.costDate, period));
	}

	const sortedMonths = fillPeriodGaps([...allMonths].sort(), period);
	const itemPlans = new Map<
		string,
		{
			item: (typeof budgetItems)[number];
			plannedStart: Date | null;
			plannedEnd: Date | null;
			weight: number;
			measuredByPeriod: Map<string, number>;
		}
	>();
	for (const item of budgetItems.filter((row) => row.type === "ITEM")) {
		const baseline = baselines.find((row) => budgetItemMatches(item, row));
		const measuredByPeriod = new Map<string, number>();
		for (const measurement of measurements) {
			if (!measurement.measurementDate) continue;
			if (!budgetItemMatches(item, measurement)) continue;
			const key = periodKeyOf(measurement.measurementDate, period);
			measuredByPeriod.set(
				key,
				(measuredByPeriod.get(key) ?? 0) +
					measuredValueForItem(item, measurement, bdiFactor),
			);
		}
		itemPlans.set(item.id, {
			item,
			plannedStart: baseline?.plannedStart ?? item.plannedStart,
			plannedEnd: baseline?.plannedEnd ?? item.plannedEnd,
			weight:
				baseline?.plannedWeight == null
					? 1
					: toFiniteNumber(baseline.plannedWeight),
			measuredByPeriod,
		});
	}

	const stageRows = budgetItems
		.filter((item) => item.type === "STAGE")
		.map((stage) => {
			const childItems = budgetItems.filter(
				(item) =>
					item.type === "ITEM" && item.index.startsWith(`${stage.index}.`),
			);
			const preparedItems = childItems
				.map((item) => itemPlans.get(item.id))
				.filter((item): item is NonNullable<typeof item> => item != null);
			const months = sortedMonths.map((month) => {
				let planned = 0;
				let measured = 0;
				const { start: periodStart, end: periodEnd } = periodBounds(
					month,
					period,
				);

				for (const prepared of preparedItems) {
					const { item, plannedStart, plannedEnd, weight } = prepared;
					if (plannedStart && plannedEnd && plannedEnd >= plannedStart) {
						if (weight > 0) {
							planned +=
								(toFiniteNumber(item.totalCost) *
									bdiFactor *
									weight *
									overlapDays(
										plannedStart,
										plannedEnd,
										periodStart,
										periodEnd,
									)) /
								inclusiveDays(plannedStart, plannedEnd);
						}
					}
					measured += prepared.measuredByPeriod.get(month) ?? 0;
				}

				return {
					month,
					planned: roundCurrency(planned),
					measured: roundCurrency(measured),
				};
			});

			return { stageName: stage.description, stageIndex: stage.index, months };
		});

	const actualByMonth = new Map<string, number>();
	for (const cost of actualCosts) {
		if (!cost.costDate) continue;
		const key = periodKeyOf(cost.costDate, period);
		actualByMonth.set(
			key,
			(actualByMonth.get(key) ?? 0) + toFiniteNumber(cost.amount),
		);
	}

	const totalsMonths = sortedMonths.map((month) => {
		const planned = stageRows.reduce(
			(sum, stage) =>
				sum + (stage.months.find((row) => row.month === month)?.planned ?? 0),
			0,
		);
		const measured = stageRows.reduce(
			(sum, stage) =>
				sum + (stage.months.find((row) => row.month === month)?.measured ?? 0),
			0,
		);

		return {
			month,
			planned: roundCurrency(planned),
			measured: roundCurrency(measured),
			actual: roundCurrency(actualByMonth.get(month) ?? 0),
		};
	});

	let plannedAcc = 0;
	let measuredAcc = 0;
	let actualAcc = 0;

	return {
		stages: stageRows.map((stage) => ({
			...stage,
			months: stage.months.map((month) => ({
				...month,
				actual: roundCurrency(actualByMonth.get(month.month) ?? 0),
			})),
		})),
		totals: {
			months: sortedMonths,
			plannedByMonth: totalsMonths.map((row) => row.planned),
			measuredByMonth: totalsMonths.map((row) => row.measured),
			actualByMonth: totalsMonths.map((row) => row.actual),
			plannedAccumulated: totalsMonths.map((row) => {
				plannedAcc += row.planned;
				return roundCurrency(plannedAcc);
			}),
			measuredAccumulated: totalsMonths.map((row) => {
				measuredAcc += row.measured;
				return roundCurrency(measuredAcc);
			}),
			actualAccumulated: totalsMonths.map((row) => {
				actualAcc += row.actual;
				return roundCurrency(actualAcc);
			}),
		},
	};
}

export function projectManagementDashboard(snapshot: WorkMetricsSnapshot) {
	const metrics = snapshot.metrics;

	return {
		budgeted: roundCurrency(metrics.activeBudget),
		spent: roundCurrency(metrics.actualCost),
		balance: roundCurrency(metrics.currentBudgetBalance),
		executionPercentage:
			metrics.activeBudget > 0
				? roundCurrency((metrics.actualCost / metrics.activeBudget) * 100)
				: 0,
		costsByCategory: metrics.financial.byCategory.map((category) => ({
			category: category.category,
			amount: roundCurrency(category.totalAmount),
			percentage: category.percentage,
		})),
		supplierBreakdown: metrics.financial.bySupplier.map((supplier) => ({
			supplierName: supplier.supplierName,
			totalAmount: roundCurrency(supplier.totalAmount),
			paidAmount: roundCurrency(supplier.paidAmount),
			openAmount: roundCurrency(supplier.openAmount),
		})),
	};
}

export function projectWorkReport(
	snapshot: WorkMetricsSnapshot,
	identity: WorkReportIdentity,
) {
	const metrics = snapshot.metrics;

	return {
		work: identity.work,
		costCenter: identity.costCenter,
		budget: {
			total: roundCurrency(metrics.activeBudget),
			itemsCount: metrics.items.length,
			byStatus: {
				active: metrics.items.filter(
					(item) => item.computedStatus === "IN_PROGRESS",
				).length,
				done: metrics.items.filter((item) => item.computedStatus === "DONE")
					.length,
				notStarted: metrics.items.filter(
					(item) => item.computedStatus === "NOT_STARTED",
				).length,
			},
		},
		measurements: {
			total: roundCurrency(metrics.earnedValue),
			count: countMeasuredItems(snapshot),
			percentage: metrics.measuredPercentage,
		},
		costs: {
			total: roundCurrency(metrics.actualCost),
			balance: roundCurrency(metrics.currentBudgetBalance),
		},
		evm: {
			plannedValue: metrics.plannedValue,
			earnedValue: metrics.earnedValue,
			actualCost: metrics.actualCost,
			scheduleVariance: metrics.scheduleVariance,
			costVariance: metrics.costVariance,
			schedulePerformanceIndex: metrics.schedulePerformanceIndex,
			costPerformanceIndex: metrics.costPerformanceIndex,
			currentBudgetBalance: metrics.currentBudgetBalance,
			projectedBudgetBalance: metrics.projectedBudgetBalance,
		},
		qualityIssues: buildDataQualityIssues(metrics, identity.work.id),
	};
}
