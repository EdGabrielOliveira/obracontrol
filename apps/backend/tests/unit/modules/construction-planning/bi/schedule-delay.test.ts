import { describe, expect, it } from "bun:test";
import { detectScheduleDelay } from "../../../../../src/modules/construction-planning/bi/schedule-delay";

const base = {
	plannedEnd: new Date("2026-12-31T00:00:00.000Z"),
	dataDate: new Date("2026-10-01T00:00:00.000Z"),
};

describe("detectScheduleDelay (ORC-006, DEC-006)", () => {
	it("nao sinaliza atraso quando SPI >= 1 e dentro do prazo", () => {
		const result = detectScheduleDelay({
			...base,
			spi: 1.1,
			scheduleVariance: 5000,
		});

		expect(result.delayed).toBe(false);
		expect(result.reason).toBeNull();
	});

	it("sinaliza atraso quando SPI abaixo de 1", () => {
		const result = detectScheduleDelay({
			...base,
			spi: 0.85,
			scheduleVariance: -2000,
		});

		expect(result.delayed).toBe(true);
		expect(result.reason).toContain("SPI");
	});

	it("sinaliza atraso por variance negativa mesmo sem SPI", () => {
		const result = detectScheduleDelay({
			...base,
			spi: null,
			scheduleVariance: -100,
		});

		expect(result.delayed).toBe(true);
		expect(result.reason).toContain("EV");
	});

	it("sinaliza atraso quando a data de corte passou do fim planejado", () => {
		const result = detectScheduleDelay({
			...base,
			spi: null,
			scheduleVariance: null,
			dataDate: new Date("2027-01-05T00:00:00.000Z"),
		});

		expect(result.delayed).toBe(true);
		expect(result.daysBehind).toBe(5);
		expect(result.reason).toContain("fim planejado");
	});

	it("SPI igual a 1 nao e atraso (igualdade nao dispara)", () => {
		const result = detectScheduleDelay({
			...base,
			spi: 1,
			scheduleVariance: 0,
		});

		expect(result.delayed).toBe(false);
	});

	it("dados ausentes nao disparam alerta (sem dados nao se inventa atraso)", () => {
		const result = detectScheduleDelay({
			spi: null,
			scheduleVariance: null,
			plannedEnd: null,
			dataDate: null,
		});

		expect(result.delayed).toBe(false);
		expect(result.daysBehind).toBeNull();
	});
});
