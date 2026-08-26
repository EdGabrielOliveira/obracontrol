import type { Decimal } from "@prisma/client/runtime/library";
import { toNum } from "../../../lib/decimal-utils";
import { normalizeCostType as normalizeCostTypeFromImport } from "../imports/normalizers";
import { calculateItemMetrics } from "./metrics-budget";
import { buildIndicators } from "./metrics-evm";
import {
	buildFinancialBreakdown,
	type FinancialBreakdown,
} from "./metrics-financial";
import { clampProgressRatio, normalizePercentage } from "./percent-utils";

const dayMs = 1000 * 60 * 60 * 24;

export type MetricItemInput = {
	id: string;
	parentId: string | null;
	index: string;
	type: string;
	description: string;
	quantity?: number | null;
	laborCost?: number | null;
	materialCost?: number | null;
	equipmentCost?: number | null;
	otherCost?: number | null;
	laborUnitCost?: number | null;
	materialUnitCost?: number | null;
	equipmentUnitCost?: number | null;
	otherUnitCost?: number | null;
	totalBudget?: number | null;
	totalCost: number;
	plannedStart: Date | null;
	plannedEnd: Date | null;
	actualStart: Date | null;
	actualEnd: Date | null;
	completionPercentage: number;
	computedStatus: string;
	sortOrder: number;
};

export type WorkMetricInput = {
	id: string;
	code?: string | null;
	name: string;
	costCenterId?: string | null;
	clientName?: string | null;
	plannedStart: Date | null;
	plannedEnd: Date | null;
	baseDate: Date | null;
	createdAt: Date;
	lastImportAt: Date | null;
	areaM2?: number | null;
};

export type MetricBaselineScheduleInput = {
	id?: string;
	budgetItemId?: string | null;
	budgetItemIndex?: string | null;
	index?: string | null;
	plannedStart?: Date | null;
	plannedEnd?: Date | null;
	plannedWeight?: number | Decimal | null;
};

export type MetricMeasurementInput = {
	id?: string;
	budgetItemId?: string | null;
	budgetItemIndex?: string | null;
	index?: string | null;
	measurementDate?: Date | null;
	measuredValueAccumulated?: number | Decimal | null;
	measuredPercentageAccumulated?: number | Decimal | null;
	measuredQuantityAccumulated?: number | Decimal | null;
};

export type MetricActualCostInput = {
	id?: string;
	budgetItemId?: string | null;
	budgetItemIndex?: string | null;
	budgetIndex?: string | null;
	costDate?: Date | null;
	amount: number | Decimal;
	costType?: string | null;
	category?: string | null;
	appropriationStatus?: string | null;
	supplierName?: string | null;
	costGroup?: string | null;
	paymentStatus?: string | null;
};

export type IndicatorStatus = "AVAILABLE" | "UNAVAILABLE";

export type Indicator<T> = {
	status: IndicatorStatus;
	value: T | null;
	formula: string;
	unavailableReason?: string;
};

export type DataCompleteness = {
	hasBudget: boolean;
	hasBaselineSchedule: boolean;
	hasMeasurements: boolean;
	hasActualCosts: boolean;
	hasFutureCosts: boolean;
	hasUnappropriatedActualCosts: boolean;
	hasUnappropriatedFutureCosts: boolean;
};

export type WorkMetricIndicators = {
	plannedValue: Indicator<number>;
	earnedValue: Indicator<number>;
	actualCost: Indicator<number>;
	currentBudgetBalance: Indicator<number>;
	projectedBudgetBalance: Indicator<number>;
	scheduleVariance: Indicator<number>;
	schedulePerformanceIndex: Indicator<number>;
	idp: Indicator<number>;
	costVariance: Indicator<number>;
	costPerformanceIndex: Indicator<number>;
	idc: Indicator<number>;
	bac: Indicator<number>;
	eacTypical: Indicator<number>;
	eacAtypical: Indicator<number>;
	selectedEac: Indicator<number>;
	etc: Indicator<number>;
	vac: Indicator<number>;
	tcpi: Indicator<number>;
};

export type ItemMetric = MetricItemInput & {
	isBudgetItem: boolean;
	isIgnored: boolean;
	isSuspended: boolean;
	plannedProgress: number | null;
	plannedValue: number;
	earnedValue: number;
	activeBudget: number;
	ignoredBudget: number;
	suspendedBudget: number;
};

