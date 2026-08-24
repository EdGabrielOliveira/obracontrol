import { describe, expect, it } from "bun:test";
import { supplierImportDefaults } from "@/lib/supplier-import-defaults";

describe("supplierImportDefaults", () => {
	it("preenche o cadastro com todos os dados disponíveis no mapa", () => {
		const defaults = supplierImportDefaults({
			name: "Construtora Modelo Ltda.",
			document: "11.222.333/0001-81",
			address: "Rua das Flores, 123",
			phone: "(11) 99999-9999",
			email: "contato@modelo.com",
			responsibleName: "Maria Silva",
		});

		expect(defaults).toMatchObject({
			name: "Construtora Modelo Ltda.",
			document: "11.222.333/0001-81",
			responsibleName: "Maria Silva",
			contact: "(11) 99999-9999 · contato@modelo.com",
			structuredAddress: { street: "Rua das Flores, 123" },
		});
	});
});
