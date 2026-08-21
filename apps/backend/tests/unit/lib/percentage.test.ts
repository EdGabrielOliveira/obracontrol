import { describe, expect, it } from "bun:test";
import { clampPercent100, toPercent100 } from "../../../src/lib/percentage";

describe("percentage helpers", () => {
	it("keeps normal 0-100 values", () => {
		expect(toPercent100(0)).toBe(0);
		expect(toPercent100(50)).toBe(50);
		expect(toPercent100(100)).toBe(100);
	});

	it("converts legacy fractional values", () => {
		expect(toPercent100(0.25)).toBe(25);
		expect(toPercent100(1)).toBe(1);
	});

	it("returns null for null/undefined/non-finite", () => {
		expect(toPercent100(null)).toBeNull();
		expect(toPercent100(undefined)).toBeNull();
		expect(toPercent100(Infinity)).toBeNull();
	});

	it("clamps display bounds", () => {
		expect(clampPercent100(-10)).toBe(0);
		expect(clampPercent100(120)).toBe(100);
	});
});
