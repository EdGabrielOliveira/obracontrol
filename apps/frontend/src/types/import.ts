import type { PaginatedResponse } from "./shared";

export type ImportWorkbookResponse = {
	importId?: string;
	workId?: string;
	status?: "IMPORTED";
	rowCount?: number;
	warningCount?: number;
	importedSections?: string[];
	processedSheets?: string[];
	importedCount?: number;
	rejectedCount?: number;
	imported?: number;
	paymentsImported?: number;
	contractsImported?: number;
	warnings?: ImportValidationError[];
	errors?: ImportValidationError[];
};

export type ImportValidationError = {
	row?: number;
	field?: string;
	sheet?: string;
	code: string;
	message: string;
	dependency?: string;
};

export type ImportValidationErrorResponse = {
	message: string;
	errors: ImportValidationError[];
};

export type ImportPreviewResponse = Omit<
	ImportWorkbookResponse,
	"importId" | "workId" | "status"
> & {
	preview: true;
	importId: null;
	workId: null;
	status: "PENDING";
};

export type ConstructionImportRecord = {
	id: string;
	ownerId: string;
	workId: string | null;
	fileName: string;
	sheetName: string | null;
	rowCount: number;
	importedSections: string[];
	status: string;
	errorSummary: unknown;
	reprocessOfId: string | null;
	createdAt: string;
	updatedAt: string;
};

export type ImportListResponse = PaginatedResponse<ConstructionImportRecord>;

export type ConstructionTemplateKind =
	| "orcamento"
	| "orcamento-aditivo"
	| "cronograma"
	| "medicao-obra"
	| "medicao-contrato"
	| "custos"
	| "cotacao";

export type ImportBatchStatus =
	| "PARSING"
	| "READY"
	| "CONFIRMED"
	| "PENDING_CONFIRM"
	| "EXPIRED"
	| "FAILED"
	| "CANCELLED";

export type ImportBatchRecord = {
	id: string;
	ownerId: string;
	workId: string | null;
	model: string;
	version: string;
	fileName: string;
	fileSha256: string;
	status: ImportBatchStatus;
	rowCount: number;
	validCount: number;
	invalidCount: number;
	warningCount: number;
	batchVersion: number;
	reprocessOfId: string | null;
	confirmedImportId: string | null;
	confirmedAt: string | null;
	expiresAt: string;
	createdAt: string;
	updatedAt: string;
};

export type ImportBatchListResponse = {
	data: ImportBatchRecord[];
	total: number;
	page: number;
	pageSize: number;
};

export type SelectableImportRowIdsResponse = {
	batchId: string;
	rowIds: string[];
};

export type ImportPreviewRowStatus =
	| "VALID"
	| "WARNING"
	| "INVALID"
	| "EXCLUDED";

export type ImportPreviewRow = {
	id: string;
	sheet: string;
	rowNumber: number;
	values: Record<string, unknown>;
	status: ImportPreviewRowStatus;
	issues: Array<{
		column: string | null;
		code: string;
		message: string;
		value: string | null;
	}>;
};

export type ImportPreviewPage = {
	batchId: string;
	batchVersion: number;
	model: string;
	version: string;
	fileSha256: string;
	expiresAt: string;
	page: number;
	pageSize: number;
	rows: ImportPreviewRow[];
	errors?: ImportValidationError[];
	warnings?: ImportValidationError[];
	summary: {
		total: number;
		valid: number;
		invalid: number;
		warnings: number;
	};
	impact: {
		create: number;
		update: number;
		reject: number;
		amount: string | null;
	};
};

export type ImportConfirmationResponse = {
	importId: string | null;
	approvalRequestId: string | null;
	status: "PENDING" | "APPROVED";
};
