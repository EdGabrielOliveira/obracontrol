import { describe, expect, it } from "bun:test";
import {
	createWorkMeasurementSchema,
	updateWorkMeasurementSchema,
} from "../../../../../src/modules/construction-planning/schemas/work-measurement.schema";

describe("quantity-first work measurement schemas", () => {
	it("accepts quantity input without derived fields", () => {
		expect(
			createWorkMeasurementSchema.parse({
				date: "2026-08-04",
				title: "Medicao 1",
				items: [{ budgetItemId: "item-1", measuredQuantity: 5 }],
			}),
		).toMatchObject({
			items: [{ budgetItemId: "item-1", measuredQuantity: 5 }],
		});
	});

	it("accepts percentage-only input for quantity derivation", () => {
		expect(
			createWorkMeasurementSchema.parse({
				date: "2026-08-04",
				title: "Medicao 1",
				items: [{ budgetItemId: "item-1", measuredPercentage: 25 }],
			}),
		).toMatchObject({
			items: [{ budgetItemId: "item-1", measuredPercentage: 25 }],
		});
	});

	it("rejects an item without quantity or percentage", () => {
		expect(() =>
			createWorkMeasurementSchema.parse({
				date: "2026-08-04",
				title: "Medicao 1",
				items: [{ budgetItemId: "item-1" }],
			}),
		).toThrow();
	});

	it("rejects client-provided derived values on create and update", () => {
		const item = {
			budgetItemId: "item-1",
			measuredQuantity: 5,
			measuredValue: 500,
		};

		expect(() =>
			createWorkMeasurementSchema.parse({
				date: "2026-08-04",
				title: "Medicao 1",
				items: [item],
			}),
		).toThrow();
		expect(() =>
			updateWorkMeasurementSchema.parse({ items: [item] }),
		).toThrow();
	});
});
