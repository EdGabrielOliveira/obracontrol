import { describe, expect, it } from "bun:test";
import Decimal from "decimal.js";
import { calculateQuotationSemaphore } from "../../../../src/modules/construction-planning/quotation-comparison";

describe("quotation semaphore (CON-04)", () => {
	it("uses the approved 0% and 5% boundaries", () => {
		expect(
			calculateQuotationSemaphore(new Decimal(100), new Decimal(100)),
		).toMatchObject({
			status: "GREEN",
			variancePercent: 0,
		});
		expect(calculateQuotationSemaphore(100, 105)).toMatchObject({
			status: "YELLOW",
			variancePercent: 5,
		});
		expect(calculateQuotationSemaphore(100, 105.01).status).toBe("RED");
	});

	it("returns null percentages for zero or negative budgets", () => {
		expect(calculateQuotationSemaphore(0, 10)).toEqual({
			status: "UNAVAILABLE",
			budgetTotal: null,
			varianceAmount: null,
			variancePercent: null,
			limitPercent: 5,
		});
	});
});
