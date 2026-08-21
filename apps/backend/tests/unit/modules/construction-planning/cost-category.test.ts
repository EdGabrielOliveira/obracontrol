import { describe, expect, it } from "bun:test";
import {
	actualCostCategorySchema,
	createActualCostSchema,
	updateActualCostSchema,
} from "../../../../src/modules/construction-planning/schema";

describe("canonical cost categories (COST-01)", () => {
	it("normalizes legacy labels to the closed enum", () => {
		expect(actualCostCategorySchema.parse("Material")).toBe("MATERIAL");
		expect(actualCostCategorySchema.parse("Mão de obra")).toBe("MAO_DE_OBRA");
	});

	it("rejects categories outside the canonical set", () => {
		expect(() => actualCostCategorySchema.parse("DESCONHECIDA")).toThrow();
	});

	it("requires future costs to remain open", () => {
		const result = createActualCostSchema.safeParse({
			costDate: "2026-01-20",
			budgetVersionItemId: "version-item-1",
			category: "MATERIAL",
			description: "Compra futura",
			amount: 100,
			costType: "FUTURE",
			paymentStatus: "PAID",
		});
		expect(result.success).toBe(false);
		expect(
			updateActualCostSchema.safeParse({
				costType: "FUTURE",
				paymentStatus: "PAID",
			}).success,
		).toBe(false);
	});
});