export type WorkMetrics = {
	dataDate: string;
	activeBudget: number;
	ignoredBudget: number;
	suspendedBudget: number;
	plannedBudget: number;
	earnedValue: number;
	plannedValue: number;
	measuredPercentage: number;
	plannedPercentage: number | null;
	scheduleVariance: number | null;
	scheduleDifference: number | null;
	schedulePerformanceIndex: number | null;
	actualCost: number;
	futureCost: number;
	unappropriatedActualCost: number;
	unappropriatedFutureCost: number;
	currentBudgetBalance: number;
	projectedBudgetBalance: number;
	costVariance: number | null;
	costPerformanceIndex: number | null;
	idp: number | null;
	idc: number | null;
	balance: number;
	bac: number;
	eacTypical: number | null;
	eacAtypical: number | null;
	selectedEac: number | null;
	etc: number | null;
	vac: number | null;
	tcpi: number | null;
	indicators: WorkMetricIndicators;
	dataCompleteness: DataCompleteness;
	financial: FinancialBreakdown;
	items: ItemMetric[];
};

export type ItemMetricNode = ItemMetric & {
	children: ItemMetricNode[];
};

export type StageRollup = {
	id: string;
	index: string;
	description: string;
	activeBudget: number;
	ignoredBudget: number;
	suspendedBudget: number;
	plannedBudget: number;
	earnedValue: number;
	plannedValue: number;
	measuredPercentage: number;
	plannedPercentage: number | null;
	scheduleVariance: number | null;
	scheduleDifference: number | null;
	schedulePerformanceIndex: number | null;
	balance: number;
};

export function getDataDate(work: WorkMetricInput): Date {
	return work.baseDate ?? work.lastImportAt ?? work.createdAt;
}

function startOfUtcDay(date: Date): Date {
	return new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
	);
}

export function inclusiveDays(start: Date, end: Date): number {
	return Math.max(
		1,
		Math.floor(
			(startOfUtcDay(end).getTime() - startOfUtcDay(start).getTime()) / dayMs,
		) + 1,
	);
}

export function plannedProgressAt(
	dataDate: Date,
	start: Date | null,
	end: Date | null,
): number | null {
	if (!start || !end) return null;

	const data = startOfUtcDay(dataDate).getTime();
	const startMs = startOfUtcDay(start).getTime();
	const endMs = startOfUtcDay(end).getTime();

	if (endMs < startMs) return null;
	if (data < startMs) return 0;
	if (data >= endMs) return 1;

	return inclusiveDays(start, new Date(data)) / inclusiveDays(start, end);
}

export function available<T>(value: T, formula: string): Indicator<T> {
	return { status: "AVAILABLE", value, formula };
}

export function unavailable<T>(
	formula: string,
	unavailableReason: string,
): Indicator<T> {
	return { status: "UNAVAILABLE", value: null, formula, unavailableReason };
}

function compareDateOnly(left: Date, right: Date): number {
	return startOfUtcDay(left).getTime() - startOfUtcDay(right).getTime();
}

function matchesItem(
	item: MetricItemInput,
	row: {
		budgetItemId?: string | null;
		budgetItemIndex?: string | null;
		budgetIndex?: string | null;
		index?: string | null;
	},
): boolean {
	return (
		row.budgetItemId === item.id ||
		row.budgetItemIndex === item.index ||
		row.budgetIndex === item.index ||
		row.index === item.index
	);
}

function latestMeasurementForItem(
	item: MetricItemInput,
	measurements: MetricMeasurementInput[],
	dataDate: Date,
): MetricMeasurementInput | undefined {
	return measurements
		.filter((measurement) => {
			if (
				!measurement.measurementDate ||
				compareDateOnly(measurement.measurementDate, dataDate) > 0
			) {
				return false;
			}

			return matchesItem(item, measurement);
		})
		.sort((a, b) => {
			const left = a.measurementDate
				? startOfUtcDay(a.measurementDate).getTime()
				: 0;
			const right = b.measurementDate
				? startOfUtcDay(b.measurementDate).getTime()
				: 0;
			return right - left;
		})[0];
}

