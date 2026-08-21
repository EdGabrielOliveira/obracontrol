export function formatCurrency(value: number): string {
	if (!Number.isFinite(value)) return "-";
	return new Intl.NumberFormat("pt-BR", {
		style: "currency",
		currency: "BRL",
	}).format(value);
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
