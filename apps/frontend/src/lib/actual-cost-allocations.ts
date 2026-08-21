import type { ActualCostAllocation } from "@/types/measurements";
import { formatCurrencySafe, parseCurrencyToNumber } from "@/utils/currency";

export type DraftActualCostAllocation = {
	budgetItemId: string;
	percentage?: string | number | null;
	value?: string | number | null;
};

export type ActualCostAllocationBasis = {
	percentage?: number | null;
	value?: number | null;
};

export function toDraftActualCostAllocation(
	allocation: Pick<
		ActualCostAllocation,
		"budgetItemId" | "basis" | "percentage" | "value"
	>,
): DraftActualCostAllocation & { percentage: string; value: string } {
	return {
		budgetItemId: allocation.budgetItemId,
		percentage:
			allocation.basis !== "VALUE" && allocation.percentage != null
				? String(allocation.percentage)
				: "",
		value:
			(allocation.basis === "VALUE" || allocation.percentage == null) &&
			allocation.value != null
				? String(allocation.value)
				: "",
	};
}

type NormalizedDraftAllocation = {
	budgetItemId: string;
	percentage?: number;
	value?: number;
};

function parseNumber(
	value: string | number | null | undefined,
): number | undefined {
	if (typeof value === "number")
		return Number.isFinite(value) ? value : undefined;
	if (value == null || value.trim() === "") return undefined;

	const parsed = value.includes(",")
		? parseCurrencyToNumber(value)
		: Number(value.replace(/[^\d.-]/g, ""));
	return parsed != null && Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeDraftAllocation(
	row: DraftActualCostAllocation,
): NormalizedDraftAllocation {
	const percentage = parseNumber(row.percentage);
	const value = parseNumber(row.value);

	return {
		budgetItemId: row.budgetItemId.trim(),
		...(percentage !== undefined ? { percentage } : {}),
		...(value !== undefined ? { value } : {}),
	};
}

function normalizedRows(rows: DraftActualCostAllocation[]) {
	return rows.map(normalizeDraftAllocation);
}

export function validateDraftAllocations(
	rows: DraftActualCostAllocation[],
	totalAmount?: number,
): {
	valid: boolean;
	totalPercentage: number;
	valueTotal: number;
	error?: string;
} {
	if (rows.length === 0) {
		return {
			valid: false,
			totalPercentage: 0,
			valueTotal: 0,
			error: "Informe ao menos uma alocação de item de orçamento.",
		};
	}

	const normalized = normalizedRows(rows);
	const seenIds = new Set<string>();
	for (const row of normalized) {
		if (!row.budgetItemId) {
			return {
				valid: false,
				totalPercentage: 0,
				valueTotal: 0,
				error: "Selecione um item de orçamento para cada alocação.",
			};
		}
		if (seenIds.has(row.budgetItemId)) {
			return {
				valid: false,
				totalPercentage: 0,
				valueTotal: 0,
				error: "Não repita o mesmo item de orçamento no rateio.",
			};
		}
		seenIds.add(row.budgetItemId);

		const basisCount = [row.percentage, row.value].filter(
			(basis) => basis !== undefined,
		).length;
		if (basisCount !== 1) {
			return {
				valid: false,
				totalPercentage: 0,
				valueTotal: 0,
				error: "Informe apenas uma base de alocação por item.",
			};
		}
		if (
			row.percentage !== undefined &&
			(row.percentage < 0 || row.percentage > 100)
		) {
			return {
				valid: false,
				totalPercentage: 0,
				valueTotal: 0,
				error: "Percentuais do rateio devem estar entre 0 e 100%.",
			};
		}
		if (row.value !== undefined && row.value <= 0) {
			return {
				valid: false,
				totalPercentage: 0,
				valueTotal: 0,
				error: "O valor de cada alocação deve ser maior que zero.",
			};
		}
	}

	const totalPercentage = normalized.reduce(
		(sum, row) => sum + (row.percentage ?? 0),
		0,
	);
	const hasValueBasis = normalized.some((row) => row.value !== undefined);
	const hasPercentageBasis = normalized.some(
		(row) => row.percentage !== undefined,
	);
	if (hasValueBasis && hasPercentageBasis) {
		return {
			valid: false,
			totalPercentage,
			valueTotal: 0,
			error:
				"Informe apenas uma base de rateio por custo (percentual ou valor).",
		};
	}
	if (hasValueBasis) {
		const valueTotal = normalized.reduce(
			(sum, row) => sum + (row.value ?? 0),
			0,
		);
		if (totalAmount !== undefined && Math.abs(valueTotal - totalAmount) > 0.1) {
			return {
				valid: false,
				totalPercentage,
				valueTotal,
				error:
					"A soma dos valores do rateio deve corresponder ao valor total do custo.",
			};
		}
		return { valid: true, totalPercentage, valueTotal };
	}
	if (totalPercentage < 99.9 || totalPercentage > 100.1) {
		return {
			valid: false,
			totalPercentage,
			valueTotal: 0,
			error:
				"A soma dos percentuais do rateio deve ficar entre 99,9% e 100,1%.",
		};
	}

	return { valid: true, totalPercentage, valueTotal: 0 };
}

export function toActualCostAllocationPayload(
	rows: DraftActualCostAllocation[],
): Array<{ budgetItemId: string; percentage?: number; value?: number }> {
	return normalizedRows(rows).map(({ budgetItemId, percentage, value }) => ({
		budgetItemId,
		...(percentage !== undefined ? { percentage } : {}),
		...(value !== undefined ? { value } : {}),
	}));
}

export function formatAllocationBasis(
	allocation: ActualCostAllocationBasis,
): string {
	if (allocation.percentage != null && Number.isFinite(allocation.percentage)) {
		const percentage = `${allocation.percentage.toFixed(1)}%`;
		return allocation.value != null
			? `${percentage} → ${formatCurrencySafe(allocation.value)}`
			: percentage;
	}
	if (allocation.value != null && Number.isFinite(allocation.value)) {
		return formatCurrencySafe(allocation.value);
	}
	return "—";
}
