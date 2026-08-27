import type { ImportValidationError } from "../../types";
import { missingField } from "../normalizers";

export function validateBudgetReference(
	errors: ImportValidationError[],
	sheet: string,
	row: number,
	index: string | null,
	indexes: ReadonlySet<string> | null,
	options?: { code?: string; targetName?: string },
): index is string {
	if (!index) {
		missingField(errors, sheet, row, "Indice", "Indice obrigatorio");
		return false;
	}
	if (indexes === null) {
		return false;
	}
	if (!indexes.has(index)) {
		errors.push({
			sheet,
			row,
			field: "Indice",
			code: options?.code ?? "UNKNOWN_BUDGET_INDEX",
			message: `Indice nao encontrado no ${options?.targetName ?? "orcamento"}`,
		});
		return false;
	}
	return true;
}
