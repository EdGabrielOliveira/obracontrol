import { describe, expect, test } from "bun:test";
import {
	formatAllocationBasis,
	toActualCostAllocationPayload,
	validateDraftAllocations,
} from "@/lib/actual-cost-allocations";

describe("actual cost allocations", () => {
	test("accepts percentage allocations only when they close at 100%", () => {
		expect(
			validateDraftAllocations([
				{ budgetItemId: "a", percentage: "40" },
				{ budgetItemId: "b", percentage: "60" },
			]),
		).toMatchObject({ valid: true, totalPercentage: 100 });

		expect(
			validateDraftAllocations([
				{ budgetItemId: "a", percentage: "40" },
				{ budgetItemId: "b", percentage: "50" },
			]),
		).toMatchObject({ valid: false, totalPercentage: 90 });
	});

	test("accepts value allocations only when they match the cost total", () => {
		expect(
			validateDraftAllocations(
				[
					{ budgetItemId: "a", value: "R$ 40,00" },
					{ budgetItemId: "b", value: "60,00" },
				],
				100,
			),
		).toMatchObject({ valid: true, valueTotal: 100 });
	});

	test("rejects duplicate items and mixed allocation bases", () => {
		expect(
			validateDraftAllocations([
				{ budgetItemId: "a", percentage: 50 },
				{ budgetItemId: "a", percentage: 50 },
			]),
		).toMatchObject({ valid: false });

		expect(
			validateDraftAllocations([
				{ budgetItemId: "a", percentage: 50 },
				{ budgetItemId: "b", value: 50 },
			]),
		).toMatchObject({ valid: false });
	});

	test("normalizes the payload and presents a readable basis", () => {
		expect(
			toActualCostAllocationPayload([
				{ budgetItemId: " a ", percentage: "25,5" },
			]),
		).toEqual([{ budgetItemId: "a", percentage: 25.5 }]);
		expect(formatAllocationBasis({ percentage: 25, value: 250 })).toContain("25.0%");
	});
});
