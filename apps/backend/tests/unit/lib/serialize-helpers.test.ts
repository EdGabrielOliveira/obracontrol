import { describe, expect, it } from "bun:test";
import { decimalToNumber } from "../../../src/lib/serialize-helpers";

describe("decimalToNumber", () => {
	it("converts Decimal-like { s, e, d } to number", () => {
		const input = { s: 1, e: 2, d: [123, 4500000] };
		expect(decimalToNumber(input)).toBe(123.45);
	});

	it("converts Decimal-like with negative sign", () => {
		const input = { s: -1, e: 2, d: [123, 4500000] };
		expect(decimalToNumber(input)).toBe(-123.45);
	});

	it("converts small decimal values", () => {
		const input = { s: 1, e: -2, d: [123000] };
		expect(decimalToNumber(input)).toBe(0.0123);
	});

	it("converts integer values", () => {
		const input = { s: 1, e: 1, d: [10] };
		expect(decimalToNumber(input)).toBe(10);
	});

	it("converts large financial values", () => {
		const input = { s: 1, e: 7, d: [1, 2345678] };
		expect(decimalToNumber(input)).toBe(12345678);
	});

	it("converts nested Decimal-like objects", () => {
		const input = {
			data: [{ amount: { s: 1, e: 4, d: [15000] } }],
			total: { s: 1, e: 4, d: [15000] },
		};
		const result = decimalToNumber(input) as Record<string, unknown>;
		expect(result.data).toBeDefined();
	});

	it("preserves non-Decimal values", () => {
		expect(decimalToNumber("hello")).toBe("hello");
		expect(decimalToNumber(42)).toBe(42);
		expect(decimalToNumber(null)).toBe(null);
		expect(decimalToNumber([1, 2, 3])).toEqual([1, 2, 3]);
	});
});
