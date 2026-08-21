import { toNum } from "../../../lib/decimal-utils";
import {
	buildActualCostByItemKey,
	buildWorkSummary,
	type CalculationRows,
	calculateMetrics,
	collectStageRollups,
	computeWorkStatus,
	type DbBaselineScheduleInput,
	type DbItemCalculationInput,
	type DbScheduleRevisionInput,
	daysBetween,
} from "../bi/calculations";
import {
	buildHierarchy,
	type calculateWorkMetrics,
	type WorkMetricInput,
} from "../bi/metrics";
import { normalizePercentage } from "../bi/percent-utils";
import type { GanttItem, ScheduleItem, ScheduleResponse } from "../types";

function findBaseline(
	item: DbItemCalculationInput,
	baselines: DbBaselineScheduleInput[],
): DbBaselineScheduleInput | null {
	return (
		baselines.find(
			(baseline) =>
				baseline.budgetItemId === item.id || baseline.index === item.index,
		) ?? null
	);
}

function findLatestRevision(
	item: DbItemCalculationInput,
	revisions: DbScheduleRevisionInput[],
): DbScheduleRevisionInput | null {
	return (
		revisions
			.filter(
				(revision) =>
					revision.budgetItemId === item.id || revision.index === item.index,
			)
			.sort(
				(a, b) =>
					(b.revisionDate?.getTime() ?? 0) - (a.revisionDate?.getTime() ?? 0),
			)[0] ?? null
	);
}

function buildGanttItems(
	rows: CalculationRows,
	metricById: Map<
		string,
		ReturnType<typeof calculateWorkMetrics>["items"][number]
	>,
): GanttItem[] {
	return rows.items
		.filter((item) => item.type === "ITEM")
		.sort((a, b) => a.sortOrder - b.sortOrder)
		.map((item) => {
			const baseline = findBaseline(item, rows.baselineSchedules ?? []);
			const revision = findLatestRevision(item, rows.scheduleRevisions ?? []);
			const metric = metricById.get(item.id);
			const measuredPercentage = metric?.activeBudget
				? metric.earnedValue / metric.activeBudget
				: normalizePercentage(toNum(item.completionPercentage));

			return {
				id: item.id,
				itemId: item.id,
				index: item.index,
				label: item.description,
				description: item.description,
				baselineStart:
					(baseline?.plannedStart ?? item.plannedStart)?.toISOString() ?? null,
				baselineEnd:
					(baseline?.plannedEnd ?? item.plannedEnd)?.toISOString() ?? null,
				replannedStart: revision?.replannedStart?.toISOString() ?? null,
				replannedEnd: revision?.replannedEnd?.toISOString() ?? null,
				measuredPercentage,
				status: computeWorkStatus(measuredPercentage),
				revisionVersion: revision?.version ?? null,
				revisionDate: revision?.revisionDate?.toISOString() ?? null,
			};
		});
}