function hasUsableMeasurement(
	item: MetricItemInput,
	measurements: MetricMeasurementInput[],
	dataDate: Date,
): boolean {
	const latest = latestMeasurementForItem(item, measurements, dataDate);

	return (
		latest?.measuredValueAccumulated != null ||
		latest?.measuredPercentageAccumulated != null ||
		(latest?.measuredQuantityAccumulated != null &&
			item?.quantity != null &&
			toNum(item?.quantity) > 0)
	);
}

export function latestMeasurementPercentage(
	item: MetricItemInput,
	measurements: MetricMeasurementInput[],
	dataDate: Date,
): number {
	const latest = latestMeasurementForItem(item, measurements, dataDate);

	if (!latest) return 0;
	if (latest.measuredValueAccumulated != null && toNum(item.totalCost) > 0) {
		return clampProgressRatio(
			toNum(latest.measuredValueAccumulated) / toNum(item.totalCost),
		);
	}
	if (latest.measuredPercentageAccumulated != null) {
		return normalizePercentage(toNum(latest.measuredPercentageAccumulated));
	}

	if (
		latest.measuredQuantityAccumulated != null &&
		item.quantity != null &&
		toNum(item.quantity) > 0
	) {
		return clampProgressRatio(
			toNum(latest.measuredQuantityAccumulated) / toNum(item.quantity),
		);
	}

	return 0;
}

export function baselineForItem(
	item: MetricItemInput,
	baselineSchedules: MetricBaselineScheduleInput[],
): MetricBaselineScheduleInput | null {
	return (
		baselineSchedules.find((baseline) => matchesItem(item, baseline)) ?? null
	);
}

function hasUsableBaseline(
	item: MetricItemInput,
	baselineSchedules: MetricBaselineScheduleInput[],
	dataDate: Date,
): boolean {
	return baselineSchedules.some(
		(baseline) =>
			matchesItem(item, baseline) &&
			plannedProgressAt(
				dataDate,
				baseline.plannedStart ?? null,
				baseline.plannedEnd ?? null,
			) !== null,
	);
}

export function normalizeCostType(
	value: string | null | undefined,
): "CURRENT" | "FUTURE" {
	return normalizeCostTypeFromImport(value, "CURRENT") as "CURRENT" | "FUTURE";
}

function isUnappropriated(cost: MetricActualCostInput): boolean {
	return !(cost.budgetItemId || cost.budgetItemIndex || cost.budgetIndex);
}

