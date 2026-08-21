import { toNum } from "../../../lib/decimal-utils";
import type {
	CalculationAuditEntry,
	SCurvePoint,
	UnappropriatedCosts,
	WorkBILedgerSummary,
	WorkBIResponse,
} from "../types";
import { evaluateThresholds } from "./alert-thresholds";
import {
	buildActualCostByItemKey,
	type CalculationRows,
	calculateMetrics,
	collectStageRollups,
	type DbActualCostInput,
	type DbItemCalculationInput,
	type DbMeasurementInput,
	daysBetween,
	elapsedDaysAt,
	remainingDaysAt,
	type WorkMetricCalculationResult,
} from "./calculations";
import type { ResolvedMetricSource } from "./metric-source";
import {
	buildHierarchy,
	buildMonthlySCurve,
	type Indicator,
	normalizeCostType,
	type WorkMetricInput,
} from "./metrics";
import { buildDataQualityIssues } from "./metrics-quality";

function latestActualProgressDate(
	items: DbItemCalculationInput[],
	measurements: DbMeasurementInput[] = [],
): string | null {
	const latestMeasurement = measurements
		.map((measurement) => measurement.measurementDate)
		.filter((date): date is Date => date instanceof Date)
		.reduce<Date | null>(
			(current, date) => (!current || date > current ? date : current),
			null,
		);

	if (latestMeasurement) return latestMeasurement.toISOString();

	const latest = items
		.filter((item) => toNum(item.completionPercentage) > 0)
		.reduce<Date | null>((current, item) => {
			const date = item.actualEnd ?? item.actualStart;
			if (!date) return current;
			return !current || date > current ? date : current;
		}, null);

	return latest?.toISOString() ?? null;
}

function toResponseSCurve(
	points: ReturnType<typeof buildMonthlySCurve>,
): SCurvePoint[] {
	return points.map((point) => ({
		period: point.period,
		plannedAccumulated: point.plannedAccumulated,
		measuredAccumulated: point.measuredAccumulated,
		trendProjected: point.trendProjected,
		plannedPercentage: point.plannedAccumulated,
		measuredPercentage: point.measuredAccumulated,
	}));
}

function auditEntry(
	key: CalculationAuditEntry["key"],
	source: string,
	indicator: Indicator<number>,
): CalculationAuditEntry {
	return {
		key,
		source,
		formula: indicator.formula,
		result: indicator.value,
		status: indicator.status,
		unavailableReason: indicator.unavailableReason,
	};
}

function buildCalculationAudit(
	metrics: WorkMetricCalculationResult,
): CalculationAuditEntry[] {
	return [
		auditEntry("PV", "Cronograma Original", metrics.indicators.plannedValue),
		auditEntry("EV", "Medicoes", metrics.indicators.earnedValue),
		auditEntry("AC", "Custos Realizados", metrics.indicators.actualCost),
		auditEntry(
			"SPI",
			"Cronograma Original + Medicoes",
			metrics.indicators.schedulePerformanceIndex,
		),
		auditEntry(
			"CPI",
			"Custos Realizados",
			metrics.indicators.costPerformanceIndex,
		),
		auditEntry(
			"saldo",
			"Orcamento + Custos Realizados",
			metrics.indicators.currentBudgetBalance,
		),
		auditEntry(
			"EAC",
			"Orcamento + Custos Realizados",
			metrics.indicators.selectedEac,
		),
		auditEntry(
			"ETC",
			"EAC selecionado - Custos Realizados",
			metrics.indicators.etc,
		),
		auditEntry("VAC", "Orcamento - EAC selecionado", metrics.indicators.vac),
		auditEntry(
			"TCPI",
			"Orcamento + Medicoes + Custos Realizados",
			metrics.indicators.tcpi,
		),
	];
}

function isUnappropriatedCost(cost: DbActualCostInput): boolean {
	return !(cost.budgetItemId || cost.budgetItemIndex || cost.budgetIndex);
}

function buildUnappropriatedCosts(
	actualCosts: DbActualCostInput[],
	totalActual: number,
	totalFuture: number,
): UnappropriatedCosts {
	const items = actualCosts.filter(isUnappropriatedCost).map((cost) => {
		const amount = toNum(cost.amount);
		return {
			description:
				(cost.supplierName ?? "Custo nao apropriado") +
				(cost.category ? ` (${cost.category})` : ""),
			amount,
			costDate: cost.costDate?.toISOString() ?? null,
			supplierName: cost.supplierName ?? null,
			category: cost.category ?? null,
			costType: normalizeCostType(cost.costType),
			paymentStatus: cost.paymentStatus ?? null,
			// Negativos (estornos/creditos) sao preservados com estado de
			// revisao em vez de descartados silenciosamente.
			needsReview: amount < 0,
		};
	});

	return { totalActual, totalFuture, items };
}

