import type {
	CostByWork,
	MultiworksBIRankings,
	MultiworksBIResponse,
	PortfolioWorkSummary,
	RankingItem,
	ScheduleByWork,
} from "../types";
import {
	type CalculationRows,
	calculateMetrics,
	remainingDaysAt,
	type WorkMetricCalculationResult,
} from "./calculations";
import type { calculateWorkMetrics, WorkMetricInput } from "./metrics";
import { buildAbcAnalysis } from "./metrics-financial";
import { buildDataQualityIssues } from "./metrics-quality";

function aggregateCostsByWork(
	workMetrics: Array<{
		work: WorkMetricInput;
		metrics: ReturnType<typeof calculateWorkMetrics>;
	}>,
): CostByWork[] {
	return workMetrics.map(({ work, metrics }) => ({
		workId: work.id,
		name: work.name,
		budget: metrics.activeBudget,
		executedValue: metrics.earnedValue,
		measuredPercentage: metrics.measuredPercentage,
		plannedPercentage: metrics.plannedPercentage,
		activeBudget: metrics.activeBudget,
		ignoredBudget: metrics.ignoredBudget,
		suspendedBudget: metrics.suspendedBudget,
		plannedValue: metrics.plannedValue,
		earnedValue: metrics.earnedValue,
		actualCost: metrics.actualCost,
		futureCost: metrics.futureCost,
		scheduleVariance: metrics.scheduleVariance,
		schedulePerformanceIndex: metrics.schedulePerformanceIndex,
		costPerformanceIndex: metrics.costPerformanceIndex,
		costVariance: metrics.costVariance,
		currentBudgetBalance: metrics.currentBudgetBalance,
		projectedBudgetBalance: metrics.projectedBudgetBalance,
		balance: metrics.balance,
		bac: metrics.bac,
		eacTypical: metrics.eacTypical,
		eacAtypical: metrics.eacAtypical,
		selectedEac: metrics.selectedEac,
		etc: metrics.etc,
		vac: metrics.vac,
		tcpi: metrics.tcpi,
		dataCompleteness: metrics.dataCompleteness,
	}));
}

function aggregateScheduleByWork(
	workMetrics: Array<{
		work: WorkMetricInput;
		metrics: ReturnType<typeof calculateWorkMetrics>;
	}>,
): ScheduleByWork[] {
	return workMetrics.map(({ work, metrics }) => {
		const dataDate = new Date(metrics.dataDate);
		const daysRemaining = work.plannedEnd
			? remainingDaysAt(work.plannedEnd, dataDate)
			: null;

		return {
			workId: work.id,
			name: work.name,
			plannedStart: work.plannedStart?.toISOString() ?? null,
			plannedEnd: work.plannedEnd?.toISOString() ?? null,
			daysRemaining,
			plannedPercentage: metrics.plannedPercentage,
			measuredPercentage: metrics.measuredPercentage,
			scheduleVariation: metrics.scheduleDifference,
			scheduleVariance: metrics.scheduleVariance,
			schedulePerformanceIndex: metrics.schedulePerformanceIndex,
			worksWithoutPlanning: metrics.plannedPercentage == null,
		};
	});
}

function aggregateTotals(
	costsByWork: CostByWork[],
	workMetrics: Array<{ metrics: ReturnType<typeof calculateWorkMetrics> }>,
) {
	const totals = costsByWork.reduce(
		(acc, w) => {
			acc.totalActiveBudget += w.activeBudget;
			acc.totalEarnedValue += w.earnedValue;
			acc.totalPlannedValue += w.plannedValue;
			acc.totalActualCost += w.actualCost;
			acc.totalCurrentBudgetBalance += w.currentBudgetBalance;
			acc.totalProjectedBudgetBalance += w.projectedBudgetBalance;
			acc.totalBudgetBalance += w.balance;
			acc.totalBac += w.bac;
			if (w.measuredPercentage > 0) acc.worksWithProgress++;
			return acc;
		},
		{
			totalActiveBudget: 0,
			totalEarnedValue: 0,
			totalPlannedValue: 0,
			totalActualCost: 0,
			totalCurrentBudgetBalance: 0,
			totalProjectedBudgetBalance: 0,
			totalBudgetBalance: 0,
			totalBac: 0,
			worksWithProgress: 0,
		},
	);

	const hasAnyActualCosts = workMetrics.some(
		({ metrics }) => metrics.dataCompleteness.hasActualCosts,
	);
	const worksBelowCost = hasAnyActualCosts
		? costsByWork.filter((w) => (w.costPerformanceIndex ?? 0) >= 1).length
		: null;
	const worksAboveCost = hasAnyActualCosts
		? costsByWork.filter(
				(w) => w.costPerformanceIndex != null && w.costPerformanceIndex < 1,
			).length
		: null;

	return {
		...totals,
		worksBelowCost,
		worksAboveCost,
		totalEacTypical: sumAvailable(costsByWork.map((work) => work.eacTypical)),
		totalEacAtypical: sumAvailable(costsByWork.map((work) => work.eacAtypical)),
		totalEtc: sumAvailable(costsByWork.map((work) => work.etc)),
		totalVac: sumAvailable(costsByWork.map((work) => work.vac)),
	};
}

