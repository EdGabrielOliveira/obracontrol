import { describe, expect, it } from "bun:test";
import {
	contractEditFormSchema,
	contractFormSchema,
} from "@/schemas/contracts";

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

describe("contractEditFormSchema", () => {
	it("aceita os dados editáveis e o status do contrato", () => {
		const result = contractEditFormSchema.safeParse({
			title: "Contrato atualizado",
			serviceType: "Execução",
			objectDescription: "Serviços de fundação",
			startDate: "2026-01-01",
			endDate: "2026-12-31",
			status: "A_INICIAR",
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).not.toHaveProperty("contractValue");
			expect(result.data.status).toBe("A_INICIAR");
			expect(result.data).not.toHaveProperty("supplierId");
		}
	});

	it("exige uma descrição", () => {
		expect(
			contractEditFormSchema.safeParse({ objectDescription: "   " }).success,
		).toBe(false);
	});
});
