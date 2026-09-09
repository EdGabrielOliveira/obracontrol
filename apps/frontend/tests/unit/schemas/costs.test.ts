import { describe, expect, it } from "bun:test";
import { actualCostSchema, costSchema } from "@/schemas/costs";

const validCost = {
	title: "Custos da fundação",
	budgetVersionItemId: "version-item-1",
	costDate: "2026-09-09",
	category: "MATERIAL" as const,
	description: "Concreto",
	amount: "1.250,00",
	costType: "CURRENT" as const,
	paymentStatus: "OPEN" as const,
};

describe("actualCostSchema", () => {
	it("requires a title for manual cost creation", () => {
		expect(actualCostSchema.safeParse(validCost).success).toBe(true);
		expect(
			actualCostSchema.safeParse({ ...validCost, title: "   " }).success,
		).toBe(false);
	});
});

describe("costSchema", () => {
	it("groups one or more cost items under one required title", () => {
		expect(costSchema.safeParse({ title: "Fundação", items: [validCost] }).success).toBe(true);
		expect(costSchema.safeParse({ title: "Fundação", items: [] }).success).toBe(false);
		expect(costSchema.safeParse({ title: " ", items: [validCost] }).success).toBe(false);
	});
});
