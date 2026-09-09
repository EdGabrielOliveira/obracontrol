import type { DataCompleteness, WorkMetrics } from "./metrics-core";

export type DataQualityIssueCode =
	| "MISSING_BASELINE_SCHEDULE"
	| "MISSING_MEASUREMENTS"
	| "MISSING_ACTUAL_COSTS"
	| "UNAPPROPRIATED_ACTUAL_COSTS"
	| "UNAPPROPRIATED_FUTURE_COSTS"
	| "ZERO_PLANNED_VALUE_DENOMINATOR"
	| "ZERO_ACTUAL_COST_DENOMINATOR"
	| "SINGLE_ACTUAL_COST_CATEGORY"
	| "BASELINE_END_BEFORE_WORK_END";

export type DataQualityIssueSeverity = "HIGH" | "MEDIUM" | "LOW";

export type DataQualityIssue = {
	code: DataQualityIssueCode;
	severity: DataQualityIssueSeverity;
	message: string;
	suggestedAction: string;
	metric?: "PV" | "EV" | "AC" | "SPI" | "CPI";
	workId?: string;
};

function issue(
	code: DataQualityIssueCode,
	severity: DataQualityIssueSeverity,
	message: string,
	suggestedAction: string,
	metric?: DataQualityIssue["metric"],
	workId?: string,
): DataQualityIssue {
	return { code, severity, message, suggestedAction, metric, workId };
}

export function buildDataQualityIssues(
	metrics: Pick<
		WorkMetrics,
		"plannedValue" | "actualCost" | "dataCompleteness" | "indicators"
	> &
		Pick<WorkMetrics, "baselineEnd" | "contractEnd">,
	workId?: string,
): DataQualityIssue[] {
	const completeness: DataCompleteness = metrics.dataCompleteness;
	const issues: DataQualityIssue[] = [];

	if (!completeness.hasBaselineSchedule) {
		issues.push(
			issue(
				"MISSING_BASELINE_SCHEDULE",
				"MEDIUM",
				"Cronograma Original ausente ou sem itens ativos planejados.",
				"Importe ou cadastre o cronograma original e confirme as datas dos itens ativos.",
				"PV",
				workId,
			),
		);
	}

	if (!completeness.hasMeasurements) {
		issues.push(
			issue(
				"MISSING_MEASUREMENTS",
				"MEDIUM",
				"Não há medições aceitas disponíveis para calcular o valor agregado.",
				"Registre ou importe uma medição aceita vinculada aos itens do orçamento.",
				"EV",
				workId,
			),
		);
	}

	if (!completeness.hasActualCosts) {
		issues.push(
			issue(
				"MISSING_ACTUAL_COSTS",
				"MEDIUM",
				"Não há custos realizados com data válida até a data-base.",
				"Registre ou importe custos realizados com data e status válidos.",
				"AC",
				workId,
			),
		);
	}

	if (completeness.hasUnappropriatedActualCosts) {
		issues.push(
			issue(
				"UNAPPROPRIATED_ACTUAL_COSTS",
				"HIGH",
				"Existem custos realizados sem vínculo com item de orçamento.",
				"Vincule cada custo ao item de orçamento correto ou encaminhe-o para revisão.",
				"AC",
				workId,
			),
		);
	}

	if (completeness.hasUnappropriatedFutureCosts) {
		issues.push(
			issue(
				"UNAPPROPRIATED_FUTURE_COSTS",
				"MEDIUM",
				"Existem custos futuros sem vínculo com item de orçamento.",
				"Vincule cada custo futuro ao item de orçamento correto antes de projetar o saldo.",
				"AC",
				workId,
			),
		);
	}

	if (completeness.hasSingleActualCostCategory) {
		issues.push(
			issue(
				"SINGLE_ACTUAL_COST_CATEGORY",
				"HIGH",
				"Os custos realizados estão concentrados em uma única categoria; o IDC/EAC não é confiável.",
				"Apropie mão de obra, serviços, equipamentos e demais custos, ou mantenha IDC/EAC indisponíveis.",
				"CPI",
				workId,
			),
		);
	}

	if (
		metrics.baselineEnd &&
		metrics.contractEnd &&
		new Date(metrics.baselineEnd).getTime() <
			new Date(metrics.contractEnd).getTime()
	) {
		issues.push(
			issue(
				"BASELINE_END_BEFORE_WORK_END",
				"MEDIUM",
				"A linha de base termina antes do prazo cadastrado da obra.",
				"Revise o cronograma ou registre um replanejamento até o prazo contratual antes de interpretar o atraso.",
				"SPI",
				workId,
			),
		);
	}

	if (
		completeness.hasBaselineSchedule &&
		completeness.hasMeasurements &&
		metrics.plannedValue <= 0
	) {
		issues.push(
			issue(
				"ZERO_PLANNED_VALUE_DENOMINATOR",
				"HIGH",
				"PV é zero; SPI/IDP não pode ser calculado com segurança.",
				"Revise o cronograma, os pesos planejados e a data-base antes de interpretar o SPI.",
				"SPI",
				workId,
			),
		);
	}

	if (
		completeness.hasActualCosts &&
		completeness.hasMeasurements &&
		metrics.actualCost <= 0
	) {
		issues.push(
			issue(
				"ZERO_ACTUAL_COST_DENOMINATOR",
				"HIGH",
				"AC é zero ou negativo; CPI/IDC não pode ser calculado com segurança.",
				"Revise os custos realizados e a convenção de sinal antes de interpretar o CPI.",
				"CPI",
				workId,
			),
		);
	}

	return issues;
}
