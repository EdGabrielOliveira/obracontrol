import { describe, expect, it } from "bun:test";
import * as XLSX from "xlsx";
import { buildWorkbookTemplate } from "../../../../src/modules/construction-planning/templates/template-generator";
import {
	WORKBOOK_DEFINITIONS,
	WORKBOOK_KINDS,
	type WorkbookKind,
} from "../../../../src/modules/construction-planning/templates/workbook-contracts";

function readSheet(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
	const sheet = workbook.Sheets[sheetName];
	if (!sheet) return [];
	return XLSX.utils.sheet_to_json(sheet, {
		header: 1,
		raw: true,
		defval: null,
		blankrows: false,
	});
}

function normalizeText(text: string): string {
	return text
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim();
}

describe("official construction planning seed fixture", () => {
	it("the official unified workbook parses and validates", async () => {
		const file = Bun.file(
			new URL(
				"../../../../fixtures/obrabi-modelo-unificado.xlsx",
				import.meta.url,
			),
		);
		const bytes = new Uint8Array(await file.arrayBuffer());
		expect(bytes.length).toBeGreaterThan(0);

		const workbook = XLSX.read(bytes, { type: "buffer" });

		expect(workbook.SheetNames).toEqual(
			expect.arrayContaining([
				"Obra",
				"Cronograma Original",
				"Replanejamento",
				"Custos Realizados",
			]),
		);
		expect(
			workbook.SheetNames.some(
				(name) => name === "Orçamento" || name === "Orcamento",
			),
		).toBe(true);
		expect(
			workbook.SheetNames.some(
				(name) => name === "Medições" || name === "Medicoes",
			),
		).toBe(true);

		const obraRows = readSheet(workbook, "Obra");
		expect(obraRows.length).toBeGreaterThanOrEqual(2);
		const obraHeader = obraRows[0];
		expect(String(obraHeader[0]).toLowerCase()).toBe("campo");
		expect(String(obraHeader[1]).toLowerCase()).toBe("valor");

		const budgetSheetName =
			workbook.SheetNames.find(
				(name) => name === "Orçamento" || name === "Orcamento",
			) ?? "";
		const budgetRows = readSheet(workbook, budgetSheetName);
		expect(budgetRows.length).toBeGreaterThanOrEqual(3);
		const budgetHeader = budgetRows[0];
		expect(normalizeText(String(budgetHeader[0]))).toContain("indice");
		expect(
			budgetRows.some((row) => String(row[1]).toLowerCase().includes("item")),
		).toBe(true);

		const baselineRows = readSheet(workbook, "Cronograma Original");
		expect(baselineRows.length).toBeGreaterThanOrEqual(2);

		const replanningRows = readSheet(workbook, "Replanejamento");
		expect(replanningRows.length).toBeGreaterThanOrEqual(2);

		const measurementSheetName =
			workbook.SheetNames.find(
				(name) => name === "Medições" || name === "Medicoes",
			) ?? "";
		const measurementRows = readSheet(workbook, measurementSheetName);
		expect(measurementRows.length).toBeGreaterThanOrEqual(2);

		const costRows = readSheet(workbook, "Custos Realizados");
		expect(costRows.length).toBeGreaterThanOrEqual(3);
		expect(
			costRows.some((row) => String(row[5]).toLowerCase().includes("futuro")),
		).toBe(true);
		expect(
			costRows.some(
				(row) => row[1] === null || row[1] === undefined || row[1] === "",
			),
		).toBe(true);

		const itemBudgetRows = budgetRows.filter((row) =>
			String(row[1]).toLowerCase().includes("item"),
		);
		expect(itemBudgetRows.length).toBeGreaterThanOrEqual(5);

		const hasSuspendedItem = itemBudgetRows.some((row) =>
			String(row[9]).toLowerCase().includes("suspenso"),
		);
		expect(hasSuspendedItem).toBe(true);

		const hasIgnoredItem = itemBudgetRows.some((row) => {
			const status = String(row[9]).toLowerCase();
			return (
				status.includes("nao executar") ||
				status.includes("não executar") ||
				status.includes("ignorar")
			);
		});
		expect(hasIgnoredItem).toBe(true);

		const obraCode = obraRows.find((row) =>
			normalizeText(String(row[0])).includes("codigo"),
		);
		expect(obraCode).toBeDefined();
		expect(obraCode?.[1]).toBeTruthy();

		const obraName = obraRows.find((row) =>
			normalizeText(String(row[0])).includes("nome"),
		);
		expect(obraName).toBeDefined();
		expect(obraName?.[1]).toBeTruthy();

		const baseDate = obraRows.find((row) =>
			normalizeText(String(row[0])).includes("data"),
		);
		expect(baseDate).toBeDefined();
		expect(baseDate?.[1]).toBeTruthy();
	});

	it("the fixture exercises financial BI fields through the full parser", async () => {
		const { parseWorkbook } = await import(
			"../../../../src/modules/construction-planning/imports/parser"
		);
		const { validateWorkbook } = await import(
			"../../../../src/modules/construction-planning/imports/validator"
		);

		const file = Bun.file(
			new URL(
				"../../../../fixtures/obrabi-modelo-unificado.xlsx",
				import.meta.url,
			),
		);
		const bytes = new Uint8Array(await file.arrayBuffer());

		const parsed = parseWorkbook(bytes, "obrabi-modelo-unificado.xlsx");
		const validated = validateWorkbook(parsed);

		expect(validated.work).toHaveProperty("areaM2");
		expect(validated.work).toHaveProperty("operationalStatus");
		expect(validated.work).toHaveProperty("responsibleName");

		if (validated.actualCosts.length > 0) {
			expect(validated.actualCosts[0]).toHaveProperty("supplierName");
			expect(validated.actualCosts[0]).toHaveProperty("costGroup");
			expect(validated.actualCosts[0]).toHaveProperty("paymentStatus");
		}
	});
});

describe("canonical workbook bytes per kind", () => {
	for (const kind of WORKBOOK_KINDS as WorkbookKind[]) {
		it(`${kind} generates valid xlsx with correct sheet names and structure`, () => {
			const buffer = buildWorkbookTemplate(kind);
			const workbook = XLSX.read(buffer, { type: "buffer" });
			const def = WORKBOOK_DEFINITIONS[kind];

			expect(workbook.SheetNames.length).toBe(def.sheets.length);

			for (let i = 0; i < def.sheets.length; i++) {
				const expectedName = def.sheets[i].name;
				const actualName = workbook.SheetNames[i];

				expect(actualName).toBe(expectedName);

				const rows = readSheet(workbook, actualName);
				expect(rows.length).toBeGreaterThanOrEqual(1);

				if (def.sheets[i].isDataSheet) {
					const firstRow = rows[0] as string[];
					const expectedHeaders = def.sheets[i].headers;
					expect(firstRow.length).toBeGreaterThanOrEqual(1);
					expect(firstRow[0]).toBe(expectedHeaders[0]);
				}
			}
		});
	}
});
