import { describe, expect, it } from "bun:test";
import {
	calculateContractAggregate,
	contractTotal,
} from "../../../../../src/modules/construction-planning/calculators/contract-calculator";

const contract = {
	id: "c-1",
	code: "CT-001",
	supplierName: "Fornecedor A",
	title: "Contrato principal",
	status: "EM_ANDAMENTO",
	contractValue: 100000,
};

const baseService = {
	id: "svc-1",
	description: "Servico 1",
	type: "ITEM",
	quantity: 100,
	unitCost: 1000,
	totalCost: 100000,
};

describe("contract calculator", () => {
	it("counts all measurements in totals", () => {
		const aggregate = calculateContractAggregate({
			contract,
			services: [baseService],
			measurements: [
				{
					id: "m-pending",
					date: new Date("2026-01-01"),
					number: 1,
					items: [{ serviceId: "svc-1", measuredPercentage: 100 }],
				},
				{
					id: "m-approved",
					date: new Date("2026-02-01"),
					number: 2,
					items: [{ serviceId: "svc-1", measuredPercentage: 25 }],
				},
			],
			payments: [],
		});

		expect(aggregate.totals.totalMeasured).toBe(25000);
		expect(aggregate.totals.measuredPercentage).toBe(25);
	});

	it("derives payment totals canonically", () => {
		const aggregate = calculateContractAggregate({
			contract,
			services: [],
			measurements: [],
			payments: [
				{
					id: "p-1",
					value: 10000,
					retentionValue: 300,
					discountValue: 100,
					paidValue: 9600,
					status: "PAGO",
				},
			],
		});

		expect(aggregate.totals.totalPaid).toBe(9600);
		expect(aggregate.totals.retentionTotal).toBe(300);
		expect(aggregate.totals.discountTotal).toBe(100);
	});

	it("computes per-service summaries", () => {
		const aggregate = calculateContractAggregate({
			contract,
			services: [baseService],
			measurements: [
				{
					id: "m1",
					date: new Date("2026-01-01"),
					number: 1,
					items: [
						{
							serviceId: "svc-1",
							accumulatedValue: 50000,
							accumulatedPercentage: 50,
						},
					],
				},
			],
			payments: [],
		});

		expect(aggregate.services).toHaveLength(1);
		expect(aggregate.services[0].measuredAccumulated).toBe(50000);
		expect(aggregate.services[0].measuredPercentage).toBe(50);
		expect(aggregate.services[0].balance).toBe(50000);
	});

	it("handles services with only quantity/unitCost (no totalCost)", () => {
		const svcNoTotal = {
			id: "svc-2",
			description: "Servico sem total",
			type: "ITEM",
			quantity: 50,
			unitCost: 250,
			totalCost: null,
		};

		const aggregate = calculateContractAggregate({
			contract,
			services: [svcNoTotal],
			measurements: [],
			payments: [],
		});

		expect(aggregate.services[0].contractValue).toBe(12500);
	});

	it("returns zero totals for empty contract", () => {
		const aggregate = calculateContractAggregate({
			contract: {
				id: "c-empty",
				code: "CT-000",
				supplierName: "Nenhum",
				title: null,
				status: "RASCUNHO",
				contractValue: 0,
			},
			services: [],
			measurements: [],
			payments: [],
		});

		expect(aggregate.totals.contractValue).toBe(0);
		expect(aggregate.totals.totalMeasured).toBe(0);
		expect(aggregate.totals.totalPaid).toBe(0);
	});
});

describe("contractTotal", () => {
	it("deriva o total com base + aditivo + reducao", () => {
		expect(
			contractTotal(100000, [
				{ kind: "ADITIVO", value: 15000 },
				{ kind: "ADITIVO", value: 5000 },
				{ kind: "REDUCAO", value: 2000 },
			]),
		).toBe(118000);
	});

	it("retorna a base quando nao ha aditivos", () => {
		expect(contractTotal(100000, [])).toBe(100000);
	});

	it("arredonda o total derivado para centavos (evita drift de float)", () => {
		expect(contractTotal(100.005, [{ kind: "ADITIVO", value: 0.005 }])).toBe(
			100.01,
		);
	});

	it("usa o total derivado no aggregate (saldo e percentuais)", () => {
		const aggregate = calculateContractAggregate({
			contract,
			services: [baseService],
			measurements: [
				{
					id: "m1",
					date: new Date("2026-01-01"),
					number: 1,
					items: [
						{
							serviceId: "svc-1",
							accumulatedValue: 50000,
							accumulatedPercentage: 50,
						},
					],
				},
			],
			payments: [
				{
					id: "p-1",
					value: 30000,
					retentionValue: 0,
					discountValue: 0,
					paidValue: 30000,
					status: "PAGO",
				},
			],
			amendments: [
				{ kind: "ADITIVO", value: 50000 },
				{ kind: "REDUCAO", value: 10000 },
			],
		});

		expect(aggregate.totals.contractValue).toBe(140000);
		expect(aggregate.totals.totalPaid).toBe(30000);
		expect(aggregate.totals.balance).toBe(110000);
		expect(aggregate.totals.measuredPercentage).toBeCloseTo(
			(50000 / 140000) * 100,
			6,
		);
	});
});
