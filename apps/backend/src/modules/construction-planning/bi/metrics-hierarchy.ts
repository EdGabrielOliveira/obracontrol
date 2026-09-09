import { fillMonthGaps, monthKey } from "../../../lib/month-utils";
import {
	baselineForItem,
	budgetItemMatches,
	type ItemMetric,
	type ItemMetricNode,
	inclusiveDays,
	latestMeasurementPercentage,
	type MetricBaselineScheduleInput,
	type MetricMeasurementInput,
	type StageRollup,
} from "./metrics-core";

export type SCurvePoint = {
	period: string;
	plannedAccumulated: number;
	measuredAccumulated: number | null;
	trendProjected: number | null;
};

export function buildHierarchy(items: ItemMetric[]): ItemMetricNode[] {
	const nodes = new Map<string, ItemMetricNode>();
	const roots: ItemMetricNode[] = [];

	for (const item of [...items].sort((a, b) => a.sortOrder - b.sortOrder)) {
		nodes.set(item.id, { ...item, children: [] });
	}

	for (const node of nodes.values()) {
		if (node.parentId) {
			const parent = nodes.get(node.parentId);
			if (parent) {
				parent.children.push(node);
				continue;
			}
		}

		roots.push(node);
	}

	return roots;
}

export function rollupNode(node: ItemMetricNode, depth = 0): StageRollup {
	if (depth > 50) {
		return {
			id: node.id,
			index: node.index,
			description: node.description,
			activeBudget: node.activeBudget,
			ignoredBudget: node.ignoredBudget,
			suspendedBudget: node.suspendedBudget,
			plannedBudget: node.plannedProgress == null ? 0 : node.activeBudget,
			earnedValue: node.earnedValue,
			plannedValue: node.plannedValue,
			measuredPercentage:
				node.activeBudget > 0 ? node.earnedValue / node.activeBudget : 0,
			plannedPercentage: null,
			scheduleVariance: null,
			scheduleDifference: null,
			schedulePerformanceIndex: null,
			balance: node.activeBudget - node.earnedValue,
		};
	}
	const childRollups = node.children.map((child) =>
		rollupNode(child, depth + 1),
	);
	const activeBudget = childRollups.reduce(
		(sum, child) => sum + child.activeBudget,
		node.activeBudget,
	);
	const ignoredBudget = childRollups.reduce(
		(sum, child) => sum + child.ignoredBudget,
		node.ignoredBudget,
	);
	const suspendedBudget = childRollups.reduce(
		(sum, child) => sum + child.suspendedBudget,
		node.suspendedBudget,
	);
	const plannedBudget = childRollups.reduce(
		(sum, child) => sum + child.plannedBudget,
		node.plannedProgress == null ? 0 : node.activeBudget,
	);
	const earnedValue = childRollups.reduce(
		(sum, child) => sum + child.earnedValue,
		node.earnedValue,
	);
	const plannedValue = childRollups.reduce(
		(sum, child) => sum + child.plannedValue,
		node.plannedValue,
	);
	const measuredPercentage = activeBudget > 0 ? earnedValue / activeBudget : 0;
	const plannedPercentage =
		plannedBudget > 0 ? plannedValue / plannedBudget : null;
	const scheduleVariance =
		plannedBudget > 0 ? earnedValue - plannedValue : null;
	const scheduleDifference =
		plannedPercentage == null ? null : measuredPercentage - plannedPercentage;
	const schedulePerformanceIndex =
		plannedValue > 0 ? earnedValue / plannedValue : null;

	return {
		id: node.id,
		index: node.index,
		description: node.description,
		activeBudget,
		ignoredBudget,
		suspendedBudget,
		plannedBudget,
		earnedValue,
		plannedValue,
		measuredPercentage,
		plannedPercentage,
		scheduleVariance,
		scheduleDifference,
		schedulePerformanceIndex,
		balance: activeBudget - earnedValue,
	};
}