function aggregateDataCompleteness(
	workMetrics: Array<{ metrics: ReturnType<typeof calculateWorkMetrics> }>,
) {
	return workMetrics.reduce(
		(acc, { metrics }) => ({
			hasBudget: acc.hasBudget || metrics.dataCompleteness.hasBudget,
			hasBaselineSchedule:
				acc.hasBaselineSchedule || metrics.dataCompleteness.hasBaselineSchedule,
			hasMeasurements:
				acc.hasMeasurements || metrics.dataCompleteness.hasMeasurements,
			hasActualCosts:
				acc.hasActualCosts || metrics.dataCompleteness.hasActualCosts,
			hasFutureCosts:
				acc.hasFutureCosts || metrics.dataCompleteness.hasFutureCosts,
			hasUnappropriatedActualCosts:
				acc.hasUnappropriatedActualCosts ||
				metrics.dataCompleteness.hasUnappropriatedActualCosts,
			hasUnappropriatedFutureCosts:
				acc.hasUnappropriatedFutureCosts ||
				metrics.dataCompleteness.hasUnappropriatedFutureCosts,
		}),
		{
			hasBudget: false,
			hasBaselineSchedule: false,
			hasMeasurements: false,
			hasActualCosts: false,
			hasFutureCosts: false,
			hasUnappropriatedActualCosts: false,
			hasUnappropriatedFutureCosts: false,
		},
	);
}

function buildRanking<T extends { workId: string; name: string }>(
	items: T[],
	accessor: (item: T) => number | null,
): RankingItem[] {
	return items
		.map((item) => ({
			workId: item.workId,
			name: item.name,
			value: accessor(item),
		}))
		.filter((item) => item.value != null)
		.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
}

function sumAvailable(values: Array<number | null>): number | null {
	const availableValues = values.filter(
		(value): value is number => value != null,
	);
	return availableValues.length === 0
		? null
		: availableValues.reduce((sum, value) => sum + value, 0);
}

function aggregateSupplierFinancials(
	workMetrics: Array<{ metrics: ReturnType<typeof calculateWorkMetrics> }>,
) {
	const totalPaid = workMetrics.reduce(
		(sum, w) => sum + w.metrics.financial.paidAmount,
		0,
	);
	const totalOpen = workMetrics.reduce(
		(sum, w) => sum + w.metrics.financial.openAmount,
		0,
	);
	const allSuppliers = new Map<
		string,
		{ total: number; paid: number; open: number }
	>();
	for (const w of workMetrics) {
		for (const s of w.metrics.financial.bySupplier) {
			const entry = allSuppliers.get(s.supplierName) ?? {
				total: 0,
				paid: 0,
				open: 0,
			};
			entry.total += s.totalAmount;
			entry.paid += s.paidAmount;
			entry.open += s.openAmount;
			allSuppliers.set(s.supplierName, entry);
		}
	}
	const totalCurrentCost = totalPaid + totalOpen;
	const aggregatedBySupplier = [...allSuppliers.entries()]
		.map(([supplierName, data]) => ({
			supplierName,
			totalAmount: data.total,
			paidAmount: data.paid,
			openAmount: data.open,
			percentage: totalCurrentCost > 0 ? data.total / totalCurrentCost : 0,
		}))
		.sort((a, b) => b.totalAmount - a.totalAmount);

	return {
		totalPaid,
		totalOpen,
		aggregatedBySupplier,
		abcBySupplier: buildAbcAnalysis(aggregatedBySupplier, totalCurrentCost),
	};
}

function buildRankings(
	worksSummary: PortfolioWorkSummary[],
): MultiworksBIRankings {
	return {
		costPerformance: buildRanking(worksSummary, (w) => w.costPerformanceIndex),
		schedulePerformance: buildRanking(
			worksSummary,
			(w) => w.schedulePerformanceIndex,
		),
		budgetBalance: buildRanking(worksSummary, (w) => w.currentBudgetBalance),
	};
}

