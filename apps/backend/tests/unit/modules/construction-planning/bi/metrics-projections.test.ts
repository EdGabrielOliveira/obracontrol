import { describe, expect, it } from "bun:test";
import type { MetricMeasurementInput } from "../../../../../src/modules/construction-planning/bi/metrics-core";
import { calculateWorkMetrics } from "../../../../../src/modules/construction-planning/bi/metrics-core";

const work = {
	id: "w-proj",
	name: "Obra Projecoes",
	plannedStart: new Date("2026-01-01T00:00:00.000Z"),
	plannedEnd: new Date("2026-01-31T00:00:00.000Z"),
	baseDate: new Date("2026-01-15T00:00:00.000Z"),
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	lastImportAt: null,
};

const items = [
	{
		id: "item-1",
		parentId: null,
		index: "1.1",
		type: "ITEM",
		description: "Fundacoes",
		totalCost: 1000,
		plannedStart: null,
		plannedEnd: null,
		actualStart: null,
		actualEnd: null,
		completionPercentage: 0,
		computedStatus: "IN_PROGRESS",
		sortOrder: 1,
	},
];

const baselines = [
	{
		id: "baseline-1",
		budgetItemId: "item-1",
		budgetItemIndex: "1.1",
		plannedStart: new Date("2026-01-01T00:00:00.000Z"),
		plannedEnd: new Date("2026-01-31T00:00:00.000Z"),
	},
];

const measurements = [
	{
		id: "m1",
		budgetItemId: "item-1",
		budgetItemIndex: "1.1",
		measurementDate: new Date("2026-01-15T00:00:00.000Z"),
		measuredPercentageAccumulated: 0.5,
		measuredQuantityAccumulated: null,
	} satisfies MetricMeasurementInput,
];

const costs = [
	{
		id: "c1",
		budgetItemId: "item-1",
		budgetItemIndex: "1.1",
		costDate: new Date("2026-01-10T00:00:00.000Z"),
		amount: 400,
		costType: "CURRENT",
		category: "MATERIAL",
	},
];

describe("projecoes EVM em calculateWorkMetrics", () => {
	it("calcula EAC tipico e atipico, ETC, VAC e TCPI com dados completos", () => {
		const metrics = calculateWorkMetrics(
			work,
			items,
			baselines,
			measurements,
			costs,
		);

		expect(metrics.bac).toBe(1000);
		expect(metrics.eacTypical).toBeCloseTo(1000 / (500 / 400), 8);
		expect(metrics.eacAtypical).toBeCloseTo(
			400 + (1000 - 500) / (500 / 400),
			8,
		);
		expect(metrics.selectedEac).toBe(metrics.eacTypical);
		const selectedEac = metrics.selectedEac as number;
		expect(metrics.etc).toBeCloseTo(selectedEac - 400, 8);
		expect(metrics.vac).toBeCloseTo(1000 - selectedEac, 8);
		expect(metrics.tcpi).toBeCloseTo((1000 - 500) / (1000 - 400), 8);

		expect(metrics.indicators.bac.status).toBe("AVAILABLE");
		expect(metrics.indicators.bac.value).toBe(1000);
		expect(metrics.indicators.eacTypical.status).toBe("AVAILABLE");
		expect(metrics.indicators.eacTypical.formula).toBe("BAC / CPI");
		expect(metrics.indicators.eacAtypical.formula).toBe(
			"AC + (BAC - EV) / CPI",
		);
		expect(metrics.indicators.etc.formula).toBe("EAC selecionado - AC");
		expect(metrics.indicators.vac.formula).toBe("BAC - EAC selecionado");
		expect(metrics.indicators.tcpi.formula).toBe("(BAC - EV) / (BAC - AC)");
	});

	it("mantem BAC disponivel mesmo quando zero", () => {
		const metrics = calculateWorkMetrics(work, [], [], [], []);

		expect(metrics.bac).toBe(0);
		expect(metrics.indicators.bac.status).toBe("AVAILABLE");
		expect(metrics.indicators.bac.value).toBe(0);
	});

	it("marca EAC/ETC/VAC indisponiveis sem custos realizados e mantem TCPI", () => {
		const metrics = calculateWorkMetrics(
			work,
			items,
			baselines,
			measurements,
			[],
		);

		expect(metrics.eacTypical).toBeNull();
		expect(metrics.indicators.eacTypical.status).toBe("UNAVAILABLE");
		expect(metrics.indicators.eacTypical.unavailableReason).toContain(
			"Custos Realizados",
		);
		expect(metrics.indicators.eacAtypical.status).toBe("UNAVAILABLE");
		expect(metrics.indicators.selectedEac.status).toBe("UNAVAILABLE");
		expect(metrics.indicators.etc.status).toBe("UNAVAILABLE");
		expect(metrics.indicators.vac.status).toBe("UNAVAILABLE");

		expect(metrics.tcpi).toBeCloseTo(0.5, 8);
		expect(metrics.indicators.tcpi.status).toBe("AVAILABLE");
	});

	it("marca EAC indisponivel com motivo de medicao quando EV nao existe", () => {
		const metrics = calculateWorkMetrics(work, items, baselines, [], costs);

		expect(metrics.indicators.eacTypical.unavailableReason).toContain(
			"Medicoes",
		);
		expect(metrics.indicators.eacTypical.status).toBe("UNAVAILABLE");
		expect(metrics.indicators.tcpi.status).toBe("UNAVAILABLE");
		expect(metrics.indicators.tcpi.unavailableReason).toContain("Medicoes");
	});

	it("marca TCPI indisponivel quando BAC e igual a AC", () => {
		const metrics = calculateWorkMetrics(work, items, baselines, measurements, [
			{ ...costs[0], amount: 1000 },
		]);

		expect(metrics.tcpi).toBeNull();
		expect(metrics.indicators.tcpi.status).toBe("UNAVAILABLE");
		expect(metrics.indicators.tcpi.unavailableReason).toContain(
			"BAC - AC igual a zero",
		);
	});

	it("marca EAC indisponivel quando CPI e zero", () => {
		const metrics = calculateWorkMetrics(work, items, baselines, measurements, [
			{ ...costs[0], amount: 0 },
		]);

		expect(metrics.eacTypical).toBeNull();
		expect(metrics.indicators.eacTypical.unavailableReason).toContain(
			"CPI igual a zero",
		);
	});
});