export function buildWorkBI(
	work: WorkMetricInput,
	input: CalculationRows,
	asOf?: Date,
): WorkBIResponse {
	return buildWorkBIFromMetrics(
		work,
		calculateMetrics(work, input, asOf),
		input,
	);
}

export function buildWorkBIFromResolved(
	resolved: ResolvedMetricSource,
): WorkBIResponse {
	// A fonte resolvida ja carrega metricas finais (LIVE calculado ou
	// PERSISTED lido do envelope validado); nenhum recalculo acontece aqui.
	return buildWorkBIFromMetrics(
		resolved.input,
		resolved.metrics,
		resolved.input,
		resolved.ledger ? toLedgerSummary(resolved.ledger) : null,
	);
}

function toLedgerSummary(
	ledger: ResolvedMetricSource["ledger"] & object,
): WorkBILedgerSummary {
	return {
		committed: Number(ledger.committed),
		incurred: Number(ledger.incurred),
		dueOpen: Number(ledger.dueOpen),
		paid: Number(ledger.paid),
		amendmentNet: Number(ledger.contracts.amendmentNet),
		contractedValue: Number(ledger.contracts.contractedValue),
		measuredGross: Number(ledger.contracts.measuredGross),
	};
}

export function buildWorkBIFromMetrics(
	work: WorkMetricInput,
	metrics: WorkMetricCalculationResult,
	input: CalculationRows,
	ledgerSummary: WorkBILedgerSummary | null = null,
): WorkBIResponse {
	const hierarchy = buildHierarchy(metrics.items);
	const dataDate = new Date(metrics.dataDate);
	const plannedDays = daysBetween(work.plannedStart, work.plannedEnd);
	const elapsedDays = elapsedDaysAt(work.plannedStart, dataDate);
	const remainingDays = remainingDaysAt(work.plannedEnd, dataDate);
	const costByStage = collectStageRollups(
		hierarchy,
		buildActualCostByItemKey(input.actualCosts ?? [], dataDate),
	);

	return {
		summary: {
			dataDate: metrics.dataDate,
			activeBudget: metrics.activeBudget,
			ignoredBudget: metrics.ignoredBudget,
			suspendedBudget: metrics.suspendedBudget,
			plannedValue: metrics.plannedValue,
			scheduleVariance: metrics.scheduleVariance,
			schedulePerformanceIndex: metrics.schedulePerformanceIndex,
			costPerformanceIndex: metrics.costPerformanceIndex,
			plannedPercentage: metrics.plannedPercentage,
			measuredPercentage: metrics.measuredPercentage,
			scheduleDifference: metrics.scheduleDifference,
			plannedDays,
			elapsedDays,
			remainingDays,
			budget: metrics.activeBudget,
			executedValue: metrics.earnedValue,
			actualCost: metrics.actualCost,
			futureCost: metrics.futureCost,
			currentBudgetBalance: metrics.currentBudgetBalance,
			projectedBudgetBalance: metrics.projectedBudgetBalance,
			balance: metrics.balance,
			earnedValue: metrics.earnedValue,
			costVariance: metrics.costVariance,
			lastProgressDate: latestActualProgressDate(
				input.items,
				input.measurements,
			),
			idc: metrics.idc,
			idp: metrics.schedulePerformanceIndex,
			bac: metrics.bac,
			eacTypical: metrics.eacTypical,
			eacAtypical: metrics.eacAtypical,
			selectedEac: metrics.selectedEac,
			etc: metrics.etc,
			vac: metrics.vac,
			tcpi: metrics.tcpi,
			dataCompleteness: metrics.dataCompleteness,
		},
		indicators: metrics.indicators,
		sCurve: toResponseSCurve(buildMonthlySCurve(metrics.items, dataDate)),
		costByStage,
		unappropriatedCosts: buildUnappropriatedCosts(
			input.actualCosts ?? [],
			metrics.unappropriatedActualCost,
			metrics.unappropriatedFutureCost,
		),
		calculationAudit: buildCalculationAudit(metrics),
		financial: metrics.financial,
		qualityIssues: buildDataQualityIssues(metrics, work.id),
		ledgerSummary,
		alerts: evaluateThresholds({
			SPI: metrics.schedulePerformanceIndex,
			CPI: metrics.costPerformanceIndex,
			EAC:
				metrics.bac > 0 && metrics.selectedEac !== null
					? metrics.selectedEac / metrics.bac
					: null,
		}),
	};
}
