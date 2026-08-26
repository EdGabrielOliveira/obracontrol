import type { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import { ConstructionError } from "../../../lib/errors";
import { importStorage } from "../../../lib/import-storage";
import {
	constructionGovernanceGuard,
	type GovernanceMutationGuard,
} from "../governance-guard";
import { getWorkOrThrow } from "../repository";
import type { WorkbookKind } from "../templates/workbook-contracts";
import type { ImportValidationError, ParsedWorkbookUnified } from "../types";
import * as importBatchRepository from "./import-batch.repository";
import type {
	ImportBatchCreateInput,
	ImportPreviewPage,
	ImportPreviewRow,
	ImportRowStatus,
} from "./import-batch.types";
import {
	DEFAULT_IMPORT_MEMORY_BUDGET,
	defaultMemoryChecker,
	importParseSemaphore,
} from "./import-parser";
import { getImportById } from "./import-repository";
import { buildRejectedSheet } from "./import-service";
import { parseWorkbookByKind } from "./parser";
import { assertSelectedRowIds } from "./selected-workbook";
import { validateWorkbookByKind } from "./validator";

const MB = 1024 * 1024;

export const IMPORT_LIMITS = {
	maxFileMb: 25,
	maxSheets: 20,
	maxRows: 100_000,
	previewPageSize: 500,
	batchTtlDays: 7,
};

export const IMPORT_MODEL_VERSION = "1";

type SheetRow = {
	rowNumber: number;
} & Record<string, unknown>;

function issueKey(error: ImportValidationError): string {
	return `${error.sheet ?? ""}:${error.row ?? ""}`;
}

function issuesOf(error: ImportValidationError): ImportPreviewRow["issues"] {
	return [
		{
			column: error.field ?? null,
			code: error.code,
			message: error.message,
			value: error.dependency ?? null,
		},
	];
}

export class ConstructionImportBatchService {
	constructor(
		private readonly governance: GovernanceMutationGuard = constructionGovernanceGuard,
	) {}

	private async assertContext(
		ownerId: string,
		workId: string,
		actorId = ownerId,
	) {
		// The resource owner is used for persistence and governance records;
		// the actor is used for the access check so delegated users can import
		// into a work they are actively assigned to.
		await getWorkOrThrow(actorId, workId);
		await this.governance.assertWritable(ownerId, "WORK_IMPORTS", workId);
	}

	/**
	 * Recebe o arquivo em fluxo (multipart), grava no storage temporario com
	 * SHA-256, parseia e persiste somente staging (ImportBatch/ImportRow).
	 * Nenhum dado operacional e criado.
	 */
	async createBatch(
		ownerId: string,
		workId: string,
		input: ImportBatchCreateInput,
		actorId = ownerId,
	): Promise<ImportPreviewPage> {
		await this.assertContext(ownerId, workId, actorId);

		if (!input.fileName.toLowerCase().endsWith(".xlsx")) {
			throw new ConstructionError(
				"INVALID_FILE_TYPE",
				"Somente arquivos .xlsx sao aceitos",
				400,
			);
		}

		if (input.model === "medicao-contrato") {
			throw new ConstructionError(
				"MODEL_NOT_SUPPORTED",
				"Medicoes de contrato nao sao importadas por lote: use o fluxo de importacao de medicoes do contrato",
				422,
			);
		}

		if (input.reprocessOfId) {
			if (!input.reason?.trim()) {
				throw new ConstructionError(
					"IMPORT_REPROCESS_REASON_REQUIRED",
					"Motivo obrigatorio para reprocessamento",
					422,
				);
			}
			const origin = await getImportById(ownerId, input.reprocessOfId);
			if (!origin || origin.workId !== workId) {
				throw new ConstructionError(
					"INVALID_REPROCESS_ORIGIN",
					"Origem de reprocessamento incompativel com a obra",
					422,
				);
			}
		}

		await importParseSemaphore.acquire();
		const memoryChecker = defaultMemoryChecker();
		let batchId: string | null = null;
		try {
			const stored = await importStorage.put(
				crypto.randomUUID(),
				input.file,
				new Date(Date.now() + IMPORT_LIMITS.batchTtlDays * 24 * 60 * 60 * 1000),
			);

			const created = await importBatchRepository.createImportBatch({
				ownerId,
				workId,
				model: input.model,
				title: input.title ?? null,
				version: IMPORT_MODEL_VERSION,
				fileName: input.fileName,
				fileSha256: stored.sha256,
				storageKey: stored.storageKey,
				expiresAt: new Date(
					Date.now() + IMPORT_LIMITS.batchTtlDays * 24 * 60 * 60 * 1000,
				),
				contractRequestId: input.contractRequestId ?? null,
				reprocessOfId: input.reprocessOfId ?? null,
				reason: input.reason ?? null,
			});
			batchId = created.id;

			const buffer = await readAllChunks(stored.storageKey);
			await this.assertWorkbookShape(buffer);

			const workbook = parseWorkbookByKind(
				buffer,
				input.fileName,
				input.model as WorkbookKind,
			);
			const validation = validateWorkbookByKind(
				workbook,
				input.model as WorkbookKind,
			);

			await this.persistStagingRows(
				batchId,
				workbook,
				validation.errors,
				validation.warnings,
				memoryChecker,
			);

			const [rowCount, validCount, invalidCount, warningCount] =
				await Promise.all([
					importBatchRepository.countImportRows(batchId),
					importBatchRepository.countImportRows(batchId, "VALID"),
					importBatchRepository.countImportRows(batchId, "INVALID"),
					importBatchRepository.countImportRows(batchId, "WARNING"),
				]);

			await importBatchRepository.updateImportBatch(batchId, {
				status: "READY",
				rowCount,
				validCount,
				invalidCount,
				warningCount,
				parsedWorkbook: workbook as unknown as Prisma.InputJsonValue,
			});

			return this.getPreviewPage(ownerId, workId, batchId, 1);
		} catch (error) {
			if (batchId) {
				await importBatchRepository
					.updateImportBatch(batchId, { status: "FAILED" })
					.catch(() => undefined);
			}
			throw error;
		} finally {
			importParseSemaphore.release();
		}
	}

	private async assertWorkbookShape(buffer: Uint8Array) {
		if (buffer.byteLength > IMPORT_LIMITS.maxFileMb * MB) {
			throw new ConstructionError(
				"IMPORT_FILE_TOO_LARGE",
				`Arquivo excede o limite de tamanho de ${IMPORT_LIMITS.maxFileMb} MB`,
				413,
			);
		}
		const sheetCount = XLSX.read(buffer, { type: "buffer" }).SheetNames.length;
		if (sheetCount > IMPORT_LIMITS.maxSheets) {
			throw new ConstructionError(
				"IMPORT_SHEET_LIMIT_EXCEEDED",
				`Workbook excede o limite de ${IMPORT_LIMITS.maxSheets} planilhas`,
				422,
			);
		}
	}

	/**
	 * Confirma o lote: revalida versao/linhas e aplica o efeito IMPORT_CONFIRM.
	 * Efeito direto por padrao; politica MANUAL configurada na obra cria
	 * ApprovalRequest PENDING.
	 */
	async confirmImport(input: {
		ownerId: string;
		actorId: string;
		workId: string;
		batchId: string;
		expectedBatchVersion: number;
		selectedRowIds: string[];
		idempotencyKey: string;
	}): Promise<{
		importId: string | null;
		approvalRequestId: string | null;
		status: "PENDING" | "APPROVED";
	}> {
		assertSelectedRowIds(input.selectedRowIds);
		const batch = await importBatchRepository.findImportBatch(
			input.ownerId,
			input.workId,
			input.batchId,
		);
		if (!batch || batch.workId !== input.workId) {
			throw new ConstructionError(
				"NOT_FOUND",
				"Lote de importacao nao encontrado",
				404,
			);
		}
		if (batch.status !== "READY" || batch.expiresAt <= new Date()) {
			throw new ConstructionError(
				"IMPORT_BATCH_NOT_READY",
				"Lote nao esta pronto para confirmacao",
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
		const selectedRows = await importBatchRepository.listImportRowsByIds(
			input.batchId,
			input.selectedRowIds,
		);
		if (selectedRows.length !== new Set(input.selectedRowIds).size) {
			throw new ConstructionError(
				"IMPORT_INVALID_SELECTION",
				"Linhas selecionadas inexistentes no lote",
				422,
			);
		}
		const invalidSelection = selectedRows.filter(
			(row) => row.status !== "VALID" && row.status !== "WARNING",
		);
		if (invalidSelection.length > 0) {
			throw new ConstructionError(
				"IMPORT_INVALID_SELECTION",
				"Linhas invalidas nao podem ser confirmadas",
				422,
			);
		}

		const { submitApproval } = await import(
			"../../governance/approval.service"
		);
		let result: Awaited<ReturnType<typeof submitApproval>>;
		try {
			result = await submitApproval({
				actorId: input.actorId,
				resourceType: "IMPORT_BATCH",
				resourceId: input.batchId,
				effectAction: "IMPORT_CONFIRM",
				payload: {
					actorId: input.actorId,
					workId: input.workId,
					batchId: input.batchId,
					selectedRowIds: input.selectedRowIds,
					expectedBatchVersion: input.expectedBatchVersion,
					model: batch.model,
					idempotencyKey: input.idempotencyKey,
				},
				expectedVersion: batch.batchVersion,
				idempotencyKey: input.idempotencyKey,
			});
		} catch (error) {
			await importBatchRepository
				.updateImportBatch(input.batchId, {
					status: "FAILED",
					errorSummary: {
						reason: "CONFIRM_FAILED",
						message:
							error instanceof Error
								? error.message.slice(0, 500)
								: "Falha na confirmacao",
					},
				})
				.catch(() => undefined);
			throw error;
		}

		if (result.status === "APPROVED") {
			const confirmed = await importBatchRepository.findImportBatch(
				input.ownerId,
				input.workId,
				input.batchId,
			);
			return {
				importId: confirmed?.confirmedImportId ?? null,
				approvalRequestId: null,
				status: "APPROVED",
			};
		}
		return {
			importId: null,
			approvalRequestId: result.approvalRequestId,
			status: "PENDING",
		};
	}

	async cancelBatch(ownerId: string, workId: string, batchId: string) {
		await this.assertContext(ownerId, workId);
		const batch = await importBatchRepository.findImportBatch(
			ownerId,
			workId,
			batchId,
		);
		if (!batch) {
			throw new ConstructionError(
				"NOT_FOUND",
				"Lote de importacao nao encontrado",
				404,
			);
		}
		if (batch.status === "CONFIRMED") {
			throw new ConstructionError(
				"IMPORT_BATCH_ALREADY_CONFIRMED",
				"Este lote ja foi confirmado",
				409,
			);
		}
		await importBatchRepository.updateImportBatch(batchId, {
			status: "CANCELLED",
			errorSummary: { reason: "USER_CANCELLED" },
		});
		await importStorage.remove(batch.storageKey);
		return { batchId, cancelled: true };
	}

	async getPreviewPage(
		ownerId: string,
		workId: string,
		batchId: string,
		page = 1,
		pageSize = IMPORT_LIMITS.previewPageSize,
	): Promise<ImportPreviewPage> {
		const batch = await importBatchRepository.findImportBatch(
			ownerId,
			workId,
			batchId,
		);
		if (!batch) {
			throw new ConstructionError(
				"NOT_FOUND",
				"Lote de importacao nao encontrado",
				404,
			);
		}
		const safePage = Math.max(1, page);
		const safePageSize = Math.min(
			Math.max(1, pageSize),
			IMPORT_LIMITS.previewPageSize,
		);
		const [rows, total, validCount, invalidCount, warningCount] =
			await Promise.all([
				importBatchRepository.listImportRowsPage(
					batchId,
					safePage,
					safePageSize,
				),
				importBatchRepository.countImportRows(batchId),
				importBatchRepository.countImportRows(batchId, "VALID"),
				importBatchRepository.countImportRows(batchId, "INVALID"),
				importBatchRepository.countImportRows(batchId, "WARNING"),
			]);

		return {
			batchId: batch.id,
			batchVersion: batch.batchVersion,
			model: batch.model,
			version: batch.version,
			fileSha256: batch.fileSha256,
			expiresAt: batch.expiresAt.toISOString(),
			page: safePage,
			pageSize: safePageSize,
			rows: rows.map(toPreviewRow),
			summary: {
				total,
				valid: validCount,
				invalid: invalidCount,
				warnings: warningCount,
			},
			impact: {
				create: validCount,
				update: 0,
				reject: invalidCount,
				amount: null,
			},
		};
	}

	async listSelectableRowIds(
		ownerId: string,
		workId: string,
		batchId: string,
	): Promise<{ batchId: string; rowIds: string[] }> {
		const rowIds = await importBatchRepository.listSelectableImportRowIds(
			ownerId,
			workId,
			batchId,
		);
		if (!rowIds) {
			throw new ConstructionError(
				"NOT_FOUND",
				"Lote de importacao nao encontrado",
				404,
			);
		}

		return {
			batchId,
			rowIds,
		};
	}

	/**
	 * Lista os lotes da obra (historico), preservando os anteriores.
	 */
	async listBatches(ownerId: string, workId: string, page = 1, pageSize = 20) {
		return importBatchRepository.listImportBatches(ownerId, {
			workId,
			page,
			pageSize,
		});
	}

	/**
	 * Exporta as linhas rejeitadas do lote como XLSX (colunas originais +
	 * diagnostico), relendo o arquivo bruto do storage.
	 */
	async exportRejectedSheet(
		ownerId: string,
		workId: string,
		batchId: string,
	): Promise<Uint8Array> {
		const batch = await importBatchRepository.findImportBatch(
			ownerId,
			workId,
			batchId,
		);
		if (!batch || batch.workId !== workId) {
			throw new ConstructionError(
				"NOT_FOUND",
				"Lote de importacao nao encontrado",
				404,
			);
		}
		const buffer = await readAllChunks(batch.storageKey);
		return buildRejectedSheet(
			buffer,
			batch.fileName,
			batch.model as WorkbookKind,
		);
	}

	/**
	 * Persiste as linhas do staging planilha a planilha (createMany por aba),
	 * medindo o heap entre planilhas e abortando com IMPORT_MEMORY_LIMIT_EXCEEDED
	 * quando o teto e estourado.
	 */
	private async persistStagingRows(
		batchId: string,
		workbook: ParsedWorkbookUnified,
		errors: ImportValidationError[],
		warnings: ImportValidationError[],
		memoryChecker: (
			limits: typeof DEFAULT_IMPORT_MEMORY_BUDGET,
		) => Promise<void>,
	) {
		const errorByKey = new Map(errors.map((error) => [issueKey(error), error]));
		const warningByKey = new Map(
			warnings.map((warning) => [issueKey(warning), warning]),
		);

		const sheets: Array<{ sheet: string; rows: SheetRow[] }> = [
			{ sheet: "Orcamento", rows: workbook.budgetRows as SheetRow[] },
			{ sheet: "Itens do Orcamento", rows: workbook.itensRows as SheetRow[] },
			{
				sheet: "Cronograma Original",
				rows: workbook.baselineRows as SheetRow[],
			},
			{ sheet: "Replanejamento", rows: workbook.replanningRows as SheetRow[] },
			{ sheet: "Medicoes Obra", rows: workbook.measurementRows as SheetRow[] },
			{ sheet: "Contrato", rows: workbook.contractRows as SheetRow[] },
			{ sheet: "Servicos", rows: workbook.serviceRows as SheetRow[] },
			{
				sheet: "Medicoes Contrato",
				rows: workbook.contractMeasurementRows as SheetRow[],
			},
			{ sheet: "Pagamentos", rows: workbook.paymentRows as SheetRow[] },
			{
				sheet: "Custos Realizados",
				rows: workbook.actualCostRows as SheetRow[],
			},
			{ sheet: "Mapa de Cotacao", rows: workbook.quotationRows as SheetRow[] },
		].filter((entry) => entry.rows.length > 0);

		let totalRows = 0;
		let seq = 0;
		for (const entry of sheets) {
			await memoryChecker(DEFAULT_IMPORT_MEMORY_BUDGET);
			const rows: Array<{
				sheet: string;
				rowNumber: number;
				values: Prisma.InputJsonValue;
				status: ImportRowStatus;
				issues: ImportPreviewRow["issues"] | null;
				seq: number;
			}> = [];
			for (const row of entry.rows) {
				seq += 1;
				const key = `${entry.sheet}:${row.rowNumber}`;
				const error = errorByKey.get(key);
				const warning = warningByKey.get(key);
				const status: ImportRowStatus = error
					? "INVALID"
					: warning
						? "WARNING"
						: "VALID";
				rows.push({
					sheet: entry.sheet,
					rowNumber: row.rowNumber,
					values: row as unknown as Prisma.InputJsonValue,
					status,
					issues: error ? issuesOf(error) : warning ? issuesOf(warning) : null,
					seq,
				});
			}
			totalRows += rows.length;
			if (totalRows > IMPORT_LIMITS.maxRows) {
				throw new ConstructionError(
					"IMPORT_ROW_LIMIT_EXCEEDED",
					`Workbook excede o limite de ${IMPORT_LIMITS.maxRows} linhas`,
					422,
				);
			}
			await importBatchRepository.createImportRows(batchId, rows);
		}
	}
}

function toPreviewRow(row: {
	id: string;
	sheet: string;
	rowNumber: number;
	values: unknown;
	status: string;
	issues: unknown;
}): ImportPreviewRow {
	return {
		id: row.id,
		sheet: row.sheet,
		rowNumber: row.rowNumber,
		values: row.values as Record<string, unknown>,
		status: row.status as ImportRowStatus,
		issues: Array.isArray(row.issues)
			? (row.issues as ImportPreviewRow["issues"])
			: [],
	};
}

async function readAllChunks(storageKey: string): Promise<Uint8Array> {
	const parts: Uint8Array[] = [];
	let total = 0;
	for await (const part of importStorage.chunks(storageKey)) {
		parts.push(part);
		total += part.length;
	}
	const joined = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		joined.set(part, offset);
		offset += part.length;
	}
	return joined;
}

export const constructionImportBatchService =
	new ConstructionImportBatchService();
