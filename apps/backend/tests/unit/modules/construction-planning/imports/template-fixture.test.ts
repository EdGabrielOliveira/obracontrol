import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseWorkbookByKind } from "../../../../../src/modules/construction-planning/imports/parser";

const FIXTURES = join(import.meta.dir, "../../../../../fixtures");

describe("IMP-002 - parser alinhado ao template de referencia unificado", () => {
	it("parseia obrabi-modelo-unificado.xlsx (6 abas) com aliases do template", () => {
		const bytes = readFileSync(join(FIXTURES, "obrabi-modelo-unificado.xlsx"));
		const result = parseWorkbookByKind(
			new Uint8Array(bytes),
			"obrabi-modelo-unificado.xlsx",
			"obra-completa",
		);

		expect(result.sheetNames).toContain("Orçamento");
		expect(result.sheetNames).toContain("Cronograma Original");
		expect(result.sheetNames).toContain("Medições");
		expect(result.sheetNames).toContain("Custos Realizados");
		expect(Array.isArray(result.budgetRows)).toBe(true);
		expect(Array.isArray(result.measurementRows)).toBe(true);
		expect(Array.isArray(result.actualCostRows)).toBe(true);
	});

	it("mapeia 'Mao de obra unitaria' como custo unitario da linha de orcamento", () => {
		const bytes = readFileSync(join(FIXTURES, "obrabi-modelo-unificado.xlsx"));
		const result = parseWorkbookByKind(
			new Uint8Array(bytes),
			"obrabi-modelo-unificado.xlsx",
			"obra-completa",
		);

		const row = result.budgetRows[0];
		expect(row).toBeTruthy();
		expect(row.index).toBeTruthy();
		expect(row.description).toBeTruthy();
		expect(row.quantity != null).toBe(true);
	});

	it("ORC-007/IMP-008 (DEC-011): aba Cronograma Original separada segue suportada como legado", () => {
		const bytes = readFileSync(join(FIXTURES, "obrabi-modelo-unificado.xlsx"));
		const result = parseWorkbookByKind(
			new Uint8Array(bytes),
			"cronograma-separado.xlsx",
			"cronograma",
		);

		// O kind cronograma (workbook apenas com a aba de cronograma) continua
		// aceito: suporte legado temporario, nao removido (DEC-011).
		expect(result.sheetNames).toContain("Cronograma Original");
		expect(Array.isArray(result.baselineRows)).toBe(true);
	});

	it("parseia o mapa de cotacao de empreitada de referencia com cabecalho deslocado", () => {
		const bytes = readFileSync(join(FIXTURES, "mapa_cotacao_empreitada.xlsx"));
		const parsed = parseWorkbookByKind(
			new Uint8Array(bytes),
			"mapa_cotacao_empreitada.xlsx",
			"cotacao",
		);

		expect(parsed.sheetNames).toContain("Mapa de Cotação");
		expect(parsed.quotationRows).toContainEqual(
			expect.objectContaining({
				rowNumber: 7,
				supplierDocument: "12.345.678/0001-90",
				supplierName: "Construtora Modelo Ltda.",
				supplierAddress: expect.stringContaining("Rua das Palmeiras"),
				supplierPhone: "(83) 99999-1234",
				supplierEmail: "contato@construtoramodelo.com.br",
				supplierResponsible: "João Silva",
				serviceDescription: expect.stringContaining("alvenaria"),
				value: 35000,
				serviceStartDate: "2026-09-01",
				executionTermDays: 90,
				paymentTerms: "30/60/90 dias",
				notes: expect.stringContaining("substitua"),
			}),
		);
	});
});
