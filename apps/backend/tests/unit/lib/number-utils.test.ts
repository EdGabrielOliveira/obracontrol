import { describe, expect, it } from "bun:test";
import Decimal from "decimal.js";
import {
	assertJsonFinancialSafe,
	decimalLikeToNumber,
	isDecimalLike,
	toFiniteNumber,
	toNullableNumber,
} from "../../../src/lib/number-utils";

describe("isDecimalLike", () => {
	it("detects Decimal instances", () => {
		expect(isDecimalLike(new Decimal("123.45"))).toBe(true);
	});

	it("detects Decimal-like objects", () => {
		expect(isDecimalLike({ s: 1, e: 2, d: [123, 4500000] })).toBe(true);
	});

	it("rejects plain numbers", () => {
		expect(isDecimalLike(42)).toBe(false);
		expect(isDecimalLike(0)).toBe(false);
	});

	it("rejects null and undefined", () => {
		expect(isDecimalLike(null)).toBe(false);
		expect(isDecimalLike(undefined)).toBe(false);
	});

	it("rejects strings", () => {
		expect(isDecimalLike("hello")).toBe(false);
	});
});

describe("decimalLikeToNumber", () => {
	it("converts Prisma Decimal", () => {
		expect(decimalLikeToNumber(new Decimal("176000.25"))).toBe(176000.25);
	});

	it("converts Decimal-like objects", () => {
		expect(decimalLikeToNumber({ s: 1, e: 5, d: [176000] })).toBe(176000);
		expect(decimalLikeToNumber({ s: 1, e: -1, d: [2500000] })).toBe(0.25);
		expect(decimalLikeToNumber({ s: 1, e: 0, d: [0] })).toBe(0);
	});

	it("converts negative Decimal-like objects", () => {
		expect(decimalLikeToNumber({ s: -1, e: 2, d: [500] })).toBe(-500);
	});
});

describe("toFiniteNumber", () => {
	it("converts Decimal and Decimal-like objects", () => {
		expect(toFiniteNumber(new Decimal("176000.25"))).toBe(176000.25);
		expect(toFiniteNumber({ s: 1, e: 5, d: [176000] })).toBe(176000);
		expect(toFiniteNumber({ s: 1, e: -1, d: [2500000] })).toBe(0.25);
	});

	it("converts plain numbers", () => {
		expect(toFiniteNumber(42)).toBe(42);
		expect(toFiniteNumber(0)).toBe(0);
		expect(toFiniteNumber(-5.5)).toBe(-5.5);
	});

	it("converts numeric strings", () => {
		expect(toFiniteNumber("42")).toBe(42);
	});

	it("uses fallback for null/undefined", () => {
		expect(toFiniteNumber(null)).toBe(0);
		expect(toFiniteNumber(undefined)).toBe(0);
		expect(toFiniteNumber(null, -1)).toBe(-1);
	});

	it("converts empty string to fallback", () => {
		expect(toFiniteNumber("")).toBe(0);
	});
});

describe("toNullableNumber", () => {
	it("converts valid values to numbers", () => {
		expect(toNullableNumber(42)).toBe(42);
		expect(toNullableNumber(new Decimal("100"))).toBe(100);
	});

	it("returns null for null/undefined", () => {
		expect(toNullableNumber(null)).toBeNull();
		expect(toNullableNumber(undefined)).toBeNull();
	});

	it("returns null for empty string", () => {
		expect(toNullableNumber("")).toBeNull();
	});
});

describe("assertJsonFinancialSafe", () => {
	it("throws for Decimal-like objects", () => {
		expect(() =>
			assertJsonFinancialSafe({ totalCost: { s: 1, e: 5, d: [176000] } }),
		).toThrow("Decimal-like object leaked");
	});

	it("throws for Decimal instances", () => {
		expect(() =>
			assertJsonFinancialSafe({ totalCost: new Decimal("15000") }),
		).toThrow("Decimal-like object leaked");
	});

	it("passes for plain numbers", () => {
		expect(() =>
			assertJsonFinancialSafe({ totalCost: 15000, name: "test" }),
		).not.toThrow();
	});

	it("passes for null", () => {
		expect(() => assertJsonFinancialSafe(null)).not.toThrow();
	});

	it("passes for arrays of plain values", () => {
		expect(() =>
			assertJsonFinancialSafe([{ id: "1", value: 100 }]),
		).not.toThrow();
	});
});
