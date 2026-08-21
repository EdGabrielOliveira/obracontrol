import { describe, expect, it } from "bun:test";
import { contractMeasurementItemSchema } from "../../../../../src/modules/construction-planning/schemas/contract.schema";

describe("contract measurement coverage schema", () => {
	it("aceita cobertura opcional por quantidade", () => {
		const result = contractMeasurementItemSchema.parse({
			serviceId: "service-1",
			measuredQuantity: 5,
			coverages: [{ workMeasurementItemId: "work-item-1", quantity: 3 }],
		});

		expect(result.coverages).toEqual([
			{ workMeasurementItemId: "work-item-1", quantity: 3 },
		]);
	});
});
