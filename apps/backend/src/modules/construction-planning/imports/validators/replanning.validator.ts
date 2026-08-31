import { isScheduleItemDelayed } from "../../schedule/schedule-service";
import type { ImportValidationError, ParsedWorkbook } from "../../types";
import { normalizeHierarchyIndex } from "../index-helpers";
import type { NormalizedScheduleRevision } from "../normalized-types";
import {
	hasValue,
	missingField,
	normalizeRequiredDateField,
	validateDateRange,
} from "../normalizers";
import { validateBudgetReference } from "./shared";

export function normalizeScheduleRevisions(
	workbook: ParsedWorkbook,
	errors: ImportValidationError[],
	baselineIndexes: Set<string> | null,
): NormalizedScheduleRevision[] {
	return (workbook.replanningRows ?? []).flatMap((row) => {
		const index = row.index ? normalizeHierarchyIndex(row.index) : "";
		if (baselineIndexes !== null) {
			const hasIndex = validateBudgetReference(
				errors,
				"Replanejamento",
				row.rowNumber,
				index,
				baselineIndexes,
				{
					code: "UNKNOWN_SCHEDULE_INDEX",
					targetName: "cronograma",
				},
			);
			if (!hasIndex) return [];
		} else if (!index) {
			missingField(
				errors,
				"Replanejamento",
				row.rowNumber,
				"Indice",
				"Indice obrigatorio",
			);
			return [];
		}
		if (!index) return [];

		if (!hasValue(row.version)) {
			missingField(
				errors,
				"Replanejamento",
				row.rowNumber,
				"Versao",
				"Versao obrigatoria",
			);
		}

		const replannedStart = normalizeRequiredDateField(
			errors,
			"Replanejamento",
			row.rowNumber,
			"Inicio replanejado",
			row.replannedStart,
			"Inicio replanejado obrigatorio",
		);
		const replannedEnd = normalizeRequiredDateField(
			errors,
			"Replanejamento",
			row.rowNumber,
			"Fim replanejado",
			row.replannedEnd,
			"Fim replanejado obrigatorio",
		);
		const revisionDate = normalizeRequiredDateField(
			errors,
			"Replanejamento",
			row.rowNumber,
			"Data da revisao",
			row.revisionDate,
			"Data da revisao obrigatoria",
		);
		validateDateRange(
			errors,
			"Replanejamento",
			row.rowNumber,
			replannedStart,
			replannedEnd,
			"Fim replanejado",
		);

		const baseline = (workbook.baselineRows ?? []).find(
			(candidate) =>
				candidate.index != null &&
				normalizeHierarchyIndex(candidate.index) === index,
		);
		const budget = [
			...(workbook.budgetRows ?? []),
			...(workbook.itensRows ?? []),
		].find(
			(candidate) =>
				candidate.index != null &&
				normalizeHierarchyIndex(candidate.index) === index,
		);
		const completed = ["DONE", "FINALIZADO", "CONCLUIDO"].includes(
			String(budget?.providedStatus ?? "")
				.trim()
				.toUpperCase(),
		);
		if (
			baseline &&
			!isScheduleItemDelayed(
				{
					plannedEnd: baseline.plannedEnd
						? new Date(String(baseline.plannedEnd))
						: null,
					completionPercentage: completed ? 1 : 0,
				},
				new Date(),
			)
		) {
			errors.push({
				sheet: "Replanejamento",
				row: row.rowNumber,
				field: "Indice",
				code: "SCHEDULE_ITEM_NOT_DELAYED",
				message: `Item ${index} nao esta atrasado ou nao possui cronograma elegivel para replanejamento`,
			});
		}

		return [
			{
				rowNumber: row.rowNumber,
				index,
				version: row.version,
				replannedStart,
				replannedEnd,
				revisionDate,
				reason: row.reason,
			},
		];
	});
}
