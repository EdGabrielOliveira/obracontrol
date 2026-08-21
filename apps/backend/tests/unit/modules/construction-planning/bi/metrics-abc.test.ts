import { describe, expect, it } from "bun:test";
import { buildAbcAnalysis } from "../../../../../src/modules/construction-planning/bi/metrics-financial";

describe("buildAbcAnalysis", () => {
	const suppliers = [
		{
			supplierName: "A",
			totalAmount: 500,
			paidAmount: 500,
			openAmount: 0,
			percentage: 0.5,
		},
		{
			supplierName: "B",
			totalAmount: 350,
			paidAmount: 0,
			openAmount: 350,
			percentage: 0.35,
		},
		{
			supplierName: "C",
			totalAmount: 100,
			paidAmount: 0,
			openAmount: 100,
			percentage: 0.1,
		},
		{
			supplierName: "D",
			totalAmount: 50,
			paidAmount: 0,
			openAmount: 50,
			percentage: 0.05,
		},
	];

	it("classifica A/B/C pela acumulada antes da linha (80/95)", () => {
		const result = buildAbcAnalysis(suppliers, 1000);

		expect(result).toEqual([
			{
				supplierName: "A",
				totalAmount: 500,
				percentage: 0.5,
				accumulatedPercentage: 0.5,
				abcClass: "A",
			},
			{
				supplierName: "B",
				totalAmount: 350,
				percentage: 0.35,
				accumulatedPercentage: 0.85,
				abcClass: "A",
			},
			{
				supplierName: "C",
				totalAmount: 100,
				percentage: 0.1,
				accumulatedPercentage: 0.95,
				abcClass: "B",
			},
			{
				supplierName: "D",
				totalAmount: 50,
				percentage: 0.05,
				accumulatedPercentage: 1,
				abcClass: "C",
			},
		]);
	});

	it("fornecedor que cruza 80% fica na classe iniciada antes dele", () => {
		const result = buildAbcAnalysis(
			[
				{
					supplierName: "X",
					totalAmount: 900,
					paidAmount: 0,
					openAmount: 0,
					percentage: 0.9,
				},
				{
					supplierName: "Y",
					totalAmount: 100,
					paidAmount: 0,
					openAmount: 0,
					percentage: 0.1,
				},
			],
			1000,
		);

		expect(result[0].abcClass).toBe("A");
		expect(result[1].abcClass).toBe("B");
	});

	it("retorna lista vazia sem fornecedores e trata participacao zero", () => {
		expect(buildAbcAnalysis([], 0)).toEqual([]);
		expect(
			buildAbcAnalysis(
				[
					{
						supplierName: "S",
						totalAmount: 0,
						paidAmount: 0,
						openAmount: 0,
						percentage: 0,
					},
				],
				0,
			),
		).toEqual([
			{
				supplierName: "S",
				totalAmount: 0,
				percentage: 0,
				accumulatedPercentage: 0,
				abcClass: "A",
			},
		]);
	});
});