export function buildMultiworksBI(
	works: Array<WorkMetricInput & CalculationRows>,
): MultiworksBIResponse {
	return buildMultiworksBIFromMetrics(
		works.map((work) => ({ work, metrics: calculateMetrics(work, work) })),
	);
}

export function buildMultiworksBIFromMetrics(
	workMetrics: Array<{
		work: WorkMetricInput;
		metrics: WorkMetricCalculationResult;
	}>,
): MultiworksBIResponse {
	const costsByWork = aggregateCostsByWork(workMetrics);
	const scheduleByWork = aggregateScheduleByWork(workMetrics);
	const totals = aggregateTotals(costsByWork, workMetrics);
	const dataCompleteness = aggregateDataCompleteness(workMetrics);
	const { totalPaid, totalOpen, aggregatedBySupplier, abcBySupplier } =
		aggregateSupplierFinancials(workMetrics);
	const worksWithoutPlanning = scheduleByWork.filter(
		(w) => w.worksWithoutPlanning,
	).length;
	const worksAheadSchedule = scheduleByWork.filter(
		(w) => (w.scheduleVariance ?? 0) > 0,
	).length;
	const worksBehindSchedule = scheduleByWork.filter(
		(w) => (w.scheduleVariance ?? 0) < 0,
	).length;

	const worksSummary: PortfolioWorkSummary[] = workMetrics.map(
		({ work, metrics }) => ({
			workId: work.id,
			costCenterId: work.costCenterId ?? null,
			name: work.name,
			clientName: work.clientName ?? null,
			activeBudget: metrics.activeBudget,
			plannedValue: metrics.plannedValue,
			earnedValue: metrics.earnedValue,
			actualCost: metrics.actualCost,
			measuredPercentage: metrics.measuredPercentage,
			plannedPercentage: metrics.plannedPercentage,
			schedulePerformanceIndex: metrics.schedulePerformanceIndex,
			costPerformanceIndex: metrics.costPerformanceIndex,
			bac: metrics.bac,
			eacTypical: metrics.eacTypical,
			eacAtypical: metrics.eacAtypical,
			selectedEac: metrics.selectedEac,
			etc: metrics.etc,
			vac: metrics.vac,
			tcpi: metrics.tcpi,
			currentBudgetBalance: metrics.currentBudgetBalance,
			projectedBudgetBalance: metrics.projectedBudgetBalance,
			dataCompleteness: metrics.dataCompleteness,
			qualityIssues: buildDataQualityIssues(metrics, work.id),
		}),
	);
	const qualityIssues = workMetrics.flatMap(({ work, metrics }) =>
		buildDataQualityIssues(metrics, work.id),
	);

	return {
		cards: {
			totalWorks: workMetrics.length,
			worksWithProgress: totals.worksWithProgress,
			worksWithoutPlanning,
			worksAheadSchedule,
			worksBehindSchedule,
			totalActiveBudget: totals.totalActiveBudget,
			totalEarnedValue: totals.totalEarnedValue,
			totalPlannedValue: totals.totalPlannedValue,
			totalActualCost: totals.totalActualCost,
			totalCurrentBudgetBalance: totals.totalCurrentBudgetBalance,
			totalProjectedBudgetBalance: totals.totalProjectedBudgetBalance,
			totalBudgetBalance: totals.totalBudgetBalance,
			worksBelowCost: totals.worksBelowCost,
			worksAboveCost: totals.worksAboveCost,
			totalBac: totals.totalBac,
			totalEacTypical: totals.totalEacTypical,
			totalEacAtypical: totals.totalEacAtypical,
			totalEtc: totals.totalEtc,
			totalVac: totals.totalVac,
		},
		rankings: buildRankings(worksSummary),
		portfolioChart: worksSummary.map((work) => ({
			workId: work.workId,
			workName: work.name,
			activeBudget: work.activeBudget,
			earnedValue: work.earnedValue,
			actualCost: work.actualCost,
			plannedValue: work.plannedValue,
			spi: work.schedulePerformanceIndex,
			cpi: work.costPerformanceIndex,
		})),
		works: worksSummary,
		dataCompleteness,
		qualityIssues,
		costsByWork,
		scheduleByWork,
		financial: {
			paidAmount: totalPaid,
			openAmount: totalOpen,
			bySupplier: aggregatedBySupplier,
			abcBySupplier,
		},
	};
}
