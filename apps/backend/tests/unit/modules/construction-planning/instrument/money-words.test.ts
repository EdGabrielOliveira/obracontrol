import { describe, expect, it } from "bun:test";
import {
	moneyToPortuguese,
	numberToPortuguese,
} from "../../../../../src/modules/construction-planning/instrument/money-words";

describe("instrument money words", () => {
	it("converte reais e centavos para português", () => {
		expect(moneyToPortuguese(1)).toBe("um real");
		expect(moneyToPortuguese(10_000)).toBe("dez mil reais");
		expect(moneyToPortuguese(2_000.5)).toBe(
			"dois mil reais e cinquenta centavos",
		);
	});

	it("converte centenas e milhões", () => {
		expect(numberToPortuguese(100)).toBe("cem");
		expect(numberToPortuguese(1_000_001)).toBe("um milhão e um");
	});
});
