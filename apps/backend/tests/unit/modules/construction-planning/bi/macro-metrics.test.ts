import { describe, expect, it } from "bun:test";
import {
	calculateLucroRealizado,
	calculateMargemBrutaOrcada,
	calculateProduzidoNaoFaturado,
	deriveMacroValues,
	MONTHLY_FACT_KEY_DICTIONARY,
	validateMetaLucroBruto,
} from "../../../../../src/modules/construction-planning/bi/macro-metrics";

describe("calculateMargemBrutaOrcada (DEC-MET-002)", () => {
	it("calculates margin with approved budget denominator greater than zero", () => {
		const result = calculateMargemBrutaOrcada(1000, 700);
		expect(result.status).toBe("AVAILABLE");
		expect(result.value).toBeCloseTo(0.3, 6);
	});

	it("returns UNAVAILABLE when the denominator is zero", () => {
		const result = calculateMargemBrutaOrcada(0, 0);
		expect(result.status).toBe("UNAVAILABLE");
		expect(result.value).toBeNull();
		expect(result.unavailableReason).toBe("MARGIN_DENOMINATOR_NOT_POSITIVE");
	});

	it("returns UNAVAILABLE when the denominator is negative", () => {
		const result = calculateMargemBrutaOrcada(-100, 50);
		expect(result.status).toBe("UNAVAILABLE");
		expect(result.value).toBeNull();
	});

	it("preserves zero margin as a legitimate zero", () => {
		const result = calculateMargemBrutaOrcada(1000, 1000);
		expect(result.status).toBe("AVAILABLE");
		expect(result.value).toBe(0);
	});
});

describe("calculateLucroRealizado (DEC-MET-004, dependente de DEC-MET-001)", () => {
	it("calculates produzido minus gastos elegiveis", () => {
		const result = calculateLucroRealizado(100, 70);
		expect(result.status).toBe("AVAILABLE");
		expect(result.value).toBe(30);
	});

	it("returns UNAVAILABLE when produzido is null", () => {
		const result = calculateLucroRealizado(null, 70);
		expect(result.status).toBe("UNAVAILABLE");
		expect(result.value).toBeNull();
	});

	it("returns UNAVAILABLE when gastos is null", () => {
		const result = calculateLucroRealizado(100, null);
		expect(result.status).toBe("UNAVAILABLE");
		expect(result.value).toBeNull();
	});

	it("does not derive anything from negative gastos (NEGATIVE_AMOUNT_REVIEW)", () => {
		const result = calculateLucroRealizado(100, -50);
		expect(result.status).toBe("UNAVAILABLE");
		expect(result.value).toBeNull();
		expect(result.unavailableReason).toBe("NEGATIVE_AMOUNT_REVIEW");
	});
});

describe("calculateProduzidoNaoFaturado (DEC-MET-006)", () => {
	it("calculates produzido minus faturado with consistent competencia", () => {
		const result = calculateProduzidoNaoFaturado(100, 60, true);
		expect(result.status).toBe("AVAILABLE");
		expect(result.value).toBe(40);
	});

	it("returns UNAVAILABLE when competencias diverge", () => {
		const result = calculateProduzidoNaoFaturado(100, 60, false);
		expect(result.status).toBe("UNAVAILABLE");
		expect(result.value).toBeNull();
		expect(result.unavailableReason).toBe("COMPETENCIA_DIVERGENTE");
	});

	it("returns UNAVAILABLE when either input is null", () => {
		expect(calculateProduzidoNaoFaturado(null, 60, true).status).toBe(
			"UNAVAILABLE",
		);
		expect(calculateProduzidoNaoFaturado(100, null, true).status).toBe(
			"UNAVAILABLE",
		);
	});
});

describe("validateMetaLucroBruto (DEC-MET-003)", () => {
	it("accepts a BRL meta value", () => {
		const result = validateMetaLucroBruto(500);
		expect(result.status).toBe("AVAILABLE");
		expect(result.value).toBe(500);
	});

	it("returns UNAVAILABLE when meta is null", () => {
		const result = validateMetaLucroBruto(null);
		expect(result.status).toBe("UNAVAILABLE");
		expect(result.value).toBeNull();
	});
});

describe("MONTHLY_FACT_KEY_DICTIONARY (DEC-FATO-001)", () => {
	it("uses unique canonical camelCase keys", () => {
		const keys = MONTHLY_FACT_KEY_DICTIONARY.map((entry) => entry.key);
		expect(new Set(keys).size).toBe(keys.length);
		for (const key of keys) {
			expect(key).toMatch(/^[a-z][a-zA-Z0-9]*$/);
		}
	});

	it("covers the fields of docs/12 Fato mensal section", () => {
		const keys = new Set(MONTHLY_FACT_KEY_DICTIONARY.map((entry) => entry.key));
		for (const expected of [
			"chaveTOTVS",
			"metaMensal",
			"produzido",
			"faturado",
			"produzidoNaoFaturado",
			"gastos",
			"gastoProducao",
			"teto",
			"resultado",
			"margem",
			"lucro",
			"previsaoFaturamento15",
			"previsaoFechamentoMedicao",
			"atingimento",
			"pareto",
			"pendencia",
			"acao",
			"responsavel",
			"dataPrevista",
		]) {
			expect(keys.has(expected), `dictionary must contain ${expected}`).toBe(
				true,
			);
		}
	});

	it("every derived key has a dictionary entry", () => {
		const dictionaryKeys = new Set(
			MONTHLY_FACT_KEY_DICTIONARY.map((entry) => entry.key),
		);
		for (const derivedKey of ["margem", "lucro", "produzidoNaoFaturado"]) {
			expect(dictionaryKeys.has(derivedKey)).toBe(true);
		}
	});
});

describe("deriveMacroValues (DEC-FATO-001: derivado na leitura, storage opaco)", () => {
	it("derives margem, lucro and produzidoNaoFaturado from stored values", () => {
		const result = deriveMacroValues({
			produzido: 100,
			faturado: 60,
			gastos: 70,
			metaMensal: 500,
		});
		expect(result.derived.margem?.status).toBe("UNAVAILABLE");
		expect(result.derived.lucro?.value).toBe(30);
		expect(result.derived.produzidoNaoFaturado?.value).toBe(40);
		expect(result.issues).toHaveLength(0);
	});

	it("keeps null unavailability in the derived output", () => {
		const result = deriveMacroValues({ produzido: null, gastos: null });
		expect(result.derived.lucro?.value).toBeNull();
		expect(result.derived.lucro?.status).toBe("UNAVAILABLE");
	});

	it("does not store or mutate the input valores", () => {
		const input = { produzido: 100, gastos: 70 };
		const snapshot = JSON.stringify(input);
		deriveMacroValues(input);
		expect(JSON.stringify(input)).toBe(snapshot);
	});
});
