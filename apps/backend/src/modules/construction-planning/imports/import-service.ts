import type { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import { ConstructionError } from "../../../lib/errors";
import { logger } from "../../../lib/logger";
import { metrics } from "../../../lib/metrics";
import { normalizeText } from "../../../lib/text-utils";
import type { WorkbookKind } from "../templates/workbook-contracts";
import type { ImportValidationError, ParsedWorkbook } from "../types";
import {
	existingEntityLookup,
	resolveActualCostDependencies,
	resolveBaselineDependencies,
	resolveItensDependencies,
	resolveMeasurementDependencies,
	resolveReplanningDependencies,
} from "./dependency-resolver";
import * as importRepository from "./import-repository";
import type {
	NormalizedActualCost,
	NormalizedBaselineSchedule,
	NormalizedBudgetItem,
	NormalizedMeasurement,
	NormalizedScheduleRevision,
	ValidationResult,
} from "./normalized-types";
import {
	findSheetMap,
	parseWorkbookByKind,
	SHEET_NAME_ALIASES,
} from "./parser";
import { validateWorkbookByKind } from "./validator";

type ImportRepository = Pick<
	typeof importRepository,
	| "findWorkByOwnerAndCode"
	| "createWorkWithImport"
	| "replaceWorkWithImport"
	| "getImportById"
>;

type ResolvedDependencies = {
	acceptedItens: NormalizedBudgetItem[];
	acceptedBaselines: NormalizedBaselineSchedule[];
	acceptedRevisions: NormalizedScheduleRevision[];
	acceptedMeasurements: NormalizedMeasurement[];
	acceptedActualCosts: NormalizedActualCost[];
	importedCount: number;
	rejectedCount: number;
};

function structuralErrors(
	validation: ValidationResult,
): ImportValidationError[] {
	return validation.errors.filter((error) => error.row === undefined);
}

function resolveWorkCode(code: string): string {
	return code.trim() || `OBRA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export function rejectedRowCount(errors: ImportValidationError[]): number {
	return new Set(
		errors.map((error) => `${error.sheet ?? ""}:${error.row ?? ""}`),
	).size;
}

function persistedBudgetItemCount(
	items: ValidationResult["normalizedRows"],
	itens: ValidationResult["normalizedItens"],
): number {
	const seen = new Set<string>();
	let count = 0;
	for (const row of [...items, ...itens]) {
		if (seen.has(row.index)) continue;
		seen.add(row.index);
		count++;
	}
	return count;
}

function buildErrorSummary(
	validation: ValidationResult,
	rejectedCount: number,
): Prisma.InputJsonValue | null {
	if (validation.errors.length === 0 && validation.warnings.length === 0) {
		return null;
	}
	return {
		rejectedCount,
		warnings: validation.warnings,
		errors: validation.errors,
	};
}

function actualSheetName(
	sheetMap: Map<string, string>,
	errorSheet: string,
): string | null {
	const normalizedError = normalizeText(errorSheet);
	for (const [expectedName, actualName] of sheetMap) {
		const aliases = SHEET_NAME_ALIASES[expectedName] ?? [expectedName];
		if (aliases.some((alias) => normalizeText(alias) === normalizedError)) {
			return actualName;
		}
	}
	return null;
}

export class ConstructionImportService {
	constructor(
		private readonly repository: ImportRepository = importRepository,
	) {}

	private validateWorkbook(
		workbook: ParsedWorkbook,
		kind: WorkbookKind,
	): ValidationResult {
		const validation = validateWorkbookByKind(workbook, kind);
		const structural = structuralErrors(validation);
		if (structural.length > 0) {
			throw new ConstructionError(
				"VALIDATION_FAILED",
				"Planilha invalida",
				422,
				structural,
			);
		}
		return validation;
	}

	private async resolveDependencies(
		context: { ownerId: string; workId: string | null },
		validation: ValidationResult,
	): Promise<ResolvedDependencies> {
		const budgetSheetPresent = validation.processedSheets.includes("Orcamento");
		const budgetIndexes: Set<string> | null = budgetSheetPresent
			? new Set(validation.normalizedRows.map((row) => row.index))
			: null;

		const acceptedItens = await resolveItensDependencies(
			validation.normalizedItens,
			budgetIndexes,
			context,
			existingEntityLookup,
			validation.errors,
		);

		const acceptedBaselines = await resolveBaselineDependencies(
			validation.baselineSchedules,
			budgetIndexes,
			context,
			existingEntityLookup,
			validation.errors,
		);

		const baselineSheetPresent = validation.processedSheets.includes(
			"Cronograma Original",
		);
		const baselineIndexes: Set<string> | null = baselineSheetPresent
			? new Set(acceptedBaselines.map((row) => row.index))
			: null;

		const acceptedRevisions = await resolveReplanningDependencies(
			validation.scheduleRevisions,
			baselineIndexes,
			context,
			existingEntityLookup,
			validation.errors,
		);

		const acceptedMeasurements = await resolveMeasurementDependencies(
			validation.measurements,
			budgetIndexes,
			context,
			existingEntityLookup,
			validation.errors,
		);

		const acceptedActualCosts = await resolveActualCostDependencies(
			validation.actualCosts,
			budgetIndexes,
			context,
			existingEntityLookup,
			validation.errors,
		);

		const importedCount =
			persistedBudgetItemCount(validation.normalizedRows, acceptedItens) +
			acceptedBaselines.length +
			acceptedRevisions.length +
			acceptedMeasurements.length +
			acceptedActualCosts.length;
		const rejectedCount = rejectedRowCount(validation.errors);

		return {
			acceptedItens,
			acceptedBaselines,
			acceptedRevisions,
			acceptedMeasurements,
			acceptedActualCosts,
			importedCount,
			rejectedCount,
		};
	}

	async previewWorkbook(
		bytes: Uint8Array,
		fileName: string,
		kind: WorkbookKind,
	) {
		const workbook = parseWorkbookByKind(bytes, fileName, kind);
		const validation = this.validateWorkbook(workbook, kind);
		const resolved = await this.resolveDependencies(
			{ ownerId: "", workId: null },
			validation,
		);

		return {
			importId: null,
			workId: null,
			status: "PENDING",
			preview: true,
			rowCount: resolved.importedCount,
			warningCount: validation.warnings.length,
			importedSections: validation.work.importedSections,
			processedSheets: validation.processedSheets,
			importedCount: resolved.importedCount,
			rejectedCount: resolved.rejectedCount,
			warnings: validation.warnings,
			errors: validation.errors,
		};
	}

	async importWorkbook(
		ownerId: string,
		workbook: ParsedWorkbook,
		costCenterId: string,
		replaceExisting = true,
		options: {
			kind?: WorkbookKind;
			reprocessOfId?: string | null;
			reason?: string | null;
			fileName?: string | null;
			audit?: (
				tx: Prisma.TransactionClient,
				importId: string,
				summary: {
					status: string;
					rowCount: number;
					importedCount: number;
					rejectedCount: number;
					warningCount: number;
					errors: ImportValidationError[];
					warnings: ImportValidationError[];
				},
			) => Promise<void>;
		} = {},
	) {
		const kind = options.kind ?? "obra-completa";
		if (kind === "medicao-contrato") {
			throw new ConstructionError(
				"MODEL_NOT_SUPPORTED",
				"Medicoes de contrato nao sao importadas por este fluxo: use o fluxo de importacao de medicoes do contrato",
				422,
			);
		}
		const reprocessOfId = options.reprocessOfId ?? null;
		const start = performance.now();
		logger.info("import.started", {
			kind,
			costCenterId,
			fileName: options.fileName ?? null,
			replaceExisting,
			reprocessOfId: reprocessOfId ?? null,
		});
		try {
			const validation = this.validateWorkbook(workbook, kind);
			const work = {
				...validation.work,
				code: resolveWorkCode(validation.work.code),
			};

			const existingWork = await this.repository.findWorkByOwnerAndCode(
				ownerId,
				work.code,
			);

			if (existingWork && !replaceExisting) {
				throw new ConstructionError(
					"WORK_EXISTS",
					"Obra ja existe com esse codigo",
					409,
				);
			}

			if (reprocessOfId) {
				const origin = await this.repository.getImportById(
					ownerId,
					reprocessOfId,
				);
				if (!origin) {
					throw new ConstructionError(
						"NOT_FOUND",
						"Origem de reprocessamento nao encontrada",
						404,
					);
				}
				if (origin.workId === null || origin.workId !== existingWork?.id) {
					throw new ConstructionError(
						"INVALID_REPROCESS_ORIGIN",
						"Origem de reprocessamento incompativel com a obra",
						422,
					);
				}
			}

			const resolved = await this.resolveDependencies(
				{ ownerId, workId: existingWork?.id ?? null },
				validation,
			);

			const errorSummary = buildErrorSummary(
				validation,
				resolved.rejectedCount,
			);

			const persistOptions = {
				itens: resolved.acceptedItens,
				baselineSchedules: resolved.acceptedBaselines,
				scheduleRevisions: resolved.acceptedRevisions,
				measurements: resolved.acceptedMeasurements,
				actualCosts: resolved.acceptedActualCosts,
				rowCount: resolved.importedCount,
				reprocessOfId,
				errorSummary,
				audit: options.audit
					? (tx: Prisma.TransactionClient, importId: string) => {
							const audit = options.audit;
							if (!audit) return Promise.resolve();
							return audit(tx, importId, {
								status: "IMPORTED",
								rowCount: resolved.importedCount,
								importedCount: resolved.importedCount,
								rejectedCount: resolved.rejectedCount,
								warningCount: validation.warnings.length,
								errors: validation.errors,
								warnings: validation.warnings,
							});
						}
					: undefined,
			};

			const imp = existingWork
				? await this.repository.replaceWorkWithImport(
						ownerId,
						existingWork.id,
						work,
						validation.normalizedRows,
						persistOptions,
					)
				: await this.repository.createWorkWithImport(
						ownerId,
						work,
						costCenterId,
						validation.normalizedRows,
						persistOptions,
					);

			const result = {
				importId: imp.importId,
				workId: imp.workId,
				status: "IMPORTED" as const,
				rowCount: resolved.importedCount,
				warningCount: validation.warnings.length,
				importedSections: validation.work.importedSections,
				processedSheets: validation.processedSheets,
				importedCount: resolved.importedCount,
				rejectedCount: resolved.rejectedCount,
				warnings: validation.warnings,
				errors: validation.errors,
			};
			metrics.increment("import.count");
			if (result.rejectedCount > 0) {
				metrics.increment("import.rejected", result.rejectedCount);
			}
			logger.info("import.completed", {
				workId: result.workId,
				importId: result.importId,
				kind,
				fileName: options.fileName ?? null,
				importedCount: result.importedCount,
				rejectedCount: result.rejectedCount,
				warningCount: result.warningCount,
				rowCount: result.rowCount,
				durationMs: performance.now() - start,
			});
			return result;
		} finally {
			metrics.timing("import.duration_ms", performance.now() - start);
		}
	}

	async buildRejectedSheet(
		bytes: Uint8Array,
		fileName: string,
		kind: WorkbookKind,
	): Promise<Uint8Array> {
		const workbook = parseWorkbookByKind(bytes, fileName, kind);
		const validation = this.validateWorkbook(workbook, kind);
		await this.resolveDependencies({ ownerId: "", workId: null }, validation);

		const xlsxWorkbook = XLSX.read(bytes, { type: "buffer" });
		const sheetMap = findSheetMap(xlsxWorkbook, kind);

		const rowsBySheet = new Map<
			string,
			{ headers: unknown[]; rows: unknown[][] }
		>();
		for (const error of validation.errors) {
			if (error.row === undefined || !error.sheet) continue;
			const actualSheet = actualSheetName(sheetMap, error.sheet);
			if (!actualSheet) continue;

			const ws = xlsxWorkbook.Sheets[actualSheet];
			const sheetRows = XLSX.utils.sheet_to_json(ws, {
				header: 1,
				raw: true,
				defval: null,
				blankrows: false,
			}) as unknown[][];
			const originalCells = (sheetRows[error.row - 1] ?? []) as unknown[];

			const existing = rowsBySheet.get(actualSheet);
			const entry: { headers: unknown[]; rows: unknown[][] } = existing ?? {
				headers: (sheetRows[0] ?? []) as unknown[],
				rows: [],
			};
			entry.rows.push([
				...originalCells,
				error.sheet,
				error.row,
				error.code,
				error.message,
			]);
			rowsBySheet.set(actualSheet, entry);
		}

		const out = XLSX.utils.book_new();
		if (rowsBySheet.size === 0) {
			const ws = XLSX.utils.aoa_to_sheet([
				["Aba", "Linha", "Código", "Mensagem"],
			]);
			XLSX.utils.book_append_sheet(out, ws, "Rejeitadas");
		} else {
			for (const [sheetName, entry] of rowsBySheet) {
				const ws = XLSX.utils.aoa_to_sheet([
					[...entry.headers, "Aba", "Linha", "Código", "Mensagem"],
					...entry.rows,
				]);
				XLSX.utils.book_append_sheet(out, ws, sheetName);
			}
		}

		return new Uint8Array(
			XLSX.write(out, { type: "buffer", bookType: "xlsx" }),
		);
	}

	/**
	 * Aplica um workbook ja validado (staging do Plano 5) sobre uma obra
	 * existente dentro da transacao do handler IMPORT_CONFIRM.
	 */
	async applyStagedWorkbook(
		ownerId: string,
		workId: string,
		workbook: ParsedWorkbook,
		options: {
			kind?: WorkbookKind;
			reprocessOfId?: string | null;
			errorSummary?: Prisma.InputJsonValue | null;
			audit?: (
				tx: Prisma.TransactionClient,
				importId: string,
				summary: {
					status: string;
					rowCount: number;
					importedCount: number;
					rejectedCount: number;
					warningCount: number;
					errors: ImportValidationError[];
					warnings: ImportValidationError[];
				},
			) => Promise<void>;
			db?: importRepository.ImportPersistClient;
		} = {},
	) {
		const kind = options.kind ?? "obra-completa";
		if (kind === "medicao-contrato") {
			throw new ConstructionError(
				"MODEL_NOT_SUPPORTED",
				"Medicoes de contrato nao sao importadas por este fluxo: use o fluxo de importacao de medicoes do contrato",
				422,
			);
		}
		const validation = this.validateWorkbook(workbook, kind);
		const resolved = await this.resolveDependencies(
			{ ownerId, workId },
			validation,
		);
		const errorSummary =
			options.errorSummary ??
			buildErrorSummary(validation, resolved.rejectedCount);

		const imp = await this.repository.replaceWorkWithImport(
			ownerId,
			workId,
			validation.work,
			validation.normalizedRows,
			{
				itens: resolved.acceptedItens,
				baselineSchedules: resolved.acceptedBaselines,
				scheduleRevisions: resolved.acceptedRevisions,
				measurements: resolved.acceptedMeasurements,
				actualCosts: resolved.acceptedActualCosts,
				rowCount: resolved.importedCount,
				reprocessOfId: options.reprocessOfId ?? null,
				errorSummary,
				audit: options.audit
					? (tx: Prisma.TransactionClient, importId: string) => {
							const audit = options.audit;
							if (!audit) return Promise.resolve();
							return audit(tx, importId, {
								status: "IMPORTED",
								rowCount: resolved.importedCount,
								importedCount: resolved.importedCount,
								rejectedCount: resolved.rejectedCount,
								warningCount: validation.warnings.length,
								errors: validation.errors,
								warnings: validation.warnings,
							});
						}
					: undefined,
				db: options.db,
			},
		);

		return {
			importId: imp.importId,
			workId: imp.workId,
			status: "IMPORTED" as const,
			rowCount: resolved.importedCount,
			warningCount: validation.warnings.length,
			importedSections: validation.work.importedSections,
			processedSheets: validation.processedSheets,
			importedCount: resolved.importedCount,
			rejectedCount: resolved.rejectedCount,
			warnings: validation.warnings,
			errors: validation.errors,
		};
	}
}
export const constructionImportService = new ConstructionImportService();

export function importWorkbook(
	ownerId: string,
	workbook: ParsedWorkbook,
	costCenterId: string,
	replaceExisting = true,
	options?: {
		kind?: WorkbookKind;
		reprocessOfId?: string | null;
		reason?: string | null;
		fileName?: string | null;
		audit?: (
			tx: Prisma.TransactionClient,
			importId: string,
			summary: {
				status: string;
				rowCount: number;
				importedCount: number;
				rejectedCount: number;
				warningCount: number;
				errors: ImportValidationError[];
				warnings: ImportValidationError[];
			},
		) => Promise<void>;
	},
) {
	return constructionImportService.importWorkbook(
		ownerId,
		workbook,
		costCenterId,
		replaceExisting,
		options,
	);
}

export function previewWorkbook(
	bytes: Uint8Array,
	fileName: string,
	kind: WorkbookKind,
) {
	return constructionImportService.previewWorkbook(bytes, fileName, kind);
}

export function buildRejectedSheet(
	bytes: Uint8Array,
	fileName: string,
	kind: WorkbookKind,
) {
	return constructionImportService.buildRejectedSheet(bytes, fileName, kind);
}
