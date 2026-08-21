import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import * as XLSX from "xlsx";
import { prisma } from "../../src/lib/prisma";
import { api, OWNER_A, resetAndSeedDatabase, WORK_A } from "./setup.dbtest";

function workbookSheets(bytes: ArrayBuffer): XLSX.WorkBook {
	return XLSX.read(new Uint8Array(bytes), { type: "array" });
}

describe("E2E importacao e exportacao de dados", () => {
	beforeAll(async () => {
		await resetAndSeedDatabase();
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	it("exporta o workbook completo com metadados e abas de dominio", async () => {
		const response = await api(
			OWNER_A,
			`/construction/works/${WORK_A}/export/completo?mode=report`,
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("spreadsheetml");
		expect(response.headers.get("content-disposition")).toContain("xlsx");

		const workbook = workbookSheets(await response.arrayBuffer());
		expect(workbook.SheetNames).toContain("Metadados");
		expect(workbook.SheetNames).toContain("Guia");
		expect(workbook.SheetNames).toContain("Obra");
		expect(workbook.SheetNames).toContain("Orcamento");

		const metadata = XLSX.utils.sheet_to_json<Record<string, string>>(
			workbook.Sheets.Metadados,
		);
		const metadataMap = new Map(
			metadata.map((row) => [String(row.Campo), String(row.Valor ?? "")]),
		);
		expect(metadataMap.get("Codigo da Obra")).toBeTruthy();
		expect(metadataMap.get("Fonte")).toBe("LIVE");
		expect(metadataMap.get("Usuario ID")).toBe(OWNER_A);

		const budgetRows = XLSX.utils.sheet_to_json(workbook.Sheets.Orcamento);
		expect(budgetRows.length).toBeGreaterThan(0);
	});
});
