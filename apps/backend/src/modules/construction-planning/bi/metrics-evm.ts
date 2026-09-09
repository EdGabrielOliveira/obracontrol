import type { DataCompleteness, WorkMetricIndicators } from "./metrics-core";
import { available, unavailable } from "./metrics-core";

export function buildIndicators(values: {
	plannedValue: number;
	earnedValue: number;
	actualCost: number;
	currentBudgetBalance: number;
	projectedBudgetBalance: number;
	scheduleVariance: number | null;
	schedulePerformanceIndex: number | null;
	costVariance: number | null;
	costPerformanceIndex: number | null;
	bac: number;
	eacTypical: number | null;
	eacAtypical: number | null;
	selectedEac: number | null;
	etc: number | null;
	vac: number | null;
	tcpi: number | null;
	dataCompleteness: DataCompleteness;
	costDataReliable?: boolean;
}): WorkMetricIndicators {
	const plannedValueFormula =
		"sum(active item budget * baseline planned progress at dataDate)";
	const earnedValueFormula =
		"sum(active item budget * latest measured percentage at dataDate)";
	const actualCostFormula = "sum(CURRENT actual costs up to dataDate)";
	const currentBudgetBalanceFormula = "activeBudget - AC";
	const projectedBudgetBalanceFormula = "BAC - EAC selecionado";
	const scheduleVarianceFormula = "EV - PV";
	const schedulePerformanceIndexFormula = "EV / PV";
	const costVarianceFormula = "EV - AC";
	const costPerformanceIndexFormula = "EV / AC";
	const bacFormula = "soma dos orcamentos dos itens ativos (activeBudget)";
	const eacTypicalFormula = "BAC / CPI";
	const eacAtypicalFormula = "AC + (BAC - EV)";
	const etcFormula = "EAC selecionado - AC";
	const vacFormula = "BAC - EAC selecionado";
	const usesEacForTcpi = values.bac - values.actualCost <= 0;
	const tcpiFormula = usesEacForTcpi
		? "(BAC - EV) / (EAC - AC)"
		: "(BAC - EV) / (BAC - AC)";
	const missingBaseline =
		"Cronograma Original ausente ou sem itens ativos planejados";
	const missingMeasurements = "Medicoes ausentes para calcular valor agregado";
	const missingActualCosts =
		"Custos Realizados ausentes para calcular custos financeiros";
	const hasPlannedValue = values.dataCompleteness.hasBaselineSchedule;
	const hasEarnedValue = values.dataCompleteness.hasMeasurements;
	const hasActualCost = values.dataCompleteness.hasActualCosts;
	const costDataReliable =
		values.costDataReliable ??
		!values.dataCompleteness.hasSingleActualCostCategory;
	const incompleteCostScope =
		"Escopo de custo incompleto; informe mais de uma categoria antes de interpretar o IDC/EAC";
	const costUnavailableReason = (zeroReason = "AC igual a zero") => {
		if (!hasEarnedValue) return missingMeasurements;
		if (!hasActualCost) return missingActualCosts;
		if (!costDataReliable) return incompleteCostScope;
		return zeroReason;
	};

	const plannedValue = hasPlannedValue
		? available(values.plannedValue, plannedValueFormula)
		: unavailable<number>(plannedValueFormula, missingBaseline);
	const earnedValue = hasEarnedValue
		? available(values.earnedValue, earnedValueFormula)
		: unavailable<number>(earnedValueFormula, missingMeasurements);
	const actualCost = hasActualCost
		? available(values.actualCost, actualCostFormula)
		: unavailable<number>(actualCostFormula, missingActualCosts);
	const currentBudgetBalance = hasActualCost
		? available(values.currentBudgetBalance, currentBudgetBalanceFormula)
		: unavailable<number>(currentBudgetBalanceFormula, missingActualCosts);
	const projectedBudgetBalance =
		hasActualCost && values.selectedEac != null
			? available(values.projectedBudgetBalance, projectedBudgetBalanceFormula)
			: unavailable<number>(
					projectedBudgetBalanceFormula,
					!hasActualCost ? missingActualCosts : incompleteCostScope,
				);
	const scheduleVariance =
		values.scheduleVariance == null || !hasPlannedValue || !hasEarnedValue
			? unavailable<number>(
					scheduleVarianceFormula,
					hasPlannedValue ? missingMeasurements : missingBaseline,
				)
			: available(values.scheduleVariance, scheduleVarianceFormula);
	const schedulePerformanceIndex =
		values.schedulePerformanceIndex == null ||
		!hasPlannedValue ||
		!hasEarnedValue
			? unavailable<number>(
					schedulePerformanceIndexFormula,
					!hasPlannedValue
						? missingBaseline
						: !hasEarnedValue
							? missingMeasurements
							: "PV igual a zero",
				)
			: available(
					values.schedulePerformanceIndex,
					schedulePerformanceIndexFormula,
				);
	const costVariance =
		values.costVariance == null || !hasEarnedValue || !costDataReliable
			? unavailable<number>(costVarianceFormula, costUnavailableReason())
			: available(values.costVariance, costVarianceFormula);
	const costPerformanceIndex =
		values.costPerformanceIndex == null || !hasEarnedValue || !costDataReliable
			? unavailable<number>(
					costPerformanceIndexFormula,
					costUnavailableReason(),
				)
			: available(values.costPerformanceIndex, costPerformanceIndexFormula);
	const cpiUnavailableReason = costUnavailableReason("CPI igual a zero");
	const bacIndicator = available(values.bac, bacFormula);
	const eacTypicalIndicator =
		values.eacTypical == null || !hasEarnedValue || !costDataReliable
			? unavailable<number>(eacTypicalFormula, cpiUnavailableReason)
			: available(values.eacTypical, eacTypicalFormula);
	const eacAtypicalIndicator =
		values.eacAtypical == null || !hasEarnedValue || !costDataReliable
			? unavailable<number>(eacAtypicalFormula, costUnavailableReason())
			: available(values.eacAtypical, eacAtypicalFormula);
	const selectedEacIndicator =
		values.selectedEac == null
			? unavailable<number>(eacTypicalFormula, cpiUnavailableReason)
			: available(values.selectedEac, eacTypicalFormula);
	const etcIndicator =
		values.etc == null
			? unavailable<number>(etcFormula, cpiUnavailableReason)
			: available(values.etc, etcFormula);
	const vacIndicator =
		values.vac == null
			? unavailable<number>(vacFormula, cpiUnavailableReason)
			: available(values.vac, vacFormula);
	const tcpiIndicator =
		values.tcpi == null || !hasEarnedValue || !costDataReliable
			? unavailable<number>(
					tcpiFormula,
					!hasEarnedValue || !hasActualCost || !costDataReliable
						? costUnavailableReason()
						: usesEacForTcpi
							? "EAC - AC igual a zero"
							: "BAC - AC igual a zero",
				)
			: available(values.tcpi, tcpiFormula);

	return {
		plannedValue,
		earnedValue,
		actualCost,
		currentBudgetBalance,
		projectedBudgetBalance,
		scheduleVariance,
		schedulePerformanceIndex,
		idp: { ...schedulePerformanceIndex },
		costVariance,
		costPerformanceIndex,
		idc: { ...costPerformanceIndex },
		bac: bacIndicator,
		eacTypical: eacTypicalIndicator,
		eacAtypical: eacAtypicalIndicator,
		selectedEac: selectedEacIndicator,
		etc: etcIndicator,
		vac: vacIndicator,
		tcpi: tcpiIndicator,
	};
}
