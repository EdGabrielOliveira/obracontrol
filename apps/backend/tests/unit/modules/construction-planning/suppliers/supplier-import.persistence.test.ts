import { beforeEach, describe, expect, it, mock } from "bun:test";
import * as XLSX from "xlsx";

const workFindFirst = mock(async () => ({ id: "work-1" }));
const supplierFindFirst = mock(async () => null);
const supplierCreate = mock(
	async ({ data }: { data: Record<string, unknown> }) => ({
		id: "supplier-1",
		document: data.document,
	}),
);
const supplierUpdate = mock(
	async ({ data }: { data: Record<string, unknown> }) => ({
		id: "supplier-1",
		document: data.document,
	}),
);
const workSupplierUpsert = mock(async () => ({ id: "work-supplier-1" }));
const transaction = mock(async (callback: (tx: unknown) => Promise<unknown>) =>
	callback({
		constructionSupplier: {
			findFirst: supplierFindFirst,
			create: supplierCreate,
			update: supplierUpdate,
		},
		constructionWorkSupplier: { upsert: workSupplierUpsert },
	}),
);

mock.module("../../../../../src/lib/prisma", () => ({
	prisma: {
		constructionWork: { findFirst: workFindFirst },
		$transaction: transaction,
	},
}));

const { importSupplierWorkbook } = await import(
	"../../../../../src/modules/construction-planning/suppliers/supplier-import.service"
);

function workbookBytes() {
	const workbook = XLSX.utils.book_new();
	const sheet = XLSX.utils.json_to_sheet([
		{
			"Nome da empresa": "Fornecedor A",
			CNPJ: "12.345.678/0001-90",
			"Tipo PIX": "EMAIL",
			"Chave PIX": "financeiro@fornecedor.com",
		},
	]);
	XLSX.utils.book_append_sheet(workbook, sheet, "Fornecedores");
	return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

beforeEach(() => {
	workFindFirst.mockClear();
	supplierFindFirst.mockClear();
	supplierCreate.mockClear();
	supplierUpdate.mockClear();
	workSupplierUpsert.mockClear();
	transaction.mockClear();
});

describe("importSupplierWorkbook", () => {
	it("cria fornecedor e vinculo com a obra na mesma transacao", async () => {
		const result = await importSupplierWorkbook(
			"owner-1",
			"work-1",
			workbookBytes(),
		);

		expect(result.importedCount).toBe(1);
		expect(transaction).toHaveBeenCalledTimes(1);
		expect(supplierCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({
				ownerId: "owner-1",
				name: "Fornecedor A",
				document: "12345678000190",
			}),
		});
		expect(workSupplierUpsert).toHaveBeenCalledWith({
			where: {
				workId_supplierId: { workId: "work-1", supplierId: "supplier-1" },
			},
			update: {},
			create: {
				ownerId: "owner-1",
				workId: "work-1",
				supplierId: "supplier-1",
			},
		});
	});
});
