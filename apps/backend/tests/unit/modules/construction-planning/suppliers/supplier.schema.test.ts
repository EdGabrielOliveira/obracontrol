import { describe, expect, it } from "bun:test";
import { createSupplierSchema } from "../../../../../src/modules/construction-planning/suppliers/supplier.schema";

describe("supplier schema", () => {
	it("aceita dados bancarios, PIX e endereco", () => {
		const result = createSupplierSchema.parse({
			name: "Fornecedor A",
			document: "12.345.678/0001-90",
			pixKey: "financeiro@fornecedor.com",
			pixKeyType: "EMAIL",
			bankCode: "001",
			bankName: "Banco do Brasil",
			bankBranch: "1234",
			bankAccount: "56789-0",
			bankAccountType: "CHECKING",
			addressZipCode: "01310-100",
			addressStreet: "Avenida Paulista",
			addressNumber: "1000",
			addressCity: "Sao Paulo",
			addressState: "sp",
		});

		expect(result).toMatchObject({
			pixKeyType: "EMAIL",
			bankAccountType: "CHECKING",
			addressState: "sp",
		});
	});

	it("rejeita tipo PIX desconhecido", () => {
		const result = createSupplierSchema.safeParse({
			name: "Fornecedor A",
			pixKey: "chave",
			pixKeyType: "UNKNOWN",
		});

		expect(result.success).toBe(false);
	});

	it("aceita responsável legal e CPF para instrumento", () => {
		const result = createSupplierSchema.safeParse({
			name: "Fornecedor A",
			responsibleName: "João da Silva",
			responsibleDocument: "529.982.247-25",
		});
		expect(result.success).toBe(true);
	});
});
