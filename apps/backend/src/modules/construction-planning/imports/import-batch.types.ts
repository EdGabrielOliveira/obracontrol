export type ImportRowStatus = "VALID" | "WARNING" | "INVALID" | "EXCLUDED";

export type ImportPreviewRow = {
	id: string;
	sheet: string;
	rowNumber: number;
	title?: string | null;
	values: Record<string, unknown>;
	status: ImportRowStatus;
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
	title?: string | null;
	version: string;
	fileSha256: string;
	expiresAt: string;
	page: number;
	pageSize: number;
	rows: ImportPreviewRow[];
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

export type ImportBatchCreateInput = {
	fileName: string;
	model: string;
	title?: string | null;
	file: AsyncIterable<Uint8Array>;
	reprocessOfId?: string | null;
	reason?: string | null;
};

export type ImportConfirmationPayload = {
	actorId: string;
	workId: string;
	batchId: string;
	selectedRowIds: string[];
	expectedBatchVersion: number;
	model: string;
	idempotencyKey: string;
};
