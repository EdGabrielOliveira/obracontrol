export function normalizeSupplierDocument(
	value: string | null | undefined,
): string | null {
	const digits = value?.replace(/\D/g, "") ?? "";
	return digits.length > 0 ? digits : null;
}

const CNPJ_WEIGHT_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_WEIGHT_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function isValidCnpj(value: string | null | undefined): boolean {
	const cnpj = normalizeSupplierDocument(value);
	if (!cnpj || cnpj.length !== 14 || new Set(cnpj).size === 1) return false;

	const checkDigit = (base: string, weights: number[]) => {
		const sum = weights.reduce(
			(total, weight, index) => total + Number(base[index]) * weight,
			0,
		);
		const remainder = sum % 11;
		return remainder < 2 ? 0 : 11 - remainder;
	};

	return (
		checkDigit(cnpj.slice(0, 12), CNPJ_WEIGHT_1) === Number(cnpj[12]) &&
		checkDigit(cnpj.slice(0, 13), CNPJ_WEIGHT_2) === Number(cnpj[13])
	);
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
