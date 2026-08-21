import { describe, expect, it } from "bun:test";
import {
	normalizeDate,
	normalizeNumberField,
} from "../../../../../src/modules/construction-planning/imports/normalizers";
import type { ImportValidationError } from "../../../../../src/modules/construction-planning/types";

describe("normalizeDate", () => {
	it("converts Excel serial dates even when serialized as numeric text", () => {
		expect(normalizeDate("46405")?.toISOString()).toBe(
			"2027-01-18T00:00:00.000Z",
		);
	});

	it("unwraps Prisma DateTime JSON values", () => {
		expect(
			normalizeDate({
				$type: "DateTime",
				value: "2027-01-01T03:00:00.000Z",
			})?.toISOString(),
		).toBe("2027-01-01T00:00:00.000Z");
	});
});

describe("normalizeNumberField", () => {
	it("preserves source formula errors as explicit validation errors", () => {
		const errors: ImportValidationError[] = [];

		expect(
			normalizeNumberField(
				errors,
				"Custos Realizados",
				12,
				"Valor realizado",
				"#N/A",
			),
		).toBeNull();
		expect(errors).toEqual([
			{
				sheet: "Custos Realizados",
				row: 12,
				field: "Valor realizado",
				code: "SOURCE_FORMULA_ERROR",
				message: "Valor de erro da fonte não pode ser convertido em número",
			},
		]);
	});

	it("keeps legitimate zero and negative numbers as numbers", () => {
		const errors: ImportValidationError[] = [];

		expect(normalizeNumberField(errors, "Teste", 1, "Valor", 0)).toBe(0);
		expect(normalizeNumberField(errors, "Teste", 2, "Valor", -15)).toBe(-15);
		expect(errors).toEqual([]);
	});
});
