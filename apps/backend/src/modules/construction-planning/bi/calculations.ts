import type { Decimal } from "@prisma/client/runtime/library";
import { toNum } from "../../../lib/decimal-utils";
import { deriveWorkIdentity } from "../identity";
import type {
	CostByStage,
	CostRisk,
	ScheduleRisk,
	WorkSummary,
} from "../types";
import {
	calculateWorkMetrics,
	type ItemMetricNode,
	type MetricActualCostInput,
	type MetricBaselineScheduleInput,
	type MetricItemInput,
	type MetricMeasurementInput,
	normalizeCostType,
	rollupNode,
	type WorkMetricInput,
} from "./metrics";
import { normalizePercentage } from "./percent-utils";

export type DbItemCalculationInput = {
	id: string;
	parentId: string | null;
	index: string;
	type: string;
	description: string;
	unit?: string | null;
	quantity?: number | Decimal | null;
	unitCost?: number | Decimal | null;
	laborUnitCost?: number | Decimal | null;
	materialUnitCost?: number | Decimal | null;
	equipmentUnitCost?: number | Decimal | null;
	otherUnitCost?: number | Decimal | null;
	totalBudget?: number | Decimal | null;
	totalCost: number | Decimal;
	plannedStart: Date | null;
	plannedEnd: Date | null;
	actualStart: Date | null;
	actualEnd: Date | null;
	completionPercentage: number | Decimal;
	computedStatus: string;
	providedStatus?: string | null;
	sortOrder: number;
};

export type DbBaselineScheduleInput = MetricBaselineScheduleInput & {
	index?: string | null;
	plannedWeight?: number | Decimal | null;
};

export type DbScheduleRevisionInput = {
	id?: string;
	budgetItemId?: string | null;
	index?: string | null;
	version?: string | null;
	replannedStart?: Date | null;
	replannedEnd?: Date | null;
	revisionDate?: Date | null;
};

export type DbMeasurementInput = MetricMeasurementInput & {
	index?: string | null;
	measuredPercentageAccumulated?: number | Decimal | null;
	measuredQuantityAccumulated?: number | Decimal | null;
};

export type DbActualCostAllocationInput = {
	budgetItemId: string;
	percentage: number | Decimal;
	value: number | Decimal;
};

export type DbActualCostInput = MetricActualCostInput & {
	importId?: string | null;
	budgetIndex?: string | null;
	amount: number | Decimal;
	allocations?: DbActualCostAllocationInput[];
};

export type CalculationRows = {
	items: DbItemCalculationInput[];
	baselineSchedules?: DbBaselineScheduleInput[];
	scheduleRevisions?: DbScheduleRevisionInput[];
	measurements?: DbMeasurementInput[];
	actualCosts?: DbActualCostInput[];
};

export type WorkMetricCalculationResult = ReturnType<
	typeof calculateWorkMetrics
>;

export type WorkForBIInput = {
	id: string;
	code: string;
	name: string;
	costCenterId?: string | null;
	clientName: string | null;
	operationalStatus?: string | null;
	plannedStart: Date | null;
	plannedEnd: Date | null;
	baseDate: Date | null;
	createdAt: Date;
	imports: Array<{ createdAt: Date }>;
	items: DbItemCalculationInput[];
	baselineSchedules: DbBaselineScheduleInput[];
	scheduleRevisions: DbScheduleRevisionInput[];
	measurements: DbMeasurementInput[];
	actualCosts: DbActualCostInput[];
};

export function toWorkWithMetricsInput(
	work: WorkForBIInput,
): WorkMetricInput & CalculationRows {
	const identity = deriveWorkIdentity({
		code: work.code,
		name: work.name,
		baseDate: work.baseDate,
	});
	return {
		id: work.id,
		code: identity.code,
		name: identity.name,
		costCenterId: work.costCenterId ?? null,
		clientName: work.clientName ?? null,
		operationalStatus: work.operationalStatus ?? null,
		plannedStart: work.plannedStart ?? null,
		plannedEnd: work.plannedEnd ?? null,
		baseDate: identity.baseDate,
		createdAt: work.createdAt,
		lastImportAt: work.imports[0]?.createdAt ?? null,
		items: work.items.map((item) => toMetricItem(item)),
		baselineSchedules: work.baselineSchedules,
		scheduleRevisions: work.scheduleRevisions,
		measurements: work.measurements.map((measurement) => ({
			...measurement,
			measuredPercentageAccumulated:
				measurement.measuredPercentageAccumulated != null
					? normalizePercentage(
							toNum(measurement.measuredPercentageAccumulated),
						)
					: null,
		})),
		actualCosts: work.actualCosts,
	};
}

