import { ConstructionError } from "../../../lib/errors";

export function normalizePercentage(value: number): number {
	if (!Number.isFinite(value) || value < 0 || value > 100) {
		throw new ConstructionError(
			"INVALID_PERCENTAGE_SCALE",
			"Percentual invalido: use escala 0..1 ou 0..100",
			422,
		);
	}

	if (value <= 1) return value;
	return value / 100;
}

export function clampProgressRatio(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.min(1, Math.max(0, value));
}
