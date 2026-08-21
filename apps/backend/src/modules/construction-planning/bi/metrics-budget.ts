import type {
	ItemMetric,
	MetricBaselineScheduleInput,
	MetricItemInput,
	MetricMeasurementInput,
} from "./metrics-core";
import {
	baselineForItem,
	latestMeasurementPercentage,
	plannedProgressAt,
} from "./metrics-core";
import { normalizePercentage } from "./percent-utils";

export function budgetAmount(item: MetricItemInput): number {
	if (typeof item.totalBudget === "number") return item.totalBudget;
	if (Number.isFinite(item.totalCost)) return item.totalCost;

	const categoryTotal =
		(item.laborCost ?? 0) +
		(item.materialCost ?? 0) +
		(item.equipmentCost ?? 0) +
		(item.otherCost ?? 0);
	if (categoryTotal > 0) return categoryTotal;

	const unitCostTotal =
		(item.laborUnitCost ?? 0) +
		(item.materialUnitCost ?? 0) +
		(item.equipmentUnitCost ?? 0) +
		(item.otherUnitCost ?? 0);

	return unitCostTotal * (item.quantity ?? 0);
}

export function calculateItemMetrics(
	item: MetricItemInput,
	dataDate: Date,
	baselineSchedules: MetricBaselineScheduleInput[] = [],
	measurements: MetricMeasurementInput[] = [],
): ItemMetric {
	const isBudgetItem = item.type === "ITEM";
	const isIgnored = item.computedStatus === "IGNORED";
	const isSuspended = item.computedStatus === "SUSPENDED";

	const hasExternalData =
		baselineSchedules.length > 0 || measurements.length > 0;
	const budget = hasExternalData ? budgetAmount(item) : item.totalCost;
	const baseline = hasExternalData
		? baselineForItem(item, baselineSchedules)
		: null;
	const plannedStart = baseline?.plannedStart ?? item.plannedStart;
	const plannedEnd = baseline?.plannedEnd ?? item.plannedEnd;
	const isActive = isBudgetItem && !isIgnored;
	const activeBudget = isActive ? budget : 0;
	const ignoredBudget = isBudgetItem && isIgnored ? budget : 0;
	const suspendedBudget = isBudgetItem && isSuspended ? budget : 0;
	const plannedProgress = isActive
		? plannedProgressAt(dataDate, plannedStart ?? null, plannedEnd ?? null)
		: null;
	const measuredProgress =
		hasExternalData && isActive
			? latestMeasurementPercentage(item, measurements, dataDate)
			: normalizePercentage(item.completionPercentage);
	const plannedValue =
		plannedProgress == null ? 0 : activeBudget * plannedProgress;
	const earnedValue = activeBudget * measuredProgress;

	return {
		...item,
		totalCost: budget,
		plannedStart: plannedStart ?? null,
		plannedEnd: plannedEnd ?? null,
		completionPercentage: measuredProgress,
		isBudgetItem,
		isIgnored,
		isSuspended,
		plannedProgress,
		plannedValue,
		earnedValue,
		activeBudget,
		ignoredBudget,
		suspendedBudget,
	};
}
