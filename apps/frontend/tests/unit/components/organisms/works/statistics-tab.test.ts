import { describe, expect, it } from "bun:test";
import { hasPhysicalFinancialPeriods } from "@/components/organisms/works/statistics-tab";

describe("hasPhysicalFinancialPeriods", () => {
	it("keeps the planned chart available without detailed movements", () => {
		expect(hasPhysicalFinancialPeriods({ months: ["2026-06"] })).toBe(true);
	});

	it("returns false only when the schedule has no periods", () => {
		expect(hasPhysicalFinancialPeriods({ months: [] })).toBe(false);
		expect(hasPhysicalFinancialPeriods(undefined)).toBe(false);
	});
});
