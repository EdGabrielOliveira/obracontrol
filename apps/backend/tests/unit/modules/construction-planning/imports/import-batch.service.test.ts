import { describe, expect, test } from "bun:test";
import { importIssueKey } from "../../../../../src/modules/construction-planning/imports/import-row-key";

describe("importIssueKey", () => {
	test("associa erros legados da aba Medicoes às linhas de Medicoes Obra", () => {
		expect(
			importIssueKey({
				sheet: "Medicoes",
				row: 7,
				code: "UNKNOWN_BUDGET_INDEX",
				message: "indice invalido",
			}),
		).toBe("Medicoes Obra:7");
	});

	test("normaliza acentos e mantém a linha", () => {
		expect(
			importIssueKey({
				sheet: "Medições Obra",
				row: 12,
				code: "INVALID_DATE",
				message: "data invalida",
			}),
		).toBe("Medicoes Obra:12");
	});
});
