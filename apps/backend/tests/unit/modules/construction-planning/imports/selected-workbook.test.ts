import { describe, expect, it } from "bun:test";
import {
	assertSelectedRowIds,
	selectWorkbookRows,
} from "../../../../../src/modules/construction-planning/imports/selected-workbook";
import type { ParsedWorkbookUnified } from "../../../../../src/modules/construction-planning/types";

function workbook(): ParsedWorkbookUnified {
	return {
		fileName: "obra.xlsx",
		sheetName: "Obra",
		header: {
			workName: "Obra",
			workCode: "OBRA-1",
			plannedStart: null,
			plannedEnd: null,
			baseDate: null,
		},
		work: {
			code: "OBRA-1",
			name: "Obra",
			clientName: null,
			baseDate: null,
			plannedStart: null,
			plannedEnd: null,
			areaM2: null,
			operationalStatus: null,
			responsibleName: null,
		},
		budgetRows: [
			{
				rowNumber: 2,
				index: "1",
				type: "ITEM",
				description: "Selecionado",
				unit: null,
				quantity: 1,
				laborUnitCost: 0,
				materialUnitCost: 0,
				equipmentUnitCost: 0,
				otherUnitCost: 0,
				providedStatus: null,
			},
			{
				rowNumber: 3,
				index: "2",
				type: "ITEM",
				description: "Nao selecionado",
				unit: null,
				quantity: 1,
				laborUnitCost: 0,
				materialUnitCost: 0,
				equipmentUnitCost: 0,
				otherUnitCost: 0,
				providedStatus: null,
			},
		],
		itensRows: [],
		baselineRows: [],
		replanningRows: [],
		measurementRows: [],
		contractRows: [],
		serviceRows: [],
		contractMeasurementRows: [],
		paymentRows: [],
		actualCostRows: [],
		quotationRows: [],
		sheetNames: ["Obra", "Orcamento"],
	};
}

describe("selectWorkbookRows", () => {
	it("applies only selected rows while preserving workbook metadata and dependency sheets", () => {
		const selected = selectWorkbookRows(workbook(), [
			{ sheet: "Orcamento", rowNumber: 2 },
		]);

		expect(selected.work).toEqual(workbook().work);
		expect(selected.sheetNames).toEqual(["Obra", "Orcamento"]);
		expect(selected.budgetRows).toHaveLength(1);
		expect(selected.budgetRows[0]?.description).toBe("Selecionado");
	});

	it("includes budget ancestors when a dependent measurement is selected", () => {
		const source = workbook();
		source.budgetRows = [
			{ ...source.budgetRows[0], index: "1" },
			{ ...source.budgetRows[0], rowNumber: 4, index: "1.1" },
		];
		source.measurementRows = [
			{
				rowNumber: 2,
				index: "1.1",
				measurementDate: "2026-01-15",
				measuredPercentageAccumulated: 0.5,
				measuredQuantityAccumulated: null,
				notes: null,
			},
		];

		const selected = selectWorkbookRows(source, [
			{ sheet: "Medicoes Obra", rowNumber: 2 },
		]);

		expect(selected.measurementRows).toHaveLength(1);
		expect(selected.budgetRows.map((row) => row.index)).toEqual(["1", "1.1"]);
	});
});

describe("assertSelectedRowIds", () => {
	it("rejects an empty selection with a domain error", () => {
		expect(() => assertSelectedRowIds([])).toThrow(
			/ao menos uma linha deve ser selecionada/i,
		);
	});

	it("rejects duplicate row ids with a domain error", () => {
		expect(() => assertSelectedRowIds(["row-1", "row-1"])).toThrow(
			/nao pode conter linhas duplicadas/i,
		);
	});
});
