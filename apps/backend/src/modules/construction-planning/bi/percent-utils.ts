import { ConstructionError } from "../../../lib/errors";

/**
 * Normaliza um valor de percentual para ratio (0..1).
 *
 * O codebase armazena percentuais em ambas as escalas:
 * - 0..1 (ratio): measuredPercentageAccumulated em medições
 * - 0..100 (percentual): completionPercentage, campos de UI
 *
 * Esta função aceita ambas as escalas:
 * - Valores > 1 são tratados como escala 0..100 e divididos por 100.
 * - Valores entre 0 e 1 são tratados como ratio e retornados como estão.
 *
 * Para inputs com formato garantido, prefira operações diretas:
 * - Se sabe que é 0..100: `value / 100`
 * - Se sabe que é 0..1: use diretamente
 */
export function normalizePercentage(value: number): number {
	if (!Number.isFinite(value) || value < 0) {
		throw new ConstructionError(
			"INVALID_PERCENTAGE_SCALE",
			`Percentual invalido (${value}): valor deve ser >= 0`,
			422,
		);
	}

	if (value > 100) {
		throw new ConstructionError(
			"INVALID_PERCENTAGE_SCALE",
			`Percentual invalido (${value}): valor nao pode exceder 100`,
			422,
		);
	}

	// Valores > 1 são tratados como escala 0..100
	if (value > 1) return value / 100;

	// Valores entre 0 e 1 são tratados como ratio
	return value;
}

export function clampProgressRatio(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.min(1, Math.max(0, value));
}
