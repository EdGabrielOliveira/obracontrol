export function formatCurrency(value: number): string {
	if (!Number.isFinite(value)) return "-";
	return new Intl.NumberFormat("pt-BR", {
		style: "currency",
		currency: "BRL",
	}).format(value);
}

/** Formats a CNPJ while keeping partially entered values usable in inputs. */
export function formatCnpj(value: string | null | undefined): string {
	const digits = (value ?? "").replace(/\D/g, "").slice(0, 14);
	if (digits.length <= 2) return digits;
	if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
	if (digits.length <= 8) {
		return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
	}
	if (digits.length <= 12) {
		return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
	}
	return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

/** Currency input mask: raw digits represent cents (e.g. 123300 => R$ 1.233,00). */
export function formatCurrencyInput(value: string): string {
	const digits = value.replace(/\D/g, "");
	if (!digits) return "";
	return new Intl.NumberFormat("pt-BR", {
		style: "currency",
		currency: "BRL",
		minimumFractionDigits: 2,
	}).format(Number(digits) / 100);
}

export function parseCurrencyInput(value: string): number {
	const digits = value.replace(/\D/g, "");
	return digits ? Number(digits) / 100 : Number.NaN;
}

export function formatNullableCurrency(
	value: number | null | undefined,
): string {
	return value == null ? "N/A" : formatCurrency(value);
}

export function formatQuantity(value: number | null | undefined): string {
	if (value == null || !Number.isFinite(value)) return "-";
	return new Intl.NumberFormat("pt-BR", {
		maximumFractionDigits: 4,
	}).format(value);
}

export function formatCurrencyTick(value: number): string {
	if (!Number.isFinite(value)) return "";
	return new Intl.NumberFormat("pt-BR", {
		style: "currency",
		currency: "BRL",
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(value);
}

export function formatPercentage(value: number | null | undefined): string {
	if (value == null || !Number.isFinite(value)) return "-";
	return new Intl.NumberFormat("pt-BR", {
		style: "percent",
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	}).format(value / 100);
}

export function formatRatioAsPercentage(
	value: number | null | undefined,
): string {
	if (value == null || !Number.isFinite(value)) return "-";
	return new Intl.NumberFormat("pt-BR", {
		style: "percent",
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	}).format(value);
}

export function formatDate(value: string | null | undefined): string {
	if (!value) return "-";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "-";
	return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
	if (!value) return "-";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "-";
	return new Intl.DateTimeFormat("pt-BR", {
		dateStyle: "short",
		timeStyle: "short",
	}).format(date);
}

export function toDateInputValue(value: string | null | undefined): string {
	if (!value) return "";
	const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
	if (dateOnly) return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export const CATEGORY_LABEL: Record<string, string> = {
	MATERIAL: "Material",
	MAO_DE_OBRA: "Mão de obra",
	EQUIPAMENTO: "Equipamento",
	OUTROS: "Outros",
	LABOR: "Mão de obra",
	EQUIPMENT: "Equipamento",
	OTHER: "Outros",
};

export const BUDGET_TYPE_LABEL: Record<string, string> = {
	STAGE: "Etapa",
	SUBSTAGE: "Subetapa",
	ITEM: "Item",
	COMPOSITION: "Composicao",
	INPUT: "Insumo",
};

export const SERVICE_TYPE_LABEL: Record<string, string> = {
	ETAPA: "Etapa",
	SUBETAPA: "Subetapa",
	COMPOSICAO: "Composição",
	INSUMO: "Insumo",
	ITEM: "Item",
	STAGE: "Etapa",
	SUBSTAGE: "Subetapa",
	COMPOSITION: "Composição",
	INPUT: "Insumo",
};

export function labelFor(type: string, map: Record<string, string>): string {
	return map[type] ?? type;
}

export const COST_TYPE_LABEL: Record<string, string> = {
	ATUAL: "Atual",
	FUTURO: "Futuro",
	CURRENT: "Atual",
	FUTURE: "Futuro",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
	PAGO: "Pago",
	EM_ABERTO: "Em aberto",
	ABERTO: "Aberto",
	PAID: "Pago",
	OPEN: "Aberto",
};

export function costTypeStyle(type: string): string {
	if (type === "ATUAL" || type === "CURRENT") return "text-success";
	return "text-warning";
}

export function naturalSortIndex(a: string, b: string): number {
	const aParts = a.split(".").map(Number);
	const bParts = b.split(".").map(Number);
	const maxLen = Math.max(aParts.length, bParts.length);

	for (let i = 0; i < maxLen; i++) {
		const aVal = aParts[i] ?? 0;
		const bVal = bParts[i] ?? 0;
		if (aVal !== bVal) return aVal - bVal;
	}
	return 0;
}
