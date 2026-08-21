export function formatCurrencySafe(
	value: number | string | null | undefined,
): string {
	if (value === null || value === undefined) return "-";
	const num =
		typeof value === "string"
			? Number(value.replace(/[^\d,-]/g, "").replace(",", "."))
			: value;
	if (Number.isNaN(num)) return "-";
	return new Intl.NumberFormat("pt-BR", {
		style: "currency",
		currency: "BRL",
	}).format(num);
}

export function parseCurrencyToNumber(
	raw: string | undefined | null,
): number | null {
	if (!raw) return null;
	const cleaned = raw.replace(/[^\d,-]/g, "").replace(",", ".");
	const num = Number(cleaned);
	return Number.isNaN(num) ? null : num;
}

export function parseMonetaryPreprocess(val: unknown): number | null {
	if (val === null || val === undefined || val === "") return null;
	if (typeof val === "number") return Number.isNaN(val) ? null : val;
	if (typeof val === "string") {
		const cleaned = val.replace(/[^\d,-]/g, "").replace(",", ".");
		const num = Number(cleaned);
		return Number.isNaN(num) ? null : num;
	}
	return null;
}

export function formatNumberSafe(
	value: number | null | undefined,
	decimals = 2,
): string {
	if (value === null || value === undefined) return "-";
	if (Number.isNaN(value)) return "-";
	return value.toLocaleString("pt-BR", {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	});
}
