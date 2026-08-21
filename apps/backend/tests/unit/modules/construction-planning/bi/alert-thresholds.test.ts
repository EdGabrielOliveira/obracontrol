import { describe, expect, it } from "bun:test";
import { evaluateThresholds } from "../../../../../src/modules/construction-planning/bi/alert-thresholds";

describe("evaluateThresholds (BI-003) - alertas por limiar", () => {
	it("dispara alerta quando o valor esta abaixo do limiar", () => {
		const alerts = evaluateThresholds({ SPI: 0.85 });

		expect(alerts).toContainEqual(
			expect.objectContaining({
				code: "SPI_BELOW",
				severity: "HIGH",
				metric: "SPI",
				value: 0.85,
				direction: "below",
			}),
		);
	});

	it("nao dispara alerta quando o valor e igual ao limiar", () => {
		const alerts = evaluateThresholds({ SPI: 0.9 });

		expect(alerts).not.toContainEqual(
			expect.objectContaining({ code: "SPI_BELOW" }),
		);
	});

	it("nao dispara alerta quando o valor esta acima do limiar", () => {
		const alerts = evaluateThresholds({ SPI: 1.1 });

		expect(alerts).toHaveLength(0);
	});

	it("dispara alerta quando o valor esta acima do limiar (direcao above)", () => {
		const alerts = evaluateThresholds({ EAC: 1.2 });

		expect(alerts).toContainEqual(
			expect.objectContaining({
				code: "EAC_OVER_BUDGET",
				severity: "LOW",
				metric: "EAC",
				value: 1.2,
				direction: "above",
			}),
		);
	});

	it("ignora valores ausentes, nulos ou nao finitos", () => {
		const alerts = evaluateThresholds({
			SPI: null,
			CPI: undefined,
			EAC: Number.NaN,
		});

		expect(alerts).toHaveLength(0);
	});

	it("avalia multiplas regras e ordena pela ordem das regras", () => {
		const alerts = evaluateThresholds({ SPI: 0.8, CPI: 0.85 });

		expect(alerts.map((a) => a.code)).toEqual([
			"SPI_BELOW",
			"CPI_BELOW",
			"CPI_WARNING",
		]);
	});

	it("CPI entre 0,90 e 1,00 dispara apenas o alerta de atencao", () => {
		const alerts = evaluateThresholds({ CPI: 0.95 });

		expect(alerts.map((a) => a.code)).toEqual(["CPI_WARNING"]);
	});

	it("valores acima de 1 nao disparam alertas de custo", () => {
		const alerts = evaluateThresholds({ CPI: 1.05 });

		expect(alerts).toHaveLength(0);
	});
});