import { buildMultiworksBI } from "../../../../../src/modules/construction-planning/bi/multiworks-builder";
import { buildWorkBIFromMetrics } from "../../../../../src/modules/construction-planning/bi/work-bi-builder";

describe("projecoes EVM nos contratos HTTP", () => {
	it("propaga projecoes no response da obra", () => {
		const metrics = calculateWorkMetrics(
			work,
			items,
			baselines,
			measurements,
			costs,
		);
		const response = buildWorkBIFromMetrics(work, metrics, {
			items: [],
			baselineSchedules: baselines,
			measurements,
			actualCosts: costs,
		});

		expect(response.summary.bac).toBe(1000);
		expect(response.summary.eacTypical).toBeCloseTo(800, 8);
		expect(response.summary.selectedEac).toBeCloseTo(800, 8);
		expect(response.summary.etc).toBeCloseTo(400, 8);
		expect(response.summary.vac).toBeCloseTo(200, 8);
		expect(response.summary.tcpi).toBeCloseTo(500 / 600, 8);
		expect(response.indicators.eacTypical.status).toBe("AVAILABLE");

		const auditKeys = response.calculationAudit.map((entry) => entry.key);
		expect(auditKeys).toEqual(
			expect.arrayContaining(["EAC", "ETC", "VAC", "TCPI"]),
		);
	});

	it("agrega totais de carteira apenas com valores disponiveis", () => {
		const multiworks = buildMultiworksBI([
			{
				...work,
				items,
				baselineSchedules: baselines,
				measurements,
				actualCosts: costs,
			},
			{
				...work,
				id: "w-sem-custos",
				items: [{ ...items[0], id: "item-2", index: "2.1" }],
				baselineSchedules: [
					{
						...baselines[0],
						budgetItemId: "item-2",
						budgetItemIndex: "2.1",
					},
				],
				measurements: [
					{
						...measurements[0],
						budgetItemId: "item-2",
						budgetItemIndex: "2.1",
					},
				],
				actualCosts: [],
			},
		]);

		expect(multiworks.cards.totalBac).toBe(2000);
		expect(multiworks.cards.totalEacTypical).toBeCloseTo(800, 8);
		expect(multiworks.cards.totalEacAtypical).toBeCloseTo(800, 8);
		expect(multiworks.cards.totalEtc).toBeCloseTo(400, 8);
		expect(multiworks.cards.totalVac).toBeCloseTo(200, 8);
		expect(multiworks.works[0].eacTypical).toBeCloseTo(800, 8);
		expect(multiworks.works[1].eacTypical).toBeNull();
		expect(multiworks.costsByWork[0].tcpi).toBeCloseTo(500 / 600, 8);
	});
});

describe("custos nao apropriados detalhados", () => {
	it("listagem detalhada inclui data, fornecedor, categoria e status", async () => {
		const { buildWorkBIFromMetrics } = await import(
			"../../../../../src/modules/construction-planning/bi/work-bi-builder"
		);
		const naoApropriado = {
			id: "nao-apropriado-1",
			budgetItemId: null,
			budgetItemIndex: null,
			costDate: new Date("2026-01-12T00:00:00.000Z"),
			amount: 250,
			costType: "CURRENT",
			category: "OUTROS",
			supplierName: "Fornecedor Z",
			paymentStatus: "OPEN",
		};
		const metrics = calculateWorkMetrics(work, items, baselines, measurements, [
			...costs,
			naoApropriado,
		]);
		const response = buildWorkBIFromMetrics(work, metrics, {
			items: [],
			baselineSchedules: baselines,
			measurements,
			actualCosts: [...costs, naoApropriado],
		});

		expect(response.unappropriatedCosts.items).toEqual([
			expect.objectContaining({
				amount: 250,
				costType: "CURRENT",
				supplierName: "Fornecedor Z",
				category: "OUTROS",
				paymentStatus: "OPEN",
				costDate: "2026-01-12T00:00:00.000Z",
			}),
		]);
	});
});
