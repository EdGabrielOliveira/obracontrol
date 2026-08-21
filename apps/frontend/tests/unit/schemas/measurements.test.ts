import { describe, expect, it } from "bun:test";
import { measurementCreateSchema, measurementEditSchema } from "@/schemas/measurements";

const baseCreate = {
	date: "2026-08-04",
	title: "Medição 1",
	items: [{ budgetItemId: "item-1", measuredQuantity: "10" }],
};

const baseEdit = {
	date: "2026-08-04",
	title: "Medição 1",
	items: [{ id: "wmi-1", budgetItemId: "item-1", measuredQuantity: "10" }],
};

describe("measurement schemas", () => {
	it("aceita medição sem override", () => {
		expect(measurementCreateSchema.safeParse(baseCreate).success).toBe(true);
	});

	it("aceita override com nota de evidencia", () => {
		expect(
			measurementCreateSchema.safeParse({
				...baseCreate,
				balanceOverride: true,
				evidenceNote: "Execução extraordinária aprovada em reunião",
			}).success,
		).toBe(true);
	});

	it("rejeita override sem nota de evidência na criação e edição", () => {
		expect(
			measurementCreateSchema.safeParse({
				...baseCreate,
				balanceOverride: true,
			}).success,
		).toBe(false);
		expect(
			measurementEditSchema.safeParse({ ...baseEdit, balanceOverride: true })
				.success,
		).toBe(false);
	});
});
