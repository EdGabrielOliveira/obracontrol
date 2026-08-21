import { describe, expect, it } from "bun:test";
import {
	createContractAmendmentSchema,
	createContractServiceSchema,
	createQuotationSchema,
	updateContractAmendmentSchema,
} from "../../../../../src/modules/construction-planning/schemas/contract.schema";

describe("contract command schemas", () => {
	it("requires at least one existing measurement when creating an amendment", () => {
		const result = createContractAmendmentSchema.safeParse({
			kind: "ADITIVO",
			value: 1000,
			reason: "Escopo adicional",
			date: "2026-08-06",
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.path).toEqual(["measurementIds"]);
		}
	});

	it("requires non-empty measurementIds when updating amendment links", () => {
		const result = updateContractAmendmentSchema.safeParse({
			measurementIds: [],
		});

		expect(result.success).toBe(false);
	});

	it("requires the budget item for a new contract service", () => {
		const result = createContractServiceSchema.safeParse({
			description: "Servico de pintura",
			quantity: 10,
			unitCost: 25,
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.path).toEqual(["budgetItemId"]);
		}
	});

	it("accepts a quotation with selected budget items and quantities", () => {
		const result = createQuotationSchema.safeParse({
			title: "Pintura",
			items: [{ budgetItemId: "budget-1", quantity: 120 }],
		});

		expect(result.success).toBe(true);
	});

	it("accepts a contract request without supplier or final value", () => {
		const result = createQuotationSchema.safeParse({
			serviceType: "Execucao",
			title: "Pintura",
			items: [{ budgetItemId: "budget-1", quantity: 10 }],
		});

		expect(result.success).toBe(true);
	});

	it("rejects a request without selected budget items", () => {
		const result = createQuotationSchema.safeParse({
			title: "Pintura",
			items: [],
		});

		expect(result.success).toBe(false);
	});

	it("rejects zero quantity and duplicated budget items", () => {
		const zeroQuantity = createQuotationSchema.safeParse({
			title: "Pintura",
			items: [{ budgetItemId: "budget-1", quantity: 0 }],
		});
		const duplicatedItems = createQuotationSchema.safeParse({
			title: "Pintura",
			items: [
				{ budgetItemId: "budget-1", quantity: 10 },
				{ budgetItemId: "budget-1", quantity: 20 },
			],
		});

		expect(zeroQuantity.success).toBe(false);
		expect(duplicatedItems.success).toBe(false);
	});
});
