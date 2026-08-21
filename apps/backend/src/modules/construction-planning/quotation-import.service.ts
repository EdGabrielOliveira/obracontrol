import Decimal from "decimal.js";
import { ConstructionError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { parseNumber } from "../../lib/text-utils";
import * as importBatchRepository from "./imports/import-batch.repository";
import { constructionImportBatchService } from "./imports/import-batch.service";
import { normalizeDate } from "./imports/normalizers";
import { quotationService } from "./quotation.service";
import { findSupplierByDocument } from "./suppliers/supplier.repository";

function parseIntValue(value: unknown): number | null {
	const parsed = parseNumber(value);
	if (parsed == null || !Number.isInteger(parsed)) return null;
	return parsed;
}

type QuotationImportFile = {
	name: string;
	stream: () => ReadableStream<Uint8Array>;
};

type ConfirmQuotationImportInput = {
	batchId: string;
	expectedBatchVersion: number;
	selectedRowIds: string[];
	idempotencyKey: string;
};

type QuotationRowValues = {
	supplierName?: unknown;
	supplierDocument?: unknown;
	supplierAddress?: unknown;
	supplierPhone?: unknown;
	supplierEmail?: unknown;
	supplierResponsible?: unknown;
	serviceDescription?: unknown;
	value?: unknown;
	serviceStartDate?: unknown;
	executionTermDays?: unknown;
	paymentTerms?: unknown;
	notes?: unknown;
};

function textValue(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function normalizeSupplierDocument(value: unknown, rowNumber: number): string {
	const document = textValue(value)?.replace(/\D/g, "") ?? "";
	if (document.length !== 14) {
		throw new ConstructionError(
			"INVALID_CNPJ",
			`CNPJ invalido na linha ${rowNumber}`,
			400,
		);
	}
	return document;
}

function assertSelectedRows(rowIds: string[]) {
	if (rowIds.length === 0 || new Set(rowIds).size !== rowIds.length) {
		throw new ConstructionError(
			"IMPORT_INVALID_SELECTION",
			"A selecao de linhas da cotacao e invalida",
			422,
		);
	}
}

export const quotationImportService = {
	async createPreview(
		ownerId: string,
		workId: string,
		quotationId: string,
		file: QuotationImportFile,
	) {
		const quotation = await prisma.quotation.findFirst({
			where: { id: quotationId, ownerId, workId },
			select: { id: true },
		});
		if (!quotation) {
			throw new ConstructionError("NOT_FOUND", "Cotacao nao encontrada", 404);
		}

		return constructionImportBatchService.createBatch(ownerId, workId, {
			fileName: file.name,
			file: file.stream(),
			model: "cotacao",
		});
	},

	getPreview(
		ownerId: string,
		workId: string,
		batchId: string,
		page = 1,
		pageSize = 500,
	) {
		return constructionImportBatchService.getPreviewPage(
			ownerId,
			workId,
			batchId,
			page,
			pageSize,
		);
	},

	listSelectableRows(ownerId: string, workId: string, batchId: string) {
		return constructionImportBatchService.listSelectableRowIds(
			ownerId,
			workId,
			batchId,
		);
	},

	exportRejectedSheet(ownerId: string, workId: string, batchId: string) {
		return constructionImportBatchService.exportRejectedSheet(
			ownerId,
			workId,
			batchId,
		);
	},

	async confirm(
		ownerId: string,
		workId: string,
		quotationId: string,
		input: ConfirmQuotationImportInput,
	) {
		assertSelectedRows(input.selectedRowIds);

		const [quotation, batch] = await Promise.all([
			prisma.quotation.findFirst({
				where: { id: quotationId, ownerId, workId },
				select: { id: true, status: true, maxSuppliers: true },
			}),
			importBatchRepository.findImportBatch(ownerId, workId, input.batchId),
		]);

		if (!quotation) {
			throw new ConstructionError("NOT_FOUND", "Cotacao nao encontrada", 404);
		}
		if (!batch || batch.model !== "cotacao") {
			throw new ConstructionError(
				"NOT_FOUND",
				"Lote de cotacao nao encontrado",
				404,
			);
		}
		if (batch.status === "CONFIRMED") {
			throw new ConstructionError(
				"IMPORT_BATCH_ALREADY_CONFIRMED",
				"Este lote de cotacao ja foi confirmado",
				409,
			);
		}
		if (batch.status !== "READY" || batch.expiresAt <= new Date()) {
			throw new ConstructionError(
				"IMPORT_BATCH_NOT_READY",
				"Lote de cotacao nao esta pronto para confirmacao",
				422,
			);
		}
		if (batch.batchVersion !== input.expectedBatchVersion) {
			throw new ConstructionError(
				"IMPORT_BATCH_CONFLICT",
				"Versao do lote divergente; reenvie o arquivo para nova revisao",
				409,
			);
		}
		if (quotation.status === "CONTRATADA") {
			throw new ConstructionError(
				"QUOTATION_CLOSED",
				"Cotacao ja contratada",
				409,
			);
		}

		const rows = await importBatchRepository.listImportRowsByIds(
			input.batchId,
			input.selectedRowIds,
		);
		if (rows.length !== input.selectedRowIds.length) {
			throw new ConstructionError(
				"IMPORT_INVALID_SELECTION",
				"Linhas selecionadas inexistentes no lote",
				422,
			);
		}
		if (
			rows.some((row) => row.status !== "VALID" && row.status !== "WARNING")
		) {
			throw new ConstructionError(
				"IMPORT_INVALID_SELECTION",
				"Linhas invalidas nao podem ser confirmadas",
				422,
			);
		}

		const suppliers = new Set<string>();
		const proposals = await Promise.all(
			rows.map(async (row) => {
				const values = row.values as QuotationRowValues;
				const supplierName = textValue(values.supplierName);
				const supplierDocument = normalizeSupplierDocument(
					values.supplierDocument,
					row.rowNumber,
				);
				const value = parseNumber(values.value);
				if (!supplierName) {
					throw new ConstructionError(
						"INVALID_INPUT",
						`Razao social obrigatoria na linha ${row.rowNumber}`,
						400,
					);
				}
				if (value == null || value <= 0) {
					throw new ConstructionError(
						"INVALID_INPUT",
						`Valor do servico invalido na linha ${row.rowNumber}`,
						400,
					);
				}

				if (suppliers.has(supplierDocument)) {
					throw new ConstructionError(
						"DUPLICATE_PROPOSAL",
						"Ja existe proposta deste fornecedor",
						409,
					);
				}
				suppliers.add(supplierDocument);
				const supplier = await findSupplierByDocument(
					ownerId,
					supplierDocument,
				);
				const serviceStartDate = normalizeDate(values.serviceStartDate);
				const executionTermDays = parseIntValue(values.executionTermDays);

				return {
					quotationId,
					supplierId: supplier?.id ?? null,
					supplierDocument,
					supplierName,
					supplierAddress: textValue(values.supplierAddress),
					supplierPhone: textValue(values.supplierPhone),
					supplierEmail: textValue(values.supplierEmail),
					supplierResponsible: textValue(values.supplierResponsible),
					serviceDescription: textValue(values.serviceDescription),
					value: new Decimal(value),
					serviceStartDate,
					executionTermDays,
					paymentTerms: textValue(values.paymentTerms),
					notes: textValue(values.notes),
					justification: null,
					isWinner: false,
				};
			}),
		);

		if (suppliers.size > quotation.maxSuppliers) {
			throw new ConstructionError(
				"QUOTATION_MAX_PROPOSALS",
				`Limite de ${quotation.maxSuppliers} propostas atingido`,
				422,
			);
		}

		await prisma.$transaction(async (tx) => {
			await tx.quotationProposal.deleteMany({ where: { quotationId } });
			await tx.quotationProposal.createMany({ data: proposals });
			await tx.quotation.update({
				where: { id: quotationId },
				data: { status: "NEGOCIACAO" },
			});
			await tx.importBatch.update({
				where: { id: input.batchId },
				data: {
					quotationId,
					status: "CONFIRMED",
					confirmedAt: new Date(),
					errorSummary: { idempotencyKey: input.idempotencyKey },
				},
			});
		});

		return quotationService.get(ownerId, quotationId);
	},
};
