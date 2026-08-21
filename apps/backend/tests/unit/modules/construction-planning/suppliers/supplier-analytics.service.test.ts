import { beforeEach, describe, expect, it, mock } from "bun:test";
import Decimal from "decimal.js";

function contractRow(
	overrides: Partial<{
		supplierId: string | null;
		supplierName: string | null;
		contractValue: number;
		measuredValues: number[];
		paymentValues: Array<{ value: number; paidValue: number }>;
	}> = {},
) {
	return {
		supplierId:
			overrides.supplierId !== undefined ? overrides.supplierId : "sup-1",
		supplierName: overrides.supplierName ?? "Fornecedor Alfa",
		contractValue: new Decimal(overrides.contractValue ?? 50000),
		measurements: (overrides.measuredValues ?? []).map((value) => ({
			items: [{ measuredValue: new Decimal(value) }],
		})),
		payments: (overrides.paymentValues ?? []).map(({ value, paidValue }) => ({
			value: new Decimal(value),
			paidValue: new Decimal(paidValue),
		})),
	};
}

const listContractsForAnalytics = mock(async (): Promise<unknown[]> => []);

mock.module(
	"../../../../../src/modules/construction-planning/suppliers/supplier-analytics.repository",
	() => ({
		listContractsForAnalytics,
	}),
);

const { aggregateSupplierAnalytics, supplierAnalyticsService } = await import(
	"../../../../../src/modules/construction-planning/suppliers/supplier-analytics.service"
);

beforeEach(() => {
	listContractsForAnalytics.mockClear();
	listContractsForAnalytics.mockImplementation(async () => []);
});

describe("aggregateSupplierAnalytics", () => {
	it("consolida contratos, medido, pago e aberto por fornecedor", () => {
		const items = aggregateSupplierAnalytics([
			contractRow({
				supplierId: "sup-1",
				supplierName: "Fornecedor Alfa",
				contractValue: 100000,
				measuredValues: [40000, 50000],
				paymentValues: [
					{ value: 80000, paidValue: 50000 },
					{ value: 10000, paidValue: 10000 },
				],
			}),
			contractRow({
				supplierId: "sup-1",
				supplierName: "Fornecedor Alfa",
				contractValue: 50000,
				measuredValues: [],
				paymentValues: [],
			}),
		]);

		expect(items).toEqual([
			expect.objectContaining({
				supplierId: "sup-1",
				supplierName: "Fornecedor Alfa",
				contractCount: 2,
				contractedAmount: 150000,
				measuredAmount: 90000,
				paidAmount: 60000,
				openAmount: 30000,
			}),
		]);
	});

	it("agrupa contratos legados sem supplierId como Sem Fornecedor", () => {
		const items = aggregateSupplierAnalytics([
			contractRow({
				supplierId: null,
				supplierName: "Fornecedor Legado",
				contractValue: 1000,
			}),
		]);

		expect(items[0]).toMatchObject({
			supplierId: null,
			supplierName: "Fornecedor Legado",
			contractCount: 1,
			contractedAmount: 1000,
			measuredAmount: 0,
			paidAmount: 0,
			openAmount: 0,
		});
	});

	it("ordena por valor contratado decrescente por padrao", () => {
		const items = aggregateSupplierAnalytics([
			contractRow({ supplierId: "a", contractValue: 1000 }),
			contractRow({ supplierId: "b", contractValue: 9000 }),
			contractRow({ supplierId: "c", contractValue: 5000 }),
		]);

		expect(items.map((item) => item.supplierId)).toEqual(["b", "c", "a"]);
	});

	it("ordena por valor pago quando solicitado", () => {
		const items = aggregateSupplierAnalytics(
			[
				contractRow({
					supplierId: "a",
					paymentValues: [{ value: 100, paidValue: 10 }],
				}),
				contractRow({
					supplierId: "b",
					paymentValues: [{ value: 100, paidValue: 90 }],
				}),
			],
			{ sort: "paidAmount", order: "asc" },
		);

		expect(items.map((item) => item.supplierId)).toEqual(["a", "b"]);
	});

	it("filtra por nome quando q informado", () => {
		const items = aggregateSupplierAnalytics(
			[
				contractRow({ supplierId: "a", supplierName: "Construtora Norte" }),
				contractRow({ supplierId: "b", supplierName: "Alfa Materiais" }),
			],
			{ q: "alfa" },
		);

		expect(items).toHaveLength(1);
		expect(items[0].supplierName).toBe("Alfa Materiais");
	});
});

describe("SupplierAnalyticsService.list", () => {
	it("repassa ownerId e workId ao repository e agrega", async () => {
		listContractsForAnalytics.mockImplementation(async () => [
			contractRow({ supplierId: "sup-1", contractValue: 10000 }),
		]);

		const result = await supplierAnalyticsService.list("owner-1", {
			workId: "work-1",
		});

		expect(listContractsForAnalytics).toHaveBeenCalledWith("owner-1", {
			workId: "work-1",
		});
		expect(result).toEqual({
			items: [
				expect.objectContaining({
					supplierId: "sup-1",
					contractCount: 1,
					contractedAmount: 10000,
				}),
			],
			data: expect.any(Array),
			total: 1,
			page: 1,
			limit: 50,
			totalPages: 1,
		});
	});
});
