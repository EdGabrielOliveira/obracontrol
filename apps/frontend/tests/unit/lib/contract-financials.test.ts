import { describe, expect, it } from "bun:test";
import {
	calculateBillingPercentage,
	calculateContractPlannedTotal,
} from "@/utils/contract-financials";

describe("contract financial calculations", () => {
	it("uses contracted quantity times unit cost", () => {
		expect(
			calculateContractPlannedTotal([
				{
					quantity: 1_500,
					unitCost: 64.88,
					totalCost: 121_908.22,
				},
				{ quantity: 300, unitCost: 12.35, totalCost: 5_085.14 },
			]),
		).toBeCloseTo(101_025, 8);
	});

	it("uses the budget unit cost when the service unit cost is absent", () => {
		expect(
			calculateContractPlannedTotal([
				{
					quantity: 50,
					budgetItem: { unitCost: 25.06, totalCost: 3_582.58 },
				},
			]),
		).toBeCloseTo(1_253, 8);
	});

	it("prefers the linked budget item unit cost", () => {
		expect(
			calculateContractPlannedTotal([
				{
					quantity: 10,
					unitCost: 999,
					budgetItem: { unitCost: 25 },
				},
			]),
		).toBe(250);
	});

	it("does not use the original total when quantity or unit cost is absent", () => {
		expect(
			calculateContractPlannedTotal([
				{ totalCost: 100 },
				{ quantity: null, unitCost: null, budgetItem: { totalCost: 25 } },
			]),
		).toBe(0);
	});

	it("returns no percentage for a zero planned total", () => {
		expect(calculateBillingPercentage(87_000, 0)).toBeNull();
	});

	it("calculates negotiated value as a percentage of planned total", () => {
		expect(calculateBillingPercentage(87_000, 130_575.94)).toBeCloseTo(
		66.628,
		3,
	);
	});
});
