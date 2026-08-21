import type { ImportValidationError, ParsedWorkbook } from "../../types";
import { normalizeHierarchyIndex } from "../index-helpers";
import type { NormalizedBaselineSchedule } from "../normalized-types";
import {
	missingField,
	normalizeOptionalPercentageField,
	normalizeRequiredDateField,
	validateDateRange,
} from "../normalizers";
import { validateBudgetReference } from "./shared";

export function normalizeBaselineSchedules(
	workbook: ParsedWorkbook,
	errors: ImportValidationError[],
	budgetIndexes: Set<string> | null,
): NormalizedBaselineSchedule[] {
	return (workbook.baselineRows ?? []).flatMap((row) => {
		const index = row.index ? normalizeHierarchyIndex(row.index) : "";
		if (budgetIndexes !== null) {
			const hasIndex = validateBudgetReference(
				errors,
				"Cronograma Original",
				row.rowNumber,
				index,
				budgetIndexes,
			);
			if (!hasIndex) return [];
		} else if (!index) {
			missingField(
				errors,
				"Cronograma Original",
				row.rowNumber,
				"Indice",
				"Indice obrigatorio",
			);
			return [];
		}
		if (!index) return [];

		const plannedStart = normalizeRequiredDateField(
			errors,
			"Cronograma Original",
			row.rowNumber,
			"Inicio previsto",
			row.plannedStart,
			"Inicio previsto obrigatorio",
		);
		const plannedEnd = normalizeRequiredDateField(
			errors,
			"Cronograma Original",
			row.rowNumber,
			"Fim previsto",
			row.plannedEnd,
			"Fim previsto obrigatorio",
		);
		const plannedWeight = normalizeOptionalPercentageField(
			errors,
			"Cronograma Original",
			row.rowNumber,
			"Peso planejado opcional",
			row.plannedWeight,
		);
		validateDateRange(
			errors,
			"Cronograma Original",
			row.rowNumber,
			plannedStart,
			plannedEnd,
			"Fim previsto",
		);

		return [
			{
				rowNumber: row.rowNumber,
				index,
				plannedStart,
				plannedEnd,
				plannedWeight,
			},
		];
	});
}
