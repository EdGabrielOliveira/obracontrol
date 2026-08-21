import { describe, expect, it } from "bun:test";
import {
	budgetItemIndexSchema,
	createBudgetItemSchema,
	updateBudgetItemSchema,
} from "../../../../../src/modules/construction-planning/schemas/budget.schema";

function validItem(index: string) {
	return {
		index,
		type: "ITEM",
		description: "Servico de fundacao",
	};
}

describe("budgetItemIndexSchema - indice EAP de tres niveis", () => {
	it("aceita indices de 1 a 3 niveis numericos", () => {
		for (const index of ["1", "1.1", "1.1.1", "10", "10.2", "99.99.99"]) {
			expect(budgetItemIndexSchema.safeParse(index).success).toBe(true);
		}
	});

	it("rejeita mais de tres niveis", () => {
		for (const index of ["1.1.1.1", "1.2.3.4.5"]) {
			const parsed = budgetItemIndexSchema.safeParse(index);
			expect(parsed.success).toBe(false);
		}
	});

	it("rejeita formato nao numerico", () => {
		for (const index of [
			"",
			"a",
			"1.a",
			"1..1",
			".1",
			"1.",
			"1 1",
			"1.1.1.1a",
		]) {
			expect(budgetItemIndexSchema.safeParse(index).success).toBe(false);
		}
	});
});

describe("createBudgetItemSchema - indice", () => {
	it("aceita item valido com indice de tres niveis", () => {
		const parsed = createBudgetItemSchema.safeParse(validItem("1.1.1"));
		expect(parsed.success).toBe(true);
	});

	it("rejeita item com indice de quatro niveis", () => {
		const parsed = createBudgetItemSchema.safeParse(validItem("1.1.1.1"));
		expect(parsed.success).toBe(false);
		if (!parsed.success) {
			expect(parsed.error.issues[0].path).toEqual(["index"]);
			expect(parsed.error.issues[0].message).toContain("3 niveis");
		}
	});

	it("rejeita indice com letras", () => {
		const parsed = createBudgetItemSchema.safeParse(validItem("1.1a"));
		expect(parsed.success).toBe(false);
	});
});

describe("updateBudgetItemSchema - indice", () => {
	it("aceita atualizacao com indice valido", () => {
		const parsed = updateBudgetItemSchema.safeParse({ index: "1.2" });
		expect(parsed.success).toBe(true);
	});

	it("rejeita atualizacao com indice invalido", () => {
		const parsed = updateBudgetItemSchema.safeParse({ index: "1.2.3.4" });
		expect(parsed.success).toBe(false);
	});
});
