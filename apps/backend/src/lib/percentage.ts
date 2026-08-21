export function toPercent100(value: number | null | undefined): number | null {
	if (value === null || value === undefined || !Number.isFinite(value))
		return null;
	if (value > 0 && value < 1) return value * 100;
	return value;
}

export function clampPercent100(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.min(100, Math.max(0, value));
}
