import { ConstructionError } from "../../../lib/errors";

export const IMPORT_LIMITS = {
	maxFileMb: 25,
	maxSheets: 20,
	maxRows: 100_000,
	previewPageSize: 500,
	batchPageSize: 100,
	batchTtlDays: 7,
} as const;

export const MAX_IMPORT_UPLOAD_BYTES = IMPORT_LIMITS.maxFileMb * 1024 * 1024;

const WORKBOOK_ROW_KEYS = [
	"budgetRows",
	"itensRows",
	"baselineRows",
	"replanningRows",
	"measurementRows",
	"contractRows",
	"serviceRows",
	"contractMeasurementRows",
	"paymentRows",
	"actualCostRows",
	"quotationRows",
] as const;

export function assertParsedWorkbookLimits(
	workbook: {
		sheetNames: readonly unknown[];
	} & Record<string, unknown>,
): void {
	if (workbook.sheetNames.length > IMPORT_LIMITS.maxSheets) {
		throw new ConstructionError(
			"IMPORT_SHEET_LIMIT_EXCEEDED",
			`Workbook excede o limite de ${IMPORT_LIMITS.maxSheets} planilhas`,
			422,
		);
	}

	const rowCount = WORKBOOK_ROW_KEYS.reduce(
		(total, key) =>
			total + (Array.isArray(workbook[key]) ? workbook[key].length : 0),
		0,
	);
	if (rowCount > IMPORT_LIMITS.maxRows) {
		throw new ConstructionError(
			"IMPORT_ROW_LIMIT_EXCEEDED",
			`Workbook excede o limite de ${IMPORT_LIMITS.maxRows} linhas`,
			422,
		);
	}
}

export function parseImportPagination(
	pageValue: unknown,
	pageSizeValue: unknown,
	defaults: { page: number; pageSize: number },
	maxPageSize: number,
): { page: number; pageSize: number } {
	const page = pageValue === undefined ? defaults.page : Number(pageValue);
	const pageSize =
		pageSizeValue === undefined ? defaults.pageSize : Number(pageSizeValue);

	if (
		!Number.isInteger(page) ||
		page < 1 ||
		!Number.isInteger(pageSize) ||
		pageSize < 1 ||
		pageSize > maxPageSize
	) {
		throw new ConstructionError(
			"INVALID_QUERY",
			`Paginacao invalida: page deve ser >= 1 e pageSize deve estar entre 1 e ${maxPageSize}`,
			400,
		);
	}

	return { page, pageSize };
}