export function toMetricItem(item: DbItemCalculationInput): MetricItemInput {
	return {
		id: item.id,
		parentId: item.parentId,
		index: item.index,
		type: item.type,
		description: item.description,
		quantity: item.quantity != null ? toNum(item.quantity) : undefined,
		laborUnitCost:
			item.laborUnitCost != null ? toNum(item.laborUnitCost) : undefined,
		materialUnitCost:
			item.materialUnitCost != null ? toNum(item.materialUnitCost) : undefined,
		equipmentUnitCost:
			item.equipmentUnitCost != null
				? toNum(item.equipmentUnitCost)
				: undefined,
		otherUnitCost:
			item.otherUnitCost != null ? toNum(item.otherUnitCost) : undefined,
		totalBudget: item.totalBudget != null ? toNum(item.totalBudget) : undefined,
		totalCost: toNum(item.totalCost),
		plannedStart: item.plannedStart,
		plannedEnd: item.plannedEnd,
		actualStart: item.actualStart,
		actualEnd: item.actualEnd,
		completionPercentage: toNum(item.completionPercentage),
		computedStatus: item.computedStatus,
		sortOrder: item.sortOrder,
	};
}

export function isCurrentCost(
	cost: DbActualCostInput,
	dataDate: Date,
): boolean {
	return (
		normalizeCostType(cost.costType) === "CURRENT" &&
		cost.costDate != null &&
		cost.costDate.getTime() <= dataDate.getTime()
	);
}

export function buildActualCostByItemKey(
	actualCosts: DbActualCostInput[],
	dataDate: Date,
) {
	const totals = new Map<string, number>();

	for (const cost of actualCosts) {
		if (!isCurrentCost(cost, dataDate)) continue;

		if (cost.allocations && cost.allocations.length > 0) {
			for (const alloc of cost.allocations) {
				const key = `id:${alloc.budgetItemId}`;
				totals.set(key, (totals.get(key) ?? 0) + toNum(alloc.value));
			}
			continue;
		}

		const key =
			cost.importId === null && cost.budgetIndex
				? `index:${cost.budgetIndex}`
				: cost.budgetItemId
					? `id:${cost.budgetItemId}`
					: cost.budgetIndex
						? `index:${cost.budgetIndex}`
						: null;

		if (key) totals.set(key, (totals.get(key) ?? 0) + toNum(cost.amount));
	}

	return totals;
}

export function actualCostForNode(
	node: ItemMetricNode,
	costsByKey: Map<string, number>,
): number {
	const own =
		(costsByKey.get(`id:${node.id}`) ?? 0) +
		(costsByKey.get(`index:${node.index}`) ?? 0);
	return (
		own +
		node.children.reduce(
			(sum, child) => sum + actualCostForNode(child, costsByKey),
			0,
		)
	);
}

export function collectStageRollups(
	nodes: ItemMetricNode[],
	costsByKey: Map<string, number> = new Map(),
): CostByStage[] {
	const rows: CostByStage[] = [];

	for (const node of nodes) {
		if (node.type === "STAGE") {
			const rollup = rollupNode(node);
			const actualCost = actualCostForNode(node, costsByKey);
			rows.push({
				stageId: rollup.id,
				stageIndex: rollup.index,
				stageName: rollup.description,
				budget: rollup.activeBudget,
				executedValue: rollup.earnedValue,
				measuredPercentage: rollup.measuredPercentage,
				activeBudget: rollup.activeBudget,
				ignoredBudget: rollup.ignoredBudget,
				suspendedBudget: rollup.suspendedBudget,
				plannedValue: rollup.plannedValue,
				plannedPercentage: rollup.plannedPercentage,
				earnedValue: rollup.earnedValue,
				actualCost,
				scheduleVariance: rollup.scheduleVariance,
				schedulePerformanceIndex: rollup.schedulePerformanceIndex,
				costPerformanceIndex:
					actualCost > 0 ? rollup.earnedValue / actualCost : null,
				estimatedExecutedCost: actualCost > 0 ? actualCost : null,
				variation: actualCost > 0 ? rollup.earnedValue - actualCost : null,
				balance:
					actualCost > 0 ? rollup.activeBudget - actualCost : rollup.balance,
			});
		}

		rows.push(...collectStageRollups(node.children, costsByKey));
	}

	return rows;
}

