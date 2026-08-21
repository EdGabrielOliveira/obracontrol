import { describe, expect, it } from "bun:test";
import {
	clampProgressRatio,
	normalizePercentage,
} from "../../../../../src/modules/construction-planning/bi/percent-utils";

describe("normalizePercentage", () => {
	it("keeps canonical fractional percentages unchanged", () => {
		expect(normalizePercentage(0)).toBe(0);
		expect(normalizePercentage(0.5)).toBe(0.5);
		expect(normalizePercentage(1)).toBe(1);
	});

	it("converts percent-like values above 1 through 100", () => {
		expect(normalizePercentage(1.5)).toBe(0.015);
		expect(normalizePercentage(50)).toBe(0.5);
		expect(normalizePercentage(100)).toBe(1);
	});

	it("rejects unsupported percentage values", () => {
		expect(() => normalizePercentage(-0.01)).toThrow("Percentual invalido");
		expect(() => normalizePercentage(100.01)).toThrow("Percentual invalido");
		expect(() => normalizePercentage(Number.NaN)).toThrow(
			"Percentual invalido",
		);
		expect(() => normalizePercentage(Number.POSITIVE_INFINITY)).toThrow(
			"Percentual invalido",
		);
	});
});

describe("clampProgressRatio", () => {
	it("clamps computed ratios without validating external scale", () => {
		expect(clampProgressRatio(-1)).toBe(0);
		expect(clampProgressRatio(0.4)).toBe(0.4);
		expect(clampProgressRatio(2)).toBe(1);
		expect(clampProgressRatio(Number.NaN)).toBe(0);
	});
});
