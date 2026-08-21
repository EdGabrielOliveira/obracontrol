export type ThresholdDirection = "below" | "above";
export type ThresholdSeverity = "HIGH" | "MEDIUM" | "LOW";

export type ThresholdAlert = {
	code: string;
	severity: ThresholdSeverity;
	message: string;
	metric: string;
	value: number;
	threshold: number;
	direction: ThresholdDirection;
};

export type ThresholdRule = {
	code: string;
	metric: string;
	direction: ThresholdDirection;
	threshold: number;
	severity: ThresholdSeverity;
	message: (value: number, threshold: number) => string;
};

const RULES: ThresholdRule[] = [
	{
		code: "SPI_BELOW",
		metric: "SPI",
		direction: "below",
		threshold: 0.9,
		severity: "HIGH",
		message: () => "Cronograma atrasado: SPI abaixo de 0,90",
	},
	{
		code: "CPI_BELOW",
		metric: "CPI",
		direction: "below",
		threshold: 0.9,
		severity: "HIGH",
		message: () => "Custo estourado: CPI abaixo de 0,90",
	},
	{
		code: "CPI_WARNING",
		metric: "CPI",
		direction: "below",
		threshold: 1.0,
		severity: "MEDIUM",
		message: () => "Atencao: CPI abaixo de 1,00",
	},
	{
		code: "EAC_OVER_BUDGET",
		metric: "EAC",
		direction: "above",
		threshold: 1.0,
		severity: "LOW",
		message: (value, threshold) =>
			`EAC ${value.toFixed(2)} acima do orcamento (x${threshold.toFixed(2)})`,
	},
];

// Funcao pura de alerta por limiar: avalia um valor contra regras de
// direcao (below/above). Valores iguais ao limiar nao disparam alerta.
export function evaluateThresholds(
	metrics: Record<string, number | null | undefined>,
	rules: ThresholdRule[] = RULES,
): ThresholdAlert[] {
	const alerts: ThresholdAlert[] = [];
	for (const rule of rules) {
		const value = metrics[rule.metric];
		if (value === null || value === undefined || !Number.isFinite(value)) {
			continue;
		}
		const triggered =
			rule.direction === "below"
				? value < rule.threshold
				: value > rule.threshold;
		if (!triggered) continue;
		alerts.push({
			code: rule.code,
			severity: rule.severity,
			message: rule.message(value, rule.threshold),
			metric: rule.metric,
			value,
			threshold: rule.threshold,
			direction: rule.direction,
		});
	}
	return alerts;
}

export const thresholdRules = RULES;
