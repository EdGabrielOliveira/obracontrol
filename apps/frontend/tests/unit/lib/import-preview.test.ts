import { describe, expect, it } from "bun:test";
import {
	previewFieldKeys,
	previewFieldLabel,
	previewFieldValue,
	previewIssueLabel,
	previewSheetLabel,
} from "@/lib/import-preview";
import type { ImportPreviewRow } from "@/types/import";

function row(values: Record<string, unknown>): ImportPreviewRow {
	return {
		id: "row-1",
		sheet: "Medicoes Obra",
		rowNumber: 2,
		values,
		status: "INVALID",
		issues: [],
	};
}

describe("import preview helpers", () => {
	it("deriva somente os campos presentes na planilha e em ordem legível", () => {
		expect(
			previewFieldKeys([
				row({
					notes: "Medição parcial",
					index: "1.1",
					measurementDate: "2026-01-31",
					measuredPercentageAccumulated: 0.3,
				}),
			]),
		).toEqual(["index", "measurementDate", "measuredPercentageAccumulated"]);
		expect(previewFieldKeys([row({ rowNumber: 2, index: "1.1" })])).toEqual([
			"index",
		]);
	});

	it("exibe valores reais e converte percentual decimal para leitura humana", () => {
		expect(previewFieldValue("index", "1.1")).toBe("1.1");
		expect(previewFieldValue("measurementDate", 46173)).toBe("31/05/2026");
		expect(
			previewFieldValue("measuredPercentageAccumulated", 0.3),
		).toBe("30%");
		expect(previewFieldValue("measuredPercentageAccumulated", 30)).toBe("30%");
	});

	it("traduz o nome do campo nos erros sem criar uma coluna fictícia", () => {
		expect(previewFieldLabel("Indice")).toBe("Índice");
		expect(
		previewIssueLabel({
			column: "Indice",
			code: "UNKNOWN_BUDGET_INDEX",
			message: "Indice nao encontrado no orcamento",
			value: null,
		}),
		).toBe("Índice: Índice não encontrado no orçamento");
		expect(previewSheetLabel("Medicoes Obra")).toBe("Medições de Obra");
	});
});