export function daysBetween(
	start: Date | null,
	end: Date | null,
): number | null {
	if (!start || !end) return null;
	const ms = end.getTime() - start.getTime();
	return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}

export function computeWorkStatus(
	measuredPercentage: number,
): "DONE" | "IN_PROGRESS" | "NOT_STARTED" {
	if (measuredPercentage >= 1) return "DONE";
	if (measuredPercentage > 0) return "IN_PROGRESS";
	return "NOT_STARTED";
}

export function getScheduleRisk(spi: number | null): ScheduleRisk {
	if (spi == null) return "UNAVAILABLE";
	if (spi > 1) return "AHEAD";
	if (spi < 1) return "BEHIND";
	return "ON_TRACK";
}

export function getCostRisk(cpi: number | null): CostRisk {
	if (cpi == null) return "UNAVAILABLE";
	if (cpi > 1) return "BELOW_COST";
	if (cpi < 1) return "OVER_COST";
	return "ON_COST";
}

export function calculateMetrics(
	work: WorkMetricInput,
	rows: CalculationRows,
	asOf?: Date,
) {
	const items = rows.items.map(toMetricItem);

	return calculateWorkMetrics(
		work,
		items,
		rows.baselineSchedules,
		rows.measurements,
		rows.actualCosts,
		asOf,
	);
}

export function buildWorkSummary(
	work: WorkMetricInput,
	metrics: WorkMetricCalculationResult,
): WorkSummary {
	return {
		id: work.id,
		code: work.code ?? work.id,
		name: work.name,
		costCenterId: work.costCenterId ?? null,
		clientName: work.clientName ?? null,
		plannedStart: work.plannedStart?.toISOString() ?? null,
		plannedEnd: work.plannedEnd?.toISOString() ?? null,
		baseDate: work.baseDate?.toISOString() ?? null,
		totalBudget: metrics.activeBudget,
		activeBudget: metrics.activeBudget,
		ignoredBudget: metrics.ignoredBudget,
		suspendedBudget: metrics.suspendedBudget,
		plannedValue: metrics.plannedValue,
		earnedValue: metrics.earnedValue,
		actualCost: metrics.actualCost,
		futureCost: metrics.futureCost,
		measuredPercentage: metrics.measuredPercentage,
		plannedPercentage: metrics.plannedPercentage,
		scheduleVariance: metrics.scheduleVariance,
		schedulePerformanceIndex: metrics.schedulePerformanceIndex,
		costVariance: metrics.costVariance,
		costPerformanceIndex: metrics.costPerformanceIndex,
		currentBudgetBalance: metrics.currentBudgetBalance,
		projectedBudgetBalance: metrics.projectedBudgetBalance,
		balance: metrics.balance,
		dataCompleteness: metrics.dataCompleteness,
		computedStatus: computeWorkStatus(metrics.measuredPercentage),
		lastImportAt: (work.lastImportAt ?? work.createdAt).toISOString(),
		scheduleRisk: getScheduleRisk(metrics.schedulePerformanceIndex),
		costRisk: getCostRisk(metrics.costPerformanceIndex),
	};
}

export function elapsedDaysAt(
	plannedStart: Date | null,
	dataDate: Date,
): number | null {
	if (!plannedStart) return null;
	if (dataDate < plannedStart) return 0;
	return daysBetween(plannedStart, dataDate);
}

export function remainingDaysAt(
	plannedEnd: Date | null,
	dataDate: Date,
): number | null {
	if (!plannedEnd) return null;
	if (dataDate > plannedEnd) return 0;
	return daysBetween(dataDate, plannedEnd);
}
