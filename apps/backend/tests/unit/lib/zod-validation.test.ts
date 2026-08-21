import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { ConstructionError } from "../../../src/lib/errors";
import {
	parseInput,
	parseQuery,
	throwInvalidInput,
} from "../../../src/lib/zod-validation";

describe("throwInvalidInput", () => {
	it("preserva campo, codigo e mensagem das issues do Zod", () => {
		const result = z
			.object({
				name: z.string().min(1),
			})
			.safeParse({ name: "" });

		if (result.success) throw new Error("A fixture deveria ser invalida");

		expect(() => throwInvalidInput(result.error)).toThrow(ConstructionError);
		try {
			throwInvalidInput(result.error);
		} catch (error) {
			expect(error).toBeInstanceOf(ConstructionError);
			const details = (error as ConstructionError).details;
			expect(details).toHaveLength(1);
			expect(details?.[0]?.field).toBe("name");
			expect(details?.[0]?.code).toBe("too_small");
			expect(details?.[0]?.message).toBeString();
		}
	});
});

describe("parseInput/parseQuery", () => {
	it("centraliza o parse de dominio e preserva o tipo", () => {
		const schema = z.object({ name: z.string().min(1) });
		expect(parseInput(schema, { name: "Obra" })).toEqual({ name: "Obra" });
		expect(() => parseInput(schema, { name: "" })).toThrow(ConstructionError);
	});

	it("usa mensagem de parametros para filtros", () => {
		const schema = z.object({ page: z.coerce.number().int().min(1) });
		expect(parseQuery(schema, { page: "2" })).toEqual({ page: 2 });
		expect(() => parseQuery(schema, { page: "0" })).toThrow(
			"Parametros invalidos",
		);
	});
});