export function calculateWorkMetrics(
	work: WorkMetricInput,
	items: MetricItemInput[],
	baselineSchedules: MetricBaselineScheduleInput[] = [],
	measurements: MetricMeasurementInput[] = [],
	actualCosts: MetricActualCostInput[] = [],
	asOf?: Date,
): WorkMetrics {
	const dataDate = asOf ?? getDataDate(work);
	const itemMetrics = items.map((item) =>
		calculateItemMetrics(item, dataDate, baselineSchedules, measurements),
	);
	const activeBudget = itemMetrics.reduce(
		(sum, item) => sum + item.activeBudget,
		0,
	);
	const ignoredBudget = itemMetrics.reduce(
		(sum, item) => sum + item.ignoredBudget,
		0,
	);
	const suspendedBudget = itemMetrics.reduce(
		(sum, item) => sum + item.suspendedBudget,
		0,
	);
	const plannedBudget = itemMetrics
		.filter((item) => item.plannedProgress != null)
		.reduce((sum, item) => sum + item.activeBudget, 0);
	const earnedValue = itemMetrics.reduce(
		(sum, item) => sum + item.earnedValue,
		0,
	);
	const plannedValue = itemMetrics.reduce(
		(sum, item) => sum + item.plannedValue,
		0,
	);
	const measuredPercentage = activeBudget > 0 ? earnedValue / activeBudget : 0;
	const plannedPercentage =
		plannedBudget > 0 ? plannedValue / plannedBudget : null;
	const activeItems = itemMetrics.filter(
		(item) => item.isBudgetItem && !item.isIgnored,
	);
	const hasBaselineSchedule = activeItems.some((item) =>
		hasUsableBaseline(item, baselineSchedules, dataDate),
	);
	const hasMeasurements = activeItems.some((item) =>
		hasUsableMeasurement(item, measurements, dataDate),
	);
	const hasExternalData =
		baselineSchedules.length > 0 ||
		measurements.length > 0 ||
		actualCosts.length > 0;
	const hasScheduleData =
		!hasExternalData || (hasBaselineSchedule && hasMeasurements);
	const scheduleVariance =
		plannedBudget > 0 && hasScheduleData ? earnedValue - plannedValue : null;
	const scheduleDifference =
		plannedPercentage == null ? null : measuredPercentage - plannedPercentage;
	const schedulePerformanceIndex =
		plannedValue > 0 && hasScheduleData ? earnedValue / plannedValue : null;
	const currentCosts = actualCosts.filter(
		(cost) =>
			normalizeCostType(cost.costType) === "CURRENT" &&
			cost.costDate != null &&
			compareDateOnly(cost.costDate, dataDate) <= 0,
	);
	const futureCosts = actualCosts.filter(
		(cost) => normalizeCostType(cost.costType) === "FUTURE",
	);
	const actualCost = currentCosts.reduce(
		(sum, cost) => sum + toNum(cost.amount),
		0,
	);
	const futureCost = futureCosts.reduce(
		(sum, cost) => sum + toNum(cost.amount),
		0,
	);
	const unappropriatedActualCost = currentCosts
		.filter(isUnappropriated)
		.reduce((sum, cost) => sum + toNum(cost.amount), 0);
	const unappropriatedFutureCost = futureCosts
		.filter(isUnappropriated)
		.reduce((sum, cost) => sum + toNum(cost.amount), 0);
	const currentBudgetBalance = activeBudget - actualCost;
	const projectedBudgetBalance = activeBudget - actualCost - futureCost;
	const hasActualCosts = currentCosts.length > 0;
	const costVariance =
		hasMeasurements && hasActualCosts ? earnedValue - actualCost : null;
	const costPerformanceIndex =
		hasMeasurements && hasActualCosts && actualCost > 0
			? earnedValue / actualCost
			: null;
	const bac = activeBudget;
	const eacTypical =
		costPerformanceIndex != null && costPerformanceIndex > 0
			? bac / costPerformanceIndex
			: null;
	const eacAtypical =
		costPerformanceIndex != null && costPerformanceIndex > 0
			? actualCost + (bac - earnedValue) / costPerformanceIndex
			: null;
	const selectedEac = eacTypical;
	const etc = selectedEac != null ? selectedEac - actualCost : null;
	const vac = selectedEac != null ? bac - selectedEac : null;
	const tcpi =
		bac - actualCost !== 0 ? (bac - earnedValue) / (bac - actualCost) : null;
	const dataCompleteness: DataCompleteness = {
		hasBudget: activeItems.length > 0,
		hasBaselineSchedule,
		hasMeasurements,
		hasActualCosts,
		hasFutureCosts: futureCosts.length > 0,
		hasUnappropriatedActualCosts: currentCosts.some(isUnappropriated),
		hasUnappropriatedFutureCosts: futureCosts.some(isUnappropriated),
	};
	const indicators = buildIndicators({
		plannedValue,
		earnedValue,
		actualCost,
		currentBudgetBalance,
		projectedBudgetBalance,
		scheduleVariance,
		schedulePerformanceIndex,
		costVariance,
		costPerformanceIndex,
		bac,
		eacTypical,
		eacAtypical,
		selectedEac,
		etc,
		vac,
		tcpi,
		dataCompleteness,
	});

	const financial = buildFinancialBreakdown(
		currentCosts,
		activeBudget,
		actualCost,
		work.areaM2 ?? null,
	);

	return {
		dataDate: dataDate.toISOString(),
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
		actualCost,
		futureCost,
		unappropriatedActualCost,
		unappropriatedFutureCost,
		currentBudgetBalance,
		projectedBudgetBalance,
		costVariance,
		costPerformanceIndex,
		idp: schedulePerformanceIndex,
		idc: costPerformanceIndex,
		balance: hasActualCosts ? currentBudgetBalance : activeBudget - earnedValue,
		bac,
		eacTypical,
		eacAtypical,
		selectedEac,
		etc,
		vac,
		tcpi,
		indicators,
		dataCompleteness,
		financial,
		items: itemMetrics,
	};
}
