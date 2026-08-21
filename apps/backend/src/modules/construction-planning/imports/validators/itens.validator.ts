import type { ImportValidationError, ParsedWorkbook } from "../../types";
import type { NormalizedBudgetItem } from "../normalized-types";
import { normalizeBudgetRow } from "./budget.validator";

export function normalizeItensRows(
	workbook: ParsedWorkbook,
	errors: ImportValidationError[],
): NormalizedBudgetItem[] {
	const itensRows = workbook.itensRows ?? [];
	const normalizedRows: NormalizedBudgetItem[] = [];
	const knownIndexes: Set<string> = new Set();
	let sortOrder = 0;

	for (const row of itensRows) {
		const normalized = normalizeBudgetRow(
			errors,
			"Itens do Orcamento",
			row,
			knownIndexes,
		);
		if (!normalized) continue;
		sortOrder++;
		knownIndexes.add(normalized.index);
		normalizedRows.push({ ...normalized, sortOrder });
	}

	return normalizedRows;
}
