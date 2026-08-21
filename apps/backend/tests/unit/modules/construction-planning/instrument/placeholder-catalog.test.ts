import { describe, expect, it } from "bun:test";
import { resolveInstrumentPlaceholders } from "../../../../../src/modules/construction-planning/instrument/placeholder-catalog";

describe("instrument placeholder catalog (DOC-01)", () => {
	it("resolves known required values", () => {
		expect(
			resolveInstrumentPlaceholders({
				"empresa.nome": "Construtora Alfa",
				"obra.nome": "Obra Centro",
				"contrato.codigo": "CT-001",
				"contrato.valor": 1000,
				"fornecedor.nome": "Fornecedor A",
			}),
		).toMatchObject({ "contrato.valor": "1000" });
	});

	it("rejects unknown and missing required placeholders", () => {
		expect(() =>
			resolveInstrumentPlaceholders({
				"empresa.nome": "Construtora Alfa",
				"obra.nome": "Obra Centro",
				"contrato.codigo": "CT-001",
				"contrato.valor": 1000,
			}),
		).toThrow("fornecedor.nome");
		expect(() =>
			resolveInstrumentPlaceholders({
				"empresa.nome": "A",
				"obra.nome": "B",
				"contrato.codigo": "C",
				"contrato.valor": 1,
				"fornecedor.nome": "D",
				"contrato.inexistente": "x",
			}),
		).toThrow("Placeholder desconhecido");
	});
});
