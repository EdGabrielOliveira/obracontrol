import { roundCurrency } from "../../../../lib/math-utils";
import type {
	ImportValidationError,
	ParsedBudgetRow,
	ParsedWorkbook,
} from "../../types";
import { normalizeHierarchyIndex } from "../index-helpers";
import type { NormalizedBudgetItem } from "../normalized-types";
import {
	invalidField,
	missingField,
	normalizeBudgetStatus,
	normalizeBudgetType,
	normalizeNumberField,
	parentIndexFor,
} from "../normalizers";

export function normalizeBudgetRow(
	errors: ImportValidationError[],
	sheetName: string,
	row: ParsedBudgetRow,
	knownIndexes: Set<string>,
): NormalizedBudgetItem | null {
	const normalizedIndex = row.index ? normalizeHierarchyIndex(row.index) : "";
	if (!normalizedIndex)
		missingField(
			errors,
			sheetName,
			row.rowNumber,
			"Indice",
			"Indice obrigatorio",
		);
	if (!row.type)
		missingField(errors, sheetName, row.rowNumber, "Tipo", "Tipo obrigatorio");
	if (!row.description) {
		missingField(
			errors,
			sheetName,
			row.rowNumber,
			"Descricao",
			"Descricao obrigatoria",
		);
	}
	if (!normalizedIndex || !row.type || !row.description) return null;

	const type = normalizeBudgetType(row.type);
	if (!type) {
		invalidField(
			errors,
			sheetName,
			row.rowNumber,
			"Tipo",
			"INVALID_BUDGET_TYPE",
			"Tipo invalido",
		);
		return null;
	}
	const parentIndex = parentIndexFor(normalizedIndex, knownIndexes);
	const quantity = normalizeNumberField(
		errors,
		sheetName,
		row.rowNumber,
		"Quantidade",
		row.quantity,
	);
	const laborUnitCost = normalizeNumberField(
		errors,
		sheetName,
		row.rowNumber,
		"Mao de obra unitaria",
		row.laborUnitCost,
	);
	const materialUnitCost = normalizeNumberField(
		errors,
		sheetName,
		row.rowNumber,
		"Material unitario",
		row.materialUnitCost,
	);
	const equipmentUnitCost = normalizeNumberField(
		errors,
		sheetName,
		row.rowNumber,
		"Equipamento unitario",
		row.equipmentUnitCost,
	);
	const otherUnitCost = normalizeNumberField(
		errors,
		sheetName,
		row.rowNumber,
		"Outros unitario",
		row.otherUnitCost,
	);

	if (type === "ITEM") {
		if (!row.unit)
			missingField(
				errors,
				sheetName,
				row.rowNumber,
				"Unidade",
				"Unidade obrigatoria",
			);
		if (quantity === null) {
			missingField(
				errors,
				sheetName,
				row.rowNumber,
				"Quantidade",
				"Quantidade obrigatoria",
			);
		}
	}

	const normalizedLaborUnitCost = laborUnitCost ?? 0;
	const normalizedMaterialUnitCost = materialUnitCost ?? 0;
	const normalizedEquipmentUnitCost = equipmentUnitCost ?? 0;
	const normalizedOtherUnitCost = otherUnitCost ?? 0;
	const canonicalUnitCost = normalizeNumberField(
		errors,
		sheetName,
		row.rowNumber,
		"Custo unitario",
		row.unitCost,
	);
	const unitCostTotal = roundCurrency(
		canonicalUnitCost ??
			normalizedLaborUnitCost +
				normalizedMaterialUnitCost +
				normalizedEquipmentUnitCost +
				normalizedOtherUnitCost,
	);
	const canonicalTotalCost = normalizeNumberField(
		errors,
		sheetName,
		row.rowNumber,
		"Valor total",
		row.totalCost,
	);
	const totalBudget =
		type === "ITEM"
			? roundCurrency(canonicalTotalCost ?? (quantity ?? 0) * unitCostTotal)
			: 0;

	return {
		rowNumber: row.rowNumber,
		index: normalizedIndex,
		parentIndex,
		type,
		description: row.description,
		unit: row.unit,
		quantity: type === "ITEM" ? quantity : null,
		laborUnitCost: normalizedLaborUnitCost,
		materialUnitCost: normalizedMaterialUnitCost,
		equipmentUnitCost: normalizedEquipmentUnitCost,
		otherUnitCost: normalizedOtherUnitCost,
		unitCostTotal,
		totalBudget,
		unitCost: unitCostTotal,
		totalCost: totalBudget,
		plannedStart: null,
		plannedEnd: null,
		actualStart: null,
		actualEnd: null,
		completionPercentage: 0,
		providedStatus: row.providedStatus,
		computedStatus: normalizeBudgetStatus(row.providedStatus, 0),
		sortOrder: 0,
	};
}

export function validateBudgetRows(
	workbook: ParsedWorkbook,
	errors: ImportValidationError[],
): NormalizedBudgetItem[] {
	const budgetRows = workbook.budgetRows ?? [];
	const normalizedRows: NormalizedBudgetItem[] = [];
	const knownIndexes: Set<string> = new Set();
	let sortOrder = 0;

	if (budgetRows.length === 0) {
		missingField(
			errors,
			"Orcamento",
			undefined,
			"rows",
			"Nenhuma linha de orcamento encontrada",
		);
	}

	for (const row of budgetRows) {
		const normalizedIndex = row.index ? normalizeHierarchyIndex(row.index) : "";
		if (normalizedIndex && knownIndexes.has(normalizedIndex)) {
			invalidField(
				errors,
				"Orcamento",
				row.rowNumber,
				"Indice",
				"DUPLICATE_INDEX",
				"Indice duplicado na planilha",
			);
			continue;
		}
		const normalized = normalizeBudgetRow(
			errors,
			"Orcamento",
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
