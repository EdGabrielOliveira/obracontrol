export function normalizeText(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.replace(/\s+/g, " ");
}

export function parseNumber(value: unknown): number | null {
	if (value === null || value === undefined || value === "") return null;
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (typeof value === "string") {
		const compact = value.trim().replace(/[^\d.,-]/g, "");
		if (
			!compact ||
			!/^-?\d/.test(compact) ||
			(compact.match(/-/g)?.length ?? 0) > 1
		)
			return null;

		const lastComma = compact.lastIndexOf(",");
		const lastDot = compact.lastIndexOf(".");
		const decimalSeparator =
			lastComma >= 0 && lastDot >= 0
				? lastComma > lastDot
					? ","
					: "."
				: lastComma >= 0
					? ","
					: lastDot >= 0 && compact.length - lastDot - 1 !== 3
						? "."
						: null;
		const cleaned = decimalSeparator
			? `${compact.slice(0, compact.lastIndexOf(decimalSeparator)).replace(/[.,]/g, "")}.${compact.slice(compact.lastIndexOf(decimalSeparator) + 1)}`
			: compact.replace(/[.,]/g, "");
		const num = Number(cleaned);
		if (Number.isFinite(num)) return num;
	}
	return null;
}

export function hasValue(value: unknown): boolean {
	return value !== null && value !== undefined && value !== "";
}

export function normalizePaymentStatus(
	value: string | null | undefined,
): "PAID" | "OPEN" {
	if (!value) return "OPEN";
	const normalized = normalizeText(value);
	if (isPaidKeyword(normalized)) return "PAID";
	return "OPEN";
}

export function isPaidKeyword(normalized: string): boolean {
	return (
		normalized.includes("pago") ||
		normalized.includes("paid") ||
		normalized.includes("liquidado")
	);
}

export function isOpenKeyword(normalized: string): boolean {
	return (
		normalized.includes("aberto") ||
		normalized.includes("open") ||
		normalized.includes("pendente")
	);
}
