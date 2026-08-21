import { beforeEach, describe, expect, it, mock } from "bun:test";

const resolveScopeMock = mock(
	async (): Promise<Record<string, unknown>> => ({ canWrite: true }),
);
const requestFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => ({
		id: "request-1",
		status: "EM_ESPERA",
		confirmedBatchId: null,
	}),
);
const importBatchUpdate = mock(async () => ({}));
const importBatchFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const importRowFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const proposalCreateMany = mock(async () => ({ count: 0 }));
const requestUpdate = mock(async () => ({}));
const transactionMock = mock(
	async (callback: (tx: Record<string, unknown>) => Promise<unknown>) =>
		callback({
			contractRequestProposal: { createMany: proposalCreateMany },
			importBatch: { update: importBatchUpdate },
			contractRequest: { update: requestUpdate },
		}),
);
const createBatchMock = mock(async () => ({
	batchId: "batch-1",
	status: "READY",
}));
const getPreviewPageMock = mock(async () => ({
	batchId: "batch-1",
	status: "READY",
}));

mock.module("../../../../src/lib/resource-scope", () => ({
	resolveResourceScope: resolveScopeMock,
}));

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		contractRequest: { findFirst: requestFindFirst },
		importBatch: {
			findFirst: importBatchFindFirst,
			update: importBatchUpdate,
		},
		importRow: { findMany: importRowFindMany },
		$transaction: transactionMock,
	},
}));

mock.module(
	"../../../../src/modules/construction-planning/imports/import-batch.service",
	() => ({
		constructionImportBatchService: {
			createBatch: createBatchMock,
			getPreviewPage: getPreviewPageMock,
		},
	}),
);

const validRow = {
	rowNumber: 2,
	values: {
		supplierDocument: "11.222.333/0001-81",
		supplierName: "Construtora Modelo Ltda.",
		value: 35000,
		notes: "Prazo negociável",
		suggestedWinner: "SIM",
	},
};

describe("contract request quotation map import", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		resolveScopeMock.mockResolvedValue({ canWrite: true });
		requestFindFirst.mockResolvedValue({
			id: "request-1",
			status: "EM_ESPERA",
			confirmedBatchId: null,
		});
		importBatchFindFirst.mockResolvedValue(null);
		importRowFindMany.mockResolvedValue([]);
		createBatchMock.mockResolvedValue({ batchId: "batch-1", status: "READY" });
	});

	it("validates CNPJ check digits", async () => {
		const { isValidCnpj } = await import(
			"../../../../src/modules/construction-planning/contract-request-import.service"
		);
		expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
		expect(isValidCnpj("11.222.333/0001-80")).toBe(false);
	});

	it("creates a quotation map batch linked to the request", async () => {
		const { createQuotationMapPreview } = await import(
			"../../../../src/modules/construction-planning/contract-request-import.service"
		);
		const result = await createQuotationMapPreview(
			"user-1",
			"work-1",
			"request-1",
			{
				name: "mapa.xlsx",
				stream: () => new ReadableStream(),
			},
		);

		expect(result.batchId).toBe("batch-1");
		expect(createBatchMock).toHaveBeenCalledWith(
			"user-1",
			"work-1",
			expect.objectContaining({ model: "quotation-map" }),
		);
		expect(importBatchUpdate).toHaveBeenCalledWith({
			where: { id: "batch-1" },
			data: { contractRequestId: "request-1" },
		});
	});

	it("confirms a valid batch persisting proposals and locking the request map", async () => {
		importBatchFindFirst.mockResolvedValue({
			id: "batch-1",
			status: "READY",
			expiresAt: new Date(Date.now() + 60_000),
		});
		importRowFindMany.mockResolvedValue([validRow]);

		const { confirmQuotationMapBatch } = await import(
			"../../../../src/modules/construction-planning/contract-request-import.service"
		);
		const result = await confirmQuotationMapBatch(
			"user-1",
			"work-1",
			"request-1",
			"batch-1",
			"key-1",
		);

		expect(result.proposalCount).toBe(1);
		expect(proposalCreateMany).toHaveBeenCalledWith({
			data: [
				expect.objectContaining({
					batchId: "batch-1",
					normalizedCnpj: "11222333000181",
					supplierName: "Construtora Modelo Ltda.",
					suggestedWinner: true,
				}),
			],
		});
		expect(requestUpdate).toHaveBeenCalledWith({
			where: { id: "request-1" },
			data: { confirmedBatchId: "batch-1" },
		});
	});

	it("confirms only the selected suppliers from the preview", async () => {
		importBatchFindFirst.mockResolvedValue({
			id: "batch-1",
			status: "READY",
			expiresAt: new Date(Date.now() + 60_000),
		});
		importRowFindMany.mockResolvedValue([validRow]);

		const { confirmQuotationMapBatch } = await import(
			"../../../../src/modules/construction-planning/contract-request-import.service"
		);
		await confirmQuotationMapBatch(
			"user-1",
			"work-1",
			"request-1",
			"batch-1",
			"key-1",
			["row-2"],
		);

		expect(importRowFindMany).toHaveBeenCalledWith({
			where: {
				batchId: "batch-1",
				status: { in: ["VALID", "WARNING"] },
				id: { in: ["row-2"] },
			},
			orderBy: { rowNumber: "asc" },
			select: { rowNumber: true, values: true },
		});
	});

	it("rejects a batch with an invalid CNPJ", async () => {
		importBatchFindFirst.mockResolvedValue({
			id: "batch-1",
			status: "READY",
			expiresAt: new Date(Date.now() + 60_000),
		});
		importRowFindMany.mockResolvedValue([
			{
				rowNumber: 2,
				values: {
					supplierDocument: "11.222.333/0001-80",
					supplierName: "Construtora X",
					value: 1000,
				},
			},
		]);

		const { confirmQuotationMapBatch } = await import(
			"../../../../src/modules/construction-planning/contract-request-import.service"
		);
		await expect(
			confirmQuotationMapBatch("user-1", "work-1", "request-1", "batch-1"),
		).rejects.toMatchObject({ code: "INVALID_CNPJ" });
		expect(proposalCreateMany).not.toHaveBeenCalled();
	});

	it("rejects duplicate CNPJs in the same map", async () => {
		importBatchFindFirst.mockResolvedValue({
			id: "batch-1",
			status: "READY",
			expiresAt: new Date(Date.now() + 60_000),
		});
		importRowFindMany.mockResolvedValue([
			validRow,
			{
				rowNumber: 3,
				values: {
					supplierDocument: "11.222.333/0001-81",
					supplierName: "Outra Construtora",
					value: 2000,
				},
			},
		]);

		const { confirmQuotationMapBatch } = await import(
			"../../../../src/modules/construction-planning/contract-request-import.service"
		);
		await expect(
			confirmQuotationMapBatch("user-1", "work-1", "request-1", "batch-1"),
		).rejects.toMatchObject({ code: "DUPLICATE_PROPOSAL" });
	});

	it("replays a confirmed batch without persisting twice", async () => {
		importBatchFindFirst.mockResolvedValue({
			id: "batch-1",
			status: "CONFIRMED",
			expiresAt: new Date(Date.now() + 60_000),
		});

		const { confirmQuotationMapBatch } = await import(
			"../../../../src/modules/construction-planning/contract-request-import.service"
		);
		const result = await confirmQuotationMapBatch(
			"user-1",
			"work-1",
			"request-1",
			"batch-1",
		);

		expect(result).toMatchObject({ batchId: "batch-1", confirmed: true });
		expect(proposalCreateMany).not.toHaveBeenCalled();
	});
});
