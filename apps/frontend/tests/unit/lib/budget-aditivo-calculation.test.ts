import { describe, expect, test } from "bun:test";
import {
	calculateBudgetItemDelta,
	calculateBudgetItemTotal,
	parseBudgetInputNumber,
} from "@/lib/budget-aditivo-calculation";

describe("budget aditivo calculations", () => {
	test("preserves empty inputs as null", () => {
		expect(parseBudgetInputNumber("")).toBeNull();
		expect(calculateBudgetItemTotal("", "10")).toBeNull();
		expect(calculateBudgetItemDelta("", 10)).toBeNull();
	});

	test("calculates preview totals and deltas consistently", () => {
		expect(calculateBudgetItemTotal("2.5", "10.4")).toBe(26);
		expect(calculateBudgetItemDelta("26", 20)).toBe(6);
	});
});
