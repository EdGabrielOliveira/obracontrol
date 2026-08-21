import { fillMonthGaps, monthKey } from "../../../lib/month-utils";
import type { ItemMetric, ItemMetricNode, StageRollup } from "./metrics-core";

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
): SCurvePoint[] {
	const plannedItems = items.filter(
		(item) => item.activeBudget > 0 && item.plannedEnd,
	);
	const totalPlannedBudget = plannedItems.reduce(
		(sum, item) => sum + item.activeBudget,
		0,
	);

	if (totalPlannedBudget === 0) return [];

	const plannedByPeriod = new Map<string, number>();
	for (const item of plannedItems) {
		const period = monthKey(item.plannedEnd as Date);
		plannedByPeriod.set(
			period,
			(plannedByPeriod.get(period) ?? 0) + item.activeBudget,
		);
	}

	const currentPeriod = monthKey(dataDate);
	const periodKeys = [
		...new Set([...plannedByPeriod.keys(), currentPeriod]),
	].sort();
	if (periodKeys.length === 0) return [];

	const allPeriods = fillMonthGaps(periodKeys);
	const activeBudget = items.reduce((sum, item) => sum + item.activeBudget, 0);
	const earnedValue = items.reduce((sum, item) => sum + item.earnedValue, 0);
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

	return allPeriods.map((period) => {
		const periodIndex = allPeriods.indexOf(period);
		const plannedAccumulated = plannedAccumulatedByPeriod.get(period) ?? 0;
		const measuredAccumulated =
			currentIndex >= 0 && periodIndex <= currentIndex
				? plannedAccumulated * projectionRatio
				: null;

		return {
			period,
			plannedAccumulated,
			measuredAccumulated,
			trendProjected: plannedAccumulated * projectionRatio,
		};
	});
}
