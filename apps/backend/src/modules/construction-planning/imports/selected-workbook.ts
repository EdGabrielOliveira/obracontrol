import { ConstructionError } from "../../../lib/errors";
import type { ParsedWorkbookUnified } from "../types";
import { ancestorIndexesOf } from "./index-helpers";

export type SelectedWorkbookRow = {
	sheet: string;
	rowNumber: number;
};

export function assertSelectedRowIds(selectedRowIds: string[]): void {
	if (selectedRowIds.length === 0) {
		throw new ConstructionError(
			"IMPORT_INVALID_SELECTION",
			"Ao menos uma linha deve ser selecionada",
			422,
		);
	}
	if (new Set(selectedRowIds).size !== selectedRowIds.length) {
		throw new ConstructionError(
			"IMPORT_INVALID_SELECTION",
			"A selecao nao pode conter linhas duplicadas",
			422,
		);
	}
}

function selectedRowsFor<T extends { rowNumber: number }>(
	sheet: string,
	rows: T[],
	selected: Set<string>,
): T[] {
	return rows.filter((row) => selected.has(`${sheet}:${row.rowNumber}`));
}

type IndexedWorkbookRow = {
	rowNumber: number;
	index?: string | null;
	budgetIndex?: string | null;
};

function rowIndex(row: IndexedWorkbookRow): string | null {
	const index = row.index ?? row.budgetIndex;
	return typeof index === "string" && index.length > 0 ? index : null;
}

function addBudgetClosure(
	workbook: ParsedWorkbookUnified,
	selected: Set<string>,
): void {
	const dependencySheets: Array<{
		sheet: string;
		rows: IndexedWorkbookRow[];
	}> = [
		{ sheet: "Orcamento", rows: workbook.budgetRows },
		{ sheet: "Itens do Orcamento", rows: workbook.itensRows },
		{ sheet: "Cronograma Original", rows: workbook.baselineRows },
		{ sheet: "Medicoes Obra", rows: workbook.measurementRows },
		{ sheet: "Custos Realizados", rows: workbook.actualCostRows },
	];
	const budgetRowsByIndex = new Map(
		workbook.budgetRows.flatMap((row) =>
			row.index ? [[row.index, row] as const] : [],
		),
	);

	for (const { sheet, rows } of dependencySheets) {
		for (const row of rows) {
			if (!selected.has(`${sheet}:${row.rowNumber}`)) continue;
			const index = rowIndex(row);
			if (!index) continue;
			for (const dependencyIndex of [index, ...ancestorIndexesOf(index)]) {
				const dependency = budgetRowsByIndex.get(dependencyIndex);
				if (dependency) {
					selected.add(`Orcamento:${dependency.rowNumber}`);
				}
			}
		}
	}
}

export function selectWorkbookRows(
	workbook: ParsedWorkbookUnified,
	selectedRows: SelectedWorkbookRow[],
): ParsedWorkbookUnified {
	const selected = new Set(
		selectedRows.map((row) => `${row.sheet}:${row.rowNumber}`),
	);
	addBudgetClosure(workbook, selected);

	return {
		...workbook,
		budgetRows: selectedRowsFor("Orcamento", workbook.budgetRows, selected),
		itensRows: selectedRowsFor(
			"Itens do Orcamento",
			workbook.itensRows,
			selected,
		),
		baselineRows: selectedRowsFor(
			"Cronograma Original",
			workbook.baselineRows,
			selected,
		),
		replanningRows: selectedRowsFor(
			"Replanejamento",
			workbook.replanningRows,
			selected,
		),
		measurementRows: selectedRowsFor(
			"Medicoes Obra",
			workbook.measurementRows,
			selected,
		),
		contractRows: selectedRowsFor("Contrato", workbook.contractRows, selected),
		serviceRows: selectedRowsFor("Servicos", workbook.serviceRows, selected),
		contractMeasurementRows: selectedRowsFor(
			"Medicoes Contrato",
			workbook.contractMeasurementRows,
			selected,
		),
		paymentRows: selectedRowsFor("Pagamentos", workbook.paymentRows, selected),
		actualCostRows: selectedRowsFor(
			"Custos Realizados",
			workbook.actualCostRows,
			selected,
		),
	};
}
