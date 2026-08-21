import { describe, expect, it } from "bun:test";
import { contractFormSchema } from "@/schemas/contracts";

const validBase = {
	code: "CT-001",
	contractValue: 50000,
	objectDescription: "Execução de serviços de obra",
};

describe("contractFormSchema", () => {
	it("aceita contrato com supplierId ou supplierName", () => {
		expect(
			contractFormSchema.safeParse({ ...validBase, supplierId: "sup-1" })
				.success,
		).toBe(true);
		expect(
			contractFormSchema.safeParse({
				...validBase,
				supplierName: "Fornecedor A",
			}).success,
		).toBe(true);
	});

	it("rejeita contrato sem fornecedor e valor nao positivo", () => {
		expect(contractFormSchema.safeParse(validBase).success).toBe(false);
		for (const value of [0, -10]) {
			expect(
				contractFormSchema.safeParse({
					...validBase,
					supplierName: "Fornecedor A",
					contractValue: value,
				}).success,
			).toBe(false);
		}
	});

	it("converte valor monetário textual e valida status", () => {
		const parsed = contractFormSchema.safeParse({
			...validBase,
			supplierName: "Fornecedor A",
			contractValue: "50000",
			status: "EM_ANDAMENTO",
		});
		expect(parsed.success).toBe(true);
		if (parsed.success) expect(parsed.data.contractValue).toBe(50000);
		expect(
			contractFormSchema.safeParse({
				...validBase,
				supplierName: "Fornecedor A",
				status: "INVALIDO",
			}).success,
		).toBe(false);
	});
});
