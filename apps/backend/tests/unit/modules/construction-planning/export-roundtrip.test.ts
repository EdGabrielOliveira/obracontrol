import { describe, expect, test } from "bun:test";
import * as XLSX from "xlsx";
import { parseWorkbookByKind } from "../../../../src/modules/construction-planning/imports/parser";
import { validateWorkbookByKind } from "../../../../src/modules/construction-planning/imports/validator";
import { buildWorkbookTemplate } from "../../../../src/modules/construction-planning/templates/template-generator";
import {
	WORKBOOK_DEFINITIONS,
	WORKBOOK_KINDS,
} from "../../../../src/modules/construction-planning/templates/workbook-contracts";

describe("template -> parse -> validate round trip", () => {
	for (const kind of WORKBOOK_KINDS) {
		test(`modelo ${kind} parseia sem erro e valida as linhas de exemplo`, () => {
			const buffer = buildWorkbookTemplate(kind);
			const _workbook = XLSX.read(buffer, { type: "buffer" });
			const parsed = parseWorkbookByKind(buffer, `modelo-${kind}.xlsx`, kind);

			expect(parsed.sheetNames.length).toBeGreaterThan(0);
			const validation = validateWorkbookByKind(parsed, kind);

			if (kind === "obra-completa") {
				// O modelo completo exige a aba Obra preenchida (codigo e nome).
				expect(validation.valid).toBe(false);
				expect(validation.errors.length).toBeGreaterThan(0);
			} else {
				expect(validation.valid).toBe(true);
				expect(validation.errors).toEqual([]);
			}
		});
	}
});

describe("export headers round-trip", () => {
	test("headers canonicos de orcamento sao aceitos pelo parser", () => {
		const sheetDef = WORKBOOK_DEFINITIONS.orcamento.sheets.find(
			(s) => s.name === "Orcamento",
		);
		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(
			workbook,
			XLSX.utils.aoa_to_sheet([sheetDef?.headers ?? [], []]),
			"Orcamento",
		);

		const parsed = parseWorkbookByKind(
			XLSX.write(workbook, { type: "buffer" }),
			"export.xlsx",
			"orcamento",
		);

		expect(parsed.budgetRows).toEqual([]);
	});

	test("headers canonicos de cronograma sao aceitos pelo parser", () => {
		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(
			workbook,
			XLSX.utils.aoa_to_sheet([
				WORKBOOK_DEFINITIONS.cronograma.sheets[1].headers,
				[],
			]),
			"Cronograma Original",
		);

		const parsed = parseWorkbookByKind(
			XLSX.write(workbook, { type: "buffer" }),
			"export.xlsx",
			"cronograma",
		);

		expect(parsed.baselineRows).toEqual([]);
	});

	test("headers canonicos de medicoes de obra sao aceitos pelo parser", () => {
		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(
			workbook,
			XLSX.utils.aoa_to_sheet([
				WORKBOOK_DEFINITIONS["medicao-obra"].sheets[1].headers,
				[],
			]),
			"Medicoes Obra",
		);

		const parsed = parseWorkbookByKind(
			XLSX.write(workbook, { type: "buffer" }),
			"export.xlsx",
			"medicao-obra",
		);

		expect(parsed.measurementRows).toEqual([]);
	});

	test("headers canonicos de custos sao aceitos pelo parser", () => {
		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(
			workbook,
			XLSX.utils.aoa_to_sheet([
				WORKBOOK_DEFINITIONS.custos.sheets[1].headers,
				[],
			]),
			"Custos Realizados",
		);

		const parsed = parseWorkbookByKind(
			XLSX.write(workbook, { type: "buffer" }),
			"export.xlsx",
			"custos",
		);

		expect(parsed.actualCostRows).toEqual([]);
	});
});
