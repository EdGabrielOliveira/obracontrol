import { describe, expect, it } from "bun:test";
import Decimal from "decimal.js";
import { toNum } from "../../../src/lib/decimal-utils";
import {
	toFiniteNumber,
	toNullableNumber,
} from "../../../src/lib/number-utils";
import { decimalToNumber } from "../../../src/lib/serialize-helpers";

describe("financial value regression", () => {
	it("converts budget quantity and totalCost correctly", () => {
		const budgetItem = {
			id: "item-1",
			index: "1.1",
			quantity: { s: 1, e: 2, d: [100] },
			totalCost: { s: 1, e: 4, d: [15000] },
		};
		expect(decimalToNumber(budgetItem.quantity)).toBe(100);
		expect(decimalToNumber(budgetItem.totalCost)).toBe(15000);
	});

	it("converts contract service values", () => {
		const service = {
			quantity: { s: 1, e: 1, d: [50] },
			unitCost: { s: 1, e: 2, d: [250] },
			totalCost: { s: 1, e: 4, d: [12500] },
		};
		expect(decimalToNumber(service.quantity)).toBe(50);
		expect(decimalToNumber(service.unitCost)).toBe(250);
		expect(decimalToNumber(service.totalCost)).toBe(12500);
	});

	it("converts payment values with retention", () => {
		const payment = {
			amount: { s: 1, e: 4, d: [10000] },
			retention: { s: 1, e: 2, d: [300] },
			discount: { s: 1, e: 2, d: [100] },
			netAmount: { s: 1, e: 3, d: [9600] },
		};
		expect(decimalToNumber(payment.amount)).toBe(10000);
		expect(decimalToNumber(payment.retention)).toBe(300);
		expect(decimalToNumber(payment.discount)).toBe(100);
		expect(decimalToNumber(payment.netAmount)).toBe(9600);
	});

	it("converts measurement values with decimal precision", () => {
		const measurement = {
			measuredQuantity: { s: 1, e: 2, d: [250] },
			measuredValue: { s: 1, e: 3, d: [3750] },
			measuredPercentage: { s: 1, e: -1, d: [3500000] },
		};
		expect(decimalToNumber(measurement.measuredQuantity)).toBe(250);
		expect(decimalToNumber(measurement.measuredValue)).toBe(3750);
		expect(decimalToNumber(measurement.measuredPercentage)).toBe(0.35);
	});

	it("converts contract balance values", () => {
		const contract = {
			totalContractValue: { s: 1, e: 6, d: [1256789] },
			totalMeasured: { s: 1, e: 4, d: [87654] },
			totalPaid: { s: 1, e: 4, d: [75000] },
			balanceToPay: { s: 1, e: 3, d: [1265] },
		};
		expect(decimalToNumber(contract.totalContractValue)).toBe(1256789);
		expect(decimalToNumber(contract.totalMeasured)).toBe(87654);
		expect(decimalToNumber(contract.totalPaid)).toBe(75000);
		expect(decimalToNumber(contract.balanceToPay)).toBe(1265);
	});

	it("preserves zero values", () => {
		expect(decimalToNumber({ s: 1, e: 0, d: [0] })).toBe(0);
		expect(decimalToNumber({ s: 1, e: -1, d: [0] })).toBe(0);
	});

	it("converts small quantities (unit)", () => {
		const items = [
			{ s: 1, e: 0, d: [1] }, // 1
			{ s: 1, e: -1, d: [5000000] }, // 0.5
			{ s: 1, e: -1, d: [2500000] }, // 0.25
			{ s: 1, e: -1, d: [7500000] }, // 0.75
		];
		expect(decimalToNumber(items[0])).toBe(1);
		expect(decimalToNumber(items[1])).toBe(0.5);
		expect(decimalToNumber(items[2])).toBe(0.25);
		expect(decimalToNumber(items[3])).toBe(0.75);
	});

	it("converts a full API response payload", () => {
		const response = {
			data: [
				{
					id: "item-1",
					index: "1",
					description: "Servicos preliminares",
					type: "STAGE",
					quantity: null,
					totalCost: { s: 1, e: 4, d: [85000] },
					children: [
						{
							id: "item-2",
							index: "1.1",
							description: "Limpeza do terreno",
							type: "ITEM",
							unit: "m2",
							quantity: { s: 1, e: 2, d: [200] },
							totalCost: { s: 1, e: 3, d: [5000] },
						},
						{
							id: "item-3",
							index: "1.2",
							description: "Locacao de container",
							type: "ITEM",
							unit: "mes",
							quantity: { s: 1, e: 0, d: [3] },
							totalCost: { s: 1, e: 3, d: [3500] },
						},
					],
				},
			],
			total: 1,
		};
		const result = decimalToNumber(response) as {
			data: Array<{
				totalCost: number;
				children: Array<{ quantity: number; totalCost: number }>;
			}>;
		};
		expect(result.data[0].totalCost).toBe(85000);
		expect(result.data[0].children[0].quantity).toBe(200);
		expect(result.data[0].children[0].totalCost).toBe(5000);
		expect(result.data[0].children[1].quantity).toBe(3);
		expect(result.data[0].children[1].totalCost).toBe(3500);
	});

	it("toFiniteNumber from number-utils does not convert Decimal-like to 0", () => {
		expect(toFiniteNumber({ s: 1, e: 5, d: [176000] })).toBe(176000);
		expect(toFiniteNumber({ s: 1, e: -1, d: [5000000] })).toBe(0.5);
		expect(toFiniteNumber(new Decimal("15000"))).toBe(15000);
	});

	it("toNullableNumber returns null for absent values", () => {
		expect(toNullableNumber(null)).toBeNull();
		expect(toNullableNumber(undefined)).toBeNull();
		expect(toNullableNumber(new Decimal("250"))).toBe(250);
	});

	it("toNum from decimal-utils handles Decimal-like objects without becoming 0", () => {
		expect(toNum({ s: 1, e: 5, d: [176000] })).toBe(176000);
		expect(toNum(null)).toBe(0);
		expect(toNum(42)).toBe(42);
		expect(toNum(new Decimal("500"))).toBe(500);
	});
});