export function buildMonthlySCurve(
	items: ItemMetric[],
	dataDate: Date,
	measurements: MetricMeasurementInput[] = [],
	baselineSchedules: MetricBaselineScheduleInput[] = [],
): SCurvePoint[] {
	const plannedItems = items.flatMap((item) => {
		if (item.activeBudget <= 0) return [];
		const baseline = baselineForItem(item, baselineSchedules);
		const plannedStart = baseline?.plannedStart ?? item.plannedStart;
		const plannedEnd = baseline?.plannedEnd ?? item.plannedEnd;
		if (!plannedStart || !plannedEnd) return [];
		const plannedWeight =
			baseline?.plannedWeight == null ? 1 : Number(baseline.plannedWeight);
		if (!Number.isFinite(plannedWeight) || plannedWeight <= 0) return [];
		return [{ item, plannedStart, plannedEnd, plannedWeight }];
	});
	const totalPlannedBudget = plannedItems.reduce(
		(sum, row) => sum + row.item.activeBudget * row.plannedWeight,
		0,
	);

	if (totalPlannedBudget === 0) return [];

	const plannedByPeriod = new Map<string, number>();
	for (const row of plannedItems) {
		const start = new Date(row.plannedStart);
		const end = new Date(row.plannedEnd);
		// Generate all months between start and end (inclusive)
		const months: string[] = [];
		const cursor = new Date(
			Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1),
		);
		const endMonth = new Date(
			Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1),
		);
		while (cursor <= endMonth) {
			months.push(monthKey(cursor));
			cursor.setUTCMonth(cursor.getUTCMonth() + 1);
		}
		if (months.length === 0) months.push(monthKey(end));
		for (const month of months) {
			const [year, monthNumber] = month.split("-").map(Number);
			const monthStart = new Date(Date.UTC(year, monthNumber - 1, 1));
			const monthEnd = new Date(
				Date.UTC(year, monthNumber, 0, 23, 59, 59, 999),
			);
			const overlapStart = new Date(
				Math.max(start.getTime(), monthStart.getTime()),
			);
			const overlapEnd = new Date(Math.min(end.getTime(), monthEnd.getTime()));
			const overlap =
				overlapStart <= overlapEnd
					? inclusiveDays(overlapStart, overlapEnd)
					: 0;
			const monthlyValue =
				(row.item.activeBudget * row.plannedWeight * overlap) /
				inclusiveDays(start, end);
			plannedByPeriod.set(
				month,
				(plannedByPeriod.get(month) ?? 0) + monthlyValue,
			);
		}
	}

	const currentPeriod = monthKey(dataDate);
	const periodKeys = [
		...new Set([...plannedByPeriod.keys(), currentPeriod]),
	].sort();
	if (periodKeys.length === 0) return [];

	const allPeriods = fillMonthGaps(periodKeys);
	const plannedActiveBudget = plannedItems.reduce(
		(sum, row) => sum + row.item.activeBudget * row.plannedWeight,
		0,
	);
	const plannedEarnedValue = plannedItems.reduce(
		(sum, row) => sum + row.item.earnedValue * row.plannedWeight,
		0,
	);
	const hasMeasurementHistory = measurements.some(
		(measurement) =>
			measurement.measurementDate != null &&
			plannedItems.some((row) => budgetItemMatches(row.item, measurement)),
	);
	const activeBudget = hasMeasurementHistory
		? plannedActiveBudget
		: items.reduce((sum, item) => sum + item.activeBudget, 0);
	const earnedValue = hasMeasurementHistory
		? plannedEarnedValue
		: items.reduce((sum, item) => sum + item.earnedValue, 0);
	const currentMeasured = activeBudget > 0 ? earnedValue / activeBudget : 0;
	let plannedAccumulatedValue = 0;
	const plannedAccumulatedByPeriod = new Map<string, number>();

	for (const period of allPeriods) {
		plannedAccumulatedValue += plannedByPeriod.get(period) ?? 0;
		plannedAccumulatedByPeriod.set(
			period,
			plannedAccumulatedValue / totalPlannedBudget,
		);
	}

	const currentPlannedAccumulated =
		plannedAccumulatedByPeriod.get(currentPeriod) ?? 0;
	const projectionRatio =
		currentPlannedAccumulated > 0
			? currentMeasured / currentPlannedAccumulated
			: 0;
	const currentIndex = allPeriods.indexOf(currentPeriod);
	const measuredByPeriod = new Map<string, number>();
	if (hasMeasurementHistory) {
		for (const period of allPeriods) {
			const [year, month] = period.split("-").map(Number);
			const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
			const periodEnd = monthEnd < dataDate ? monthEnd : dataDate;
			const measuredValue = plannedItems.reduce((sum, row) => {
				const progress = latestMeasurementPercentage(
					row.item,
					measurements,
					periodEnd,
				);
				return sum + row.item.activeBudget * row.plannedWeight * progress;
			}, 0);
			measuredByPeriod.set(
				period,
				activeBudget > 0 ? measuredValue / activeBudget : 0,
			);
		}
	}

	return allPeriods.map((period) => {
		const periodIndex = allPeriods.indexOf(period);
		const plannedAccumulated = plannedAccumulatedByPeriod.get(period) ?? 0;
		const measuredAccumulated =
			currentIndex >= 0 && periodIndex <= currentIndex
				? hasMeasurementHistory
					? (measuredByPeriod.get(period) ?? 0)
					: plannedAccumulated * projectionRatio
				: null;

		return {
			period,
			plannedAccumulated,
			measuredAccumulated,
			trendProjected: plannedAccumulated * projectionRatio,
		};
	});
}