export function buildScheduleFromDbItems(
	work: WorkMetricInput & {
		code: string;
		clientName?: string | null;
		lastImportAt?: Date | null;
	},
	rows: CalculationRows,
): ScheduleResponse {
	const sorted = [...rows.items].sort((a, b) => a.sortOrder - b.sortOrder);
	const measurements = rows.measurements?.map((measurement) => ({
		...measurement,
		measuredPercentageAccumulated:
			measurement.measuredPercentageAccumulated != null
				? normalizePercentage(toNum(measurement.measuredPercentageAccumulated))
				: null,
	}));
	const metrics = calculateMetrics(
		work,
		measurements
			? { ...rows, items: sorted, measurements }
			: { ...rows, items: sorted },
	);
	const metricById = new Map(metrics.items.map((item) => [item.id, item]));
	const rollupById = new Map(
		collectStageRollups(
			buildHierarchy(metrics.items),
			buildActualCostByItemKey(
				rows.actualCosts ?? [],
				new Date(metrics.dataDate),
			),
		).map((stage) => [stage.stageId, stage]),
	);

	const itemMap = new Map<string, ScheduleItem>();

	const scheduleItems: ScheduleItem[] = sorted.map((item) => {
		const metric = metricById.get(item.id);
		const stageRollup = item.type === "STAGE" ? rollupById.get(item.id) : null;
		const activeBudget = stageRollup?.activeBudget ?? metric?.activeBudget ?? 0;
		const ignoredBudget =
			stageRollup?.ignoredBudget ?? metric?.ignoredBudget ?? 0;
		const suspendedBudget =
			stageRollup?.suspendedBudget ?? metric?.suspendedBudget ?? 0;
		const plannedValue = stageRollup?.plannedValue ?? metric?.plannedValue ?? 0;
		const earnedValue = stageRollup?.earnedValue ?? metric?.earnedValue ?? 0;
		const plannedPercentage =
			stageRollup?.plannedPercentage ?? metric?.plannedProgress ?? null;
		const scheduleVariance = stageRollup?.scheduleVariance ?? null;
		const schedulePerformanceIndex =
			stageRollup?.schedulePerformanceIndex ?? null;
		const completionPercentage =
			stageRollup?.measuredPercentage ??
			normalizePercentage(toNum(item.completionPercentage));
		const totalCost =
			item.type === "STAGE" ? activeBudget : toNum(item.totalCost);

		const itemBaseline = findBaseline(item, rows.baselineSchedules ?? []);
		const itemRevision = findLatestRevision(item, rows.scheduleRevisions ?? []);
		const baselineEnd =
			(itemBaseline?.plannedEnd ?? item.plannedEnd)?.toISOString() ?? null;
		const revisedEnd = itemRevision?.replannedEnd?.toISOString() ?? null;
		const baselineDuration = itemBaseline
			? daysBetween(
					itemBaseline.plannedStart ?? null,
					itemBaseline.plannedEnd ?? null,
				)
			: null;
		const deltaDays =
			baselineEnd && revisedEnd
				? Math.round(
						(new Date(revisedEnd).getTime() - new Date(baselineEnd).getTime()) /
							86_400_000,
					)
				: null;
		const deltaPercent =
			deltaDays != null && baselineDuration != null && baselineDuration > 0
				? deltaDays / baselineDuration
				: null;

		const scheduleItem: ScheduleItem = {
			id: item.id,
			parentId: item.parentId,
			index: item.index,
			type: item.type === "STAGE" ? "STAGE" : "ITEM",
			description: item.description,
			unit: item.unit ?? null,
			quantity: item.quantity != null ? toNum(item.quantity) : null,
			unitCost: item.unitCost != null ? toNum(item.unitCost) : null,
			totalCost,
			plannedStart: item.plannedStart?.toISOString() ?? null,
			plannedEnd: item.plannedEnd?.toISOString() ?? null,
			actualStart: item.actualStart?.toISOString() ?? null,
			actualEnd: item.actualEnd?.toISOString() ?? null,
			durationDays: daysBetween(item.plannedStart, item.plannedEnd),
			baselineEnd,
			revisedEnd,
			deltaDays,
			deltaPercent,
			completionPercentage,
			executedValue: earnedValue,
			activeBudget,
			ignoredBudget,
			suspendedBudget,
			plannedValue,
			earnedValue,
			plannedPercentage,
			scheduleVariance,
			schedulePerformanceIndex,
			balance: activeBudget - earnedValue,
			providedStatus: item.providedStatus ?? null,
			computedStatus:
				item.type === "STAGE"
					? computeWorkStatus(completionPercentage)
					: item.computedStatus,
			children: [],
		};

		itemMap.set(item.id, scheduleItem);
		return scheduleItem;
	});

	const roots: ScheduleItem[] = [];
	for (const item of scheduleItems) {
		if (item.parentId && itemMap.has(item.parentId)) {
			const parent = itemMap.get(item.parentId);
			if (parent) parent.children?.push(item);
		} else {
			roots.push(item);
		}
	}

	const workSummary = buildWorkSummary(work, metrics);
	const gantt = buildGanttItems(rows, metricById);

	const revisions = rows.scheduleRevisions ?? [];
	const revisedItemIds = new Set(
		revisions
			.filter((r) => r.replannedStart || r.replannedEnd)
			.map((r) => r.budgetItemId),
	);
	const latestRevisionDate = revisions.length
		? new Date(
				Math.max(...revisions.map((r) => r.revisionDate?.getTime() ?? 0)),
			).toISOString()
		: null;

	const shiftedItems = scheduleItems.filter(
		(item) => item.deltaDays != null && item.deltaDays !== 0,
	);
	const absoluteDeltas = scheduleItems.flatMap((item) =>
		item.deltaDays != null ? [Math.abs(item.deltaDays)] : [],
	);
	const revisedEndTimes = scheduleItems.flatMap((item) =>
		item.revisedEnd ? [new Date(item.revisedEnd).getTime()] : [],
	);

	return {
		work: workSummary,
		items: roots,
		gantt,
		replanning: {
			totalRevisedItems: revisedItemIds.size,
			latestRevisionDate,
			totalRevisions: revisions.length,
			itemsShifted: shiftedItems.length,
			maxDeltaDays: absoluteDeltas.length ? Math.max(...absoluteDeltas) : 0,
			revisedEndAt: revisedEndTimes.length
				? new Date(Math.max(...revisedEndTimes)).toISOString()
				: null,
		},
	};
}
