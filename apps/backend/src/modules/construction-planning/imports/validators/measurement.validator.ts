import type { ImportValidationError, ParsedWorkbook } from "../../types";
import { normalizeHierarchyIndex } from "../index-helpers";
import type { NormalizedMeasurement } from "../normalized-types";
import {
	normalizeNumberField,
	normalizeRequiredDateField,
	normalizeRequiredPercentageField,
} from "../normalizers";
import { validateBudgetReference } from "./shared";

export function normalizeMeasurements(
	workbook: ParsedWorkbook,
	errors: ImportValidationError[],
	budgetIndexes: Set<string>,
): NormalizedMeasurement[] {
	return (workbook.measurementRows ?? []).flatMap((row) => {
		const index = row.index ? normalizeHierarchyIndex(row.index) : null;
		const hasIndex = validateBudgetReference(
			errors,
			"Medicoes",
			row.rowNumber,
			index,
			budgetIndexes,
		);
		if (!hasIndex) return [];
		if (!index) return [];

		const measurementDate = normalizeRequiredDateField(
			errors,
			"Medicoes",
			row.rowNumber,
			"Data da medicao",
			row.measurementDate,
			"Data da medicao obrigatoria",
		);
		const measuredPercentageAccumulated = normalizeRequiredPercentageField(
			errors,
			"Medicoes",
			row.rowNumber,
			"Percentual medido acumulado",
			row.measuredPercentageAccumulated,
			"Percentual medido acumulado obrigatorio",
		);
		const measuredQuantityAccumulated = normalizeNumberField(
			errors,
			"Medicoes",
			row.rowNumber,
			"Quantidade medida acumulada",
			row.measuredQuantityAccumulated,
		);

		if (measurementDate === null || measuredPercentageAccumulated === null) {
			return [];
		}

		return [
			{
				rowNumber: row.rowNumber,
				index,
				measurementDate,
				measuredPercentageAccumulated,
				measuredQuantityAccumulated,
				notes: row.notes,
			},
		];
	});
}
