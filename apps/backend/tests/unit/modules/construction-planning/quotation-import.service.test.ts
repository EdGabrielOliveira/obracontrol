import { beforeEach, describe, expect, it, mock } from "bun:test";

const quotationFindFirst = mock(async () => ({
	id: "quote-1",
	ownerId: "owner-1",
	workId: "work-1",
	maxSuppliers: 3,
	status: "NEGOCIACAO",
	title: "Cotacao teste",
	observation: null,
	contractId: null,
	createdAt: new Date(),
	proposals: [],
	budgetItems: [],
}));
const proposalDeleteMany = mock(async () => ({ count: 0 }));
const proposalCreateMany = mock(
	async (_args: { data: Array<Record<string, unknown>> }) => ({ count: 2 }),
);
const quotationUpdate = mock(async () => ({ id: "quote-1" }));
const importBatchUpdate = mock(async () => ({ id: "batch-1" }));
const transaction = mock(async (callback: (tx: unknown) => unknown) =>
	callback({
		quotationProposal: {
			deleteMany: proposalDeleteMany,
			createMany: proposalCreateMany,
		},
		quotation: { update: quotationUpdate },
		importBatch: { update: importBatchUpdate },
	}),
);
const findImportBatch = mock(async () => ({
	id: "batch-1",
	ownerId: "owner-1",
	workId: "work-1",
	model: "cotacao",
	status: "READY",
	batchVersion: 1,
	expiresAt: new Date(Date.now() + 60_000),
}));
const listImportRowsByIds = mock(
	async (): Promise<Array<Record<string, unknown>>> => [
		{
			id: "row-1",
			status: "VALID",
			values: {
				supplierName: "Fornecedor A",
				supplierDocument: "12.345.678/0001-90",
				supplierAddress: "Rua A, 100",
				supplierPhone: "(83) 99999-1234",
				supplierEmail: "a@exemplo.com.br",
				supplierResponsible: "João Silva",
				serviceDescription: "Alvenaria e reboco",
				value: 12000,
				serviceStartDate: "2026-09-01",
				executionTermDays: 90,
				paymentTerms: "30/60/90 dias",
				notes: "Prazo negociável",
			},
		},
		{
			id: "row-2",
			status: "VALID",
			values: {
				supplierName: "Fornecedor B",
				supplierDocument: "98765432000100",
				serviceDescription: "Pintura",
				value: 11500,
			},
		},
	],
);

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		quotation: { findFirst: quotationFindFirst },
		$transaction: transaction,
	},
}));
mock.module(
	"../../../../src/modules/construction-planning/imports/import-batch.repository",
	() => ({
		findImportBatch,
		listImportRowsByIds,
	}),
);
const findSupplierByDocument = mock(
	async (ownerId: string, document: string) =>
		document === "12345678000190"
			? { id: "supplier-1", ownerId, document }
			: null,
);
mock.module(
	"../../../../src/modules/construction-planning/suppliers/supplier.repository",
	() => ({
		findSupplierByDocument,
		findSupplierByDocumentOrName: async () => null,
		getSupplierById: async () => null,
	}),
);
const { quotationImportService } = await import(
	"../../../../src/modules/construction-planning/quotation-import.service"
);

describe("quotationImportService", () => {
	beforeEach(() => {
		quotationFindFirst.mockClear();
		proposalDeleteMany.mockClear();
		proposalCreateMany.mockClear();
		quotationUpdate.mockClear();
		importBatchUpdate.mockClear();
		transaction.mockClear();
		findImportBatch.mockClear();
		listImportRowsByIds.mockClear();
		findSupplierByDocument.mockClear();
	});

	it("confirma linhas validas como propostas da cotacao", async () => {
		const result = await quotationImportService.confirm(
			"owner-1",
			"work-1",
			"quote-1",
			{
				batchId: "batch-1",
				expectedBatchVersion: 1,
				selectedRowIds: ["row-1", "row-2"],
				idempotencyKey: "request-1",
			},
		);

		expect(proposalCreateMany).toHaveBeenCalledWith({
			data: [
				expect.objectContaining({
					quotationId: "quote-1",
					supplierDocument: "12345678000190",
					supplierId: "supplier-1",
					supplierName: "Fornecedor A",
					supplierAddress: "Rua A, 100",
					supplierPhone: "(83) 99999-1234",
					supplierEmail: "a@exemplo.com.br",
					supplierResponsible: "João Silva",
					serviceDescription: "Alvenaria e reboco",
					value: expect.anything(),
					serviceStartDate: new Date(Date.UTC(2026, 8, 1)),
					executionTermDays: 90,
					paymentTerms: "30/60/90 dias",
					notes: "Prazo negociável",
					isWinner: false,
				}),
				expect.objectContaining({
					quotationId: "quote-1",
					supplierName: "Fornecedor B",
					serviceDescription: "Pintura",
					supplierAddress: null,
					supplierPhone: null,
					supplierEmail: null,
					supplierResponsible: null,
					serviceStartDate: null,
					executionTermDays: null,
					paymentTerms: null,
					notes: null,
					isWinner: false,
				}),
			],
		});
		expect(quotationUpdate).toHaveBeenCalledWith({
			where: { id: "quote-1" },
			data: { status: "NEGOCIACAO" },
		});
		expect(importBatchUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: "batch-1" },
				data: expect.objectContaining({
					quotationId: "quote-1",
					status: "CONFIRMED",
				}),
			}),
		);
		expect(result).toEqual(
			expect.objectContaining({ id: "quote-1", status: "NEGOCIACAO" }),
		);
	});

	it("ignora codigo de cotacao, justificativa e vencedor importados", async () => {
		listImportRowsByIds.mockResolvedValue([
			{
				id: "row-1",
				rowNumber: 2,
				status: "VALID",
				values: {
					quotationCode: "COT-001",
					supplierName: "Fornecedor A",
					supplierDocument: "12345678000190",
					value: 100,
					justification: "Prazo menor",
					winner: "SIM",
				},
			},
		]);

		await quotationImportService.confirm("owner-1", "work-1", "quote-1", {
			batchId: "batch-1",
			expectedBatchVersion: 1,
			selectedRowIds: ["row-1"],
			idempotencyKey: "request-3",
		});

		const created = proposalCreateMany.mock.calls[0]?.[0]?.data as Array<
			Record<string, unknown>
		>;
		expect(created).toHaveLength(1);
		expect(created[0]).toEqual(
			expect.objectContaining({
				supplierName: "Fornecedor A",
				isWinner: false,
				justification: null,
			}),
		);
		expect(created[0]).not.toHaveProperty("quotationCode");
	});

	it("rejeita duas propostas do mesmo fornecedor", async () => {
		listImportRowsByIds.mockResolvedValue([
			{
				id: "row-1",
				rowNumber: 2,
				status: "VALID",
				values: {
					supplierName: "Fornecedor A",
					supplierDocument: "12345678000190",
					value: 100,
				},
			},
			{
				id: "row-2",
				rowNumber: 3,
				status: "VALID",
				values: {
					supplierName: " fornecedor a ",
					supplierDocument: "12.345.678/0001-90",
					value: 200,
				},
			},
		]);

		await expect(
			quotationImportService.confirm("owner-1", "work-1", "quote-1", {
				batchId: "batch-1",
				expectedBatchVersion: 1,
				selectedRowIds: ["row-1", "row-2"],
				idempotencyKey: "request-2",
			}),
		).rejects.toMatchObject({ code: "DUPLICATE_PROPOSAL", status: 409 });
		expect(proposalCreateMany).not.toHaveBeenCalled();
	});
});
