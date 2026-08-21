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
	if (typeof value === "number") return value;
	if (typeof value === "string") {
		const cleaned = value.replace(/[^\d.,-]/g, "").replace(",", ".");
		const num = Number(cleaned);
		if (!Number.isNaN(num)) return num;
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
