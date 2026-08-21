export function normalizeSupplierDocument(
	value: string | null | undefined,
): string | null {
	const digits = value?.replace(/\D/g, "") ?? "";
	return digits.length > 0 ? digits : null;
}

export function normalizeSupplierName(
	value: string | null | undefined,
): string | null {
	const normalized = value
		?.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.toUpperCase();
	return normalized || null;
}
