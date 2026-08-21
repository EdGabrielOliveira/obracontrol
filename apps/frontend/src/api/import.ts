import type {
	ConstructionImportRecord,
	ConstructionTemplateKind,
	ImportBatchListResponse,
	ImportConfirmationResponse,
	ImportPreviewPage,
	ImportWorkbookResponse,
	SelectableImportRowIdsResponse,
} from "@/types/import";
import { api } from "./api";

export interface ImportWorkbookContext {
	workId?: string;
	contractId?: string;
}

function requireContextId(value: string | undefined, label: string): string {
	if (!value) {
		throw new Error(`${label} é obrigatório para esta importação.`);
	}
	return value;
}

async function postImport(
	url: string,
	formData: FormData,
): Promise<ImportWorkbookResponse> {
	const { data } = await api.post<ImportWorkbookResponse>(url, formData, {
		headers: { "Content-Type": "multipart/form-data" },
	});
	return data;
}

async function putImport(
	url: string,
	formData: FormData,
): Promise<ImportWorkbookResponse> {
	const { data } = await api.put<ImportWorkbookResponse>(url, formData, {
		headers: { "Content-Type": "multipart/form-data" },
	});
	return data;
}

export async function getImport(
	importId: string,
): Promise<ConstructionImportRecord> {
	const { data } = await api.get<ConstructionImportRecord>(
		`/construction/imports/${importId}`,
	);
	return data;
}

export async function importWorkbookKind(
	kind: ConstructionTemplateKind,
	file: File,
	context: ImportWorkbookContext,
): Promise<ImportWorkbookResponse> {
	const formData = new FormData();
	formData.append("file", file);

	switch (kind) {
		case "orcamento": {
			const workId = requireContextId(context.workId, "Obra");
			return putImport(`/construction/works/${workId}/budget/import`, formData);
		}
		case "orcamento-aditivo":
			throw new Error(
				"Aditivo exige título e deve ser importado na tela de orçamento.",
			);
		case "cronograma": {
			const workId = requireContextId(context.workId, "Obra");
			return postImport(
				`/construction/works/${workId}/schedule/import`,
				formData,
			);
		}
		case "medicao-obra": {
			const workId = requireContextId(context.workId, "Obra");
			return postImport(
				`/construction/works/${workId}/measurements/import`,
				formData,
			);
		}
		case "custos": {
			const workId = requireContextId(context.workId, "Obra");
			return postImport(
				`/construction/works/${workId}/actual-costs/import`,
				formData,
			);
		}
		case "medicao-contrato": {
			const workId = requireContextId(context.workId, "Obra");
			const contractId = requireContextId(context.contractId, "Contrato");
			return postImport(
				`/construction/works/${workId}/contracts/${contractId}/measurements/import`,
				formData,
			);
		}
		case "cotacao":
			throw new Error(
				"A cotação deve ser importada dentro de uma solicitação de contrato.",
			);
	}
}

export type ImportBatchUploadOptions = {
	model?: ConstructionTemplateKind;
	reprocessOfId?: string;
	reason?: string;
};

export async function uploadImportBatch(
	workId: string,
	file: File,
	options: ImportBatchUploadOptions = {},
): Promise<ImportPreviewPage> {
	const formData = new FormData();
	formData.append("file", file);
	if (options.model) formData.append("model", options.model);
	if (options.reprocessOfId) {
		formData.append("reprocessOfId", options.reprocessOfId);
	}
	if (options.reason) formData.append("reason", options.reason);
	const { data } = await api.post<ImportPreviewPage>(
		`/construction/works/${workId}/import-batches`,
		formData,
		{ headers: { "Content-Type": "multipart/form-data" } },
	);
	return data;
}

export async function getImportBatchPreview(
	workId: string,
	batchId: string,
	page = 1,
	pageSize = 500,
): Promise<ImportPreviewPage> {
	const { data } = await api.get<ImportPreviewPage>(
		`/construction/works/${workId}/import-batches/${batchId}`,
		{ params: { page, pageSize } },
	);
	return data;
}

export async function getSelectableImportRowIds(
	workId: string,
	batchId: string,
): Promise<string[]> {
	const { data } = await api.get<SelectableImportRowIdsResponse>(
		`/construction/works/${workId}/import-batches/${batchId}/selectable-row-ids`,
	);
	return data.rowIds;
}

export async function confirmImportBatch(
	workId: string,
	batchId: string,
	input: {
		expectedBatchVersion: number;
		selectedRowIds: string[];
		idempotencyKey: string;
	},
): Promise<ImportConfirmationResponse> {
	const { data } = await api.post<ImportConfirmationResponse>(
		`/construction/works/${workId}/import-batches/${batchId}/confirm`,
		input,
	);
	return data;
}

export async function cancelImportBatch(
	workId: string,
	batchId: string,
): Promise<void> {
	await api.delete(`/construction/works/${workId}/import-batches/${batchId}`);
}

export async function getImportBatches(
	workId: string,
	page = 1,
	pageSize = 20,
): Promise<ImportBatchListResponse> {
	const { data } = await api.get<ImportBatchListResponse>(
		`/construction/works/${workId}/import-batches`,
		{ params: { page, pageSize } },
	);
	return data;
}

export async function getImportBatchRejected(
	workId: string,
	batchId: string,
): Promise<Blob> {
	const { data } = await api.get<Blob>(
		`/construction/works/${workId}/import-batches/${batchId}/rejected`,
		{ responseType: "blob" },
	);
	return data;
}
