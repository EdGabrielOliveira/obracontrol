import { expect, test } from "bun:test";

import {
	formatDate,
	formatPercentage,
	formatRatioAsPercentage,
} from "@/utils/format";

test("formatRatioAsPercentage formats a 0..1 ratio as a percent", () => {
	expect(formatRatioAsPercentage(0.3498745468)).toBe("34,99%");
});

test("formatPercentage formats an operational 0..100 percentage point", () => {
	expect(formatPercentage(42)).toBe("42%");
});

test("percentage formatters render null and non-finite values safely", () => {
	expect(formatPercentage(null)).toBe("-");
	expect(formatRatioAsPercentage(undefined)).toBe("-");
	expect(formatPercentage(Number.NaN)).toBe("-");
	expect(formatRatioAsPercentage(Number.POSITIVE_INFINITY)).toBe("-");
});

test("formatDate returns a placeholder for invalid input", () => {
	expect(formatDate("not-a-date")).toBe("-");
});
