import { describe, expect, it } from "bun:test";
import {
	assertInstrumentReady,
	assessInstrumentReadiness,
} from "../../../../../src/modules/construction-planning/instrument/instrument-readiness";

const readyInput = {
	hasDocxTemplate: true,
	templateIsValid: true,
	hasSupplier: true,
	objectDescription: "Execução de fundações.",
	supplier: {
		name: "Fornecedor A Ltda.",
		document: "12.345.678/0001-95",
		responsibleName: "Ana Silva",
		responsibleDocument: "529.982.247-25",
		hasCompleteAddress: true,
		contact: "ana@fornecedor.com.br",
	},
	workAddress: "Rua B, 20, Campinas/SP",
};

describe("instrument readiness", () => {
	it("reports every missing requirement instead of stopping at the first one", () => {
		const readiness = assessInstrumentReadiness({
			...readyInput,
			hasDocxTemplate: false,
			templateIsValid: false,
			hasSupplier: false,
			objectDescription: null,
			supplier: null,
			workAddress: null,
		});

		expect(readiness.ready).toBe(false);
		expect(
			readiness.requirements.filter((item) => !item.complete),
		).toHaveLength(9);
		expect(() => assertInstrumentReady(readiness)).toThrow(
			"Preencha os dados obrigatórios",
		);
	});

	it("marks a complete instrument ready to generate", () => {
		expect(assessInstrumentReadiness(readyInput).ready).toBe(true);
	});

	it("requires a complete supplier address", () => {
		const readiness = assessInstrumentReadiness({
			...readyInput,
			supplier: { ...readyInput.supplier, hasCompleteAddress: false },
		});

		expect(
			readiness.requirements.find(
				(item) => item.code === "SUPPLIER_ADDRESS_REQUIRED",
			)?.complete,
		).toBe(false);
	});

	it("requires the supplier company name and a CNPJ", () => {
		const readiness = assessInstrumentReadiness({
			...readyInput,
			supplier: {
				...readyInput.supplier,
				name: "",
				document: "529.982.247-25",
			},
		});

		expect(
			readiness.requirements.find(
				(item) => item.code === "SUPPLIER_NAME_REQUIRED",
			)?.complete,
		).toBe(false);
		expect(
			readiness.requirements.find(
				(item) => item.code === "SUPPLIER_DOCUMENT_REQUIRED",
			)?.complete,
		).toBe(false);
	});
});
