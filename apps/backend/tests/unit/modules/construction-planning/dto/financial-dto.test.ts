import { describe, expect, it } from "bun:test";
import Decimal from "decimal.js";
import {
	toBudgetItemDto,
	toContractDto,
	toContractMeasurementDto,
	toContractPaymentDto,
	toContractServiceDto,
	toWorkMeasurementDto,
	toWorkMeasurementItemDto,
} from "../../../../../src/modules/construction-planning/dto/financial-dto";

describe("financial DTO mappers", () => {
	it("maps budget item numeric fields to JSON-safe numbers", () => {
		const dto = toBudgetItemDto({
			id: "bi-1",
			parentId: null,
			index: "3.1",
			type: "ITEM",
			description: "Concreto armado - pilares",
			unit: "m3",
			quantity: new Decimal(220),
			unitCost: new Decimal(800),
			totalCost: new Decimal(176000),
			plannedStart: null,
			plannedEnd: null,
			completionPercentage: new Decimal(25),
			sortOrder: 8,
		});

		expect(dto.quantity).toBe(220);
		expect(dto.unitCost).toBe(800);
		expect(dto.totalCost).toBe(176000);
		expect(dto.completionPercentage).toBe(25);
		expect(dto.description).toBe("Concreto armado - pilares");
	});

	it("derives service total when totalCost is absent", () => {
		const dto = toContractServiceDto({
			id: "svc-1",
			contractId: "c-1",
			parentId: null,
			description: "Servico",
			type: "ITEM",
			unit: "m2",
			quantity: new Decimal(50),
			unitCost: new Decimal(250),
			totalCost: null,
			budgetItemId: null,
			sortOrder: 1,
		});

		expect(dto.totalCost).toBe(12500);
	});

	it("uses explicit totalCost when present in service", () => {
		const dto = toContractServiceDto({
			id: "svc-2",
			contractId: "c-1",
			parentId: null,
			description: "Servico fixo",
			type: "ITEM",
			unit: "un",
			quantity: null,
			unitCost: null,
			totalCost: new Decimal(50000),
			budgetItemId: null,
			sortOrder: 2,
		});

		expect(dto.totalCost).toBe(50000);
	});

	it("returns null totalCost when nothing is available", () => {
		const dto = toContractServiceDto({
			id: "svc-3",
			contractId: "c-1",
			parentId: null,
			description: "Servico vazio",
			type: "ITEM",
			unit: null,
			quantity: null,
			unitCost: null,
			totalCost: null,
			budgetItemId: null,
			sortOrder: 3,
		});

		expect(dto.totalCost).toBeNull();
	});

	it("maps contract dto fields", () => {
		const dto = toContractDto({
			id: "c-1",
			workId: "w-1",
			code: "CT-001",
			supplierName: "Fornecedor A",
			contractValue: new Decimal(100000),
			serviceType: "MATERIAL",
			title: "Contrato principal",
			startDate: "2026-01-01",
			endDate: "2026-12-31",
			status: "APROVADO",
			notes: null,
			createdAt: "2026-01-01T00:00:00.000Z",
		});

		expect(dto.contractValue).toBe(100000);
		expect(dto.code).toBe("CT-001");
		expect(dto.supplierName).toBe("Fornecedor A");
	});

	it("maps work measurement dto with computed totalMeasuredValue", () => {
		const dto = toWorkMeasurementDto(
			{
				id: "wm-1",
				workId: "w-1",
				number: 1,
				date: "2026-07-01",
				title: "Medicao 01",
				discountValue: null,
				retentionValue: new Decimal(500),
				notes: null,
				createdBy: "user-1",
				createdAt: "2026-07-01T00:00:00.000Z",
			},
			[
				{
					id: "wmi-1",
					measurementId: "wm-1",
					budgetItemId: "bi-1",
					measuredQuantity: new Decimal(10),
					measuredValue: new Decimal(10000),
					measuredPercentage: new Decimal(10),
					accumulatedQuantity: null,
					accumulatedValue: null,
					accumulatedPercentage: null,
				},
				{
					id: "wmi-2",
					measurementId: "wm-1",
					budgetItemId: "bi-2",
					measuredQuantity: new Decimal(5),
					measuredValue: new Decimal(20000),
					measuredPercentage: new Decimal(20),
					accumulatedQuantity: null,
					accumulatedValue: null,
					accumulatedPercentage: null,
				},
			],
		);

		expect(dto.totalMeasuredValue).toBe(30000);
		expect(dto.retentionValue).toBe(500);
		expect(dto.measurementType).toBe("OBRA");
		expect(dto.items).toHaveLength(2);
		expect(dto.items[0]).toMatchObject({
			id: "wmi-1",
			measurementId: "wm-1",
			budgetItemId: "bi-1",
			measuredQuantity: 10,
			measuredValue: 10000,
			measuredPercentage: 10,
		});
		expect(dto.items[1]).toMatchObject({
			id: "wmi-2",
			budgetItemId: "bi-2",
			measuredValue: 20000,
		});
	});

	it("maps work measurement dto with empty items list", () => {
		const dto = toWorkMeasurementDto(
			{
				id: "wm-2",
				workId: "w-1",
				number: 2,
				date: "2026-08-01",
				title: "Medicao 02",
				discountValue: null,
				retentionValue: null,
				notes: null,
				createdBy: "user-1",
				createdAt: "2026-08-01T00:00:00.000Z",
			},
			[],
		);

		expect(dto.items).toEqual([]);
		expect(dto.measurementType).toBe("OBRA");
	});

	it("maps work measurement item dto", () => {
		const dto = toWorkMeasurementItemDto({
			id: "wmi-1",
			measurementId: "wm-1",
			budgetItemId: "bi-1",
			measuredQuantity: new Decimal(10),
			measuredValue: new Decimal(5000),
			measuredPercentage: new Decimal(25),
			accumulatedQuantity: null,
			accumulatedValue: null,
			accumulatedPercentage: null,
		});

		expect(dto.measuredQuantity).toBe(10);
		expect(dto.measuredValue).toBe(5000);
		expect(dto.measuredPercentage).toBe(25);
		expect(dto.accumulatedValue).toBeNull();
	});

	it("maps contract measurement dto", () => {
		const dto = toContractMeasurementDto({
			id: "cm-1",
			contractId: "c-1",
			number: 1,
			date: "2026-07-01",
			title: "Medicao contrato",
			discountValue: null,
			retentionValue: null,
			notes: "Sem observacoes",
			createdBy: "user-1",
			createdAt: "2026-07-01T00:00:00.000Z",
		});

		expect(dto.number).toBe(1);
		expect(dto.measurementType).toBe("CONTRATO");
	});

	it("maps contract payment dto", () => {
		const dto = toContractPaymentDto({
			id: "cp-1",
			contractId: "c-1",
			date: "2026-08-01",
			value: new Decimal(10000),
			paidValue: new Decimal(9600),
			description: "Pagamento parcial",
			measurementId: "cm-1",
			retentionValue: new Decimal(300),
			discountValue: new Decimal(100),
			status: "PAGO",
		});

		expect(dto.value).toBe(10000);
		expect(dto.paidValue).toBe(9600);
		expect(dto.retentionValue).toBe(300);
		expect(dto.discountValue).toBe(100);
	});
});
