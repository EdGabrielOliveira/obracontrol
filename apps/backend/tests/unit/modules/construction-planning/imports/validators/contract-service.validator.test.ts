import { describe, expect, it } from "bun:test";
import { normalizeContractServiceRows } from "../../../../../../src/modules/construction-planning/imports/validators/contract-measurement.validator";

describe("contract service import validation", () => {
	it("requires the budget index and does not trust manual type or unit", () => {
		const errors: never[] = [];
		const services = normalizeContractServiceRows(
			{
				serviceRows: [
					{
						rowNumber: 2,
						index: null,
						type: "ITEM",
						description: "Descricao manual",
						unit: "m2",
						quantity: 10,
						unitCost: 20,
						totalCost: 200,
					},
				],
			} as never,
			errors,
			[],
		);

		expect(services).toEqual([]);
		expect(errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "MISSING_REQUIRED_FIELD",
					field: "Indice",
				}),
			]),
		);
	});
});
