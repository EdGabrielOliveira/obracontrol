import type {
	BudgetVersionDetail,
	BudgetVersionDraft,
	BudgetVersionImportPreview,
	BudgetVersionSubmitResult,
	BudgetVersionSummary,
	BudgetViewResponse,
	CreateBudgetItemInput,
	CreateBudgetVersionInput,
	EffectiveBudgetVersion,
	UpdateBudgetItemInput,
} from "@/types/budget";
import type { CostBudgetItemSelectorResponse } from "@/types/measurements";
import { api } from "./api";

export async function getCurrentCostBudgetItems(workId: string) {
	const { data } = await api.get<CostBudgetItemSelectorResponse>(
		`/construction/works/${workId}/budget-versions/effective/cost-items`,
	);
	return data;
}

export async function getEffectiveBudgetVersion(workId: string) {
	const { data } = await api.get<EffectiveBudgetVersion>(
		`/construction/works/${workId}/budget-versions`,
	);
	return data;
}

export async function listBudgetVersions(workId: string) {
	const { data } = await api.get<BudgetVersionSummary[]>(
		`/construction/works/${workId}/budget-versions/history`,
	);
	return data;
}

export async function getBudgetVersion(workId: string, versionId: string) {
	const { data } = await api.get<BudgetVersionDetail>(
		`/construction/works/${workId}/budget-versions/${versionId}`,
	);
	return data;
}

export async function createBudgetVersionDraft(
	workId: string,
	input: CreateBudgetVersionInput,
) {
	const { data } = await api.post<BudgetVersionDraft>(
		`/construction/works/${workId}/budget-versions/draft`,
		input,
	);
	return data;
}

export async function submitBudgetVersion(
	workId: string,
	versionId: string,
	reason?: string,
) {
	const { data } = await api.post<BudgetVersionSubmitResult>(
		`/construction/works/${workId}/budget-versions/${versionId}/submit`,
		{ reason },
	);
	return data;
}

export async function previewBudgetVersionImport(
	workId: string,
	input: { title: string; file: File; idempotencyKey?: string },
) {
	const formData = new FormData();
	formData.append("title", input.title);
	formData.append("file", input.file);
	const { data } = await api.post<BudgetVersionImportPreview>(
		`/construction/works/${workId}/budget-versions/imports`,
		formData,
		{
			headers: {
				"Content-Type": "multipart/form-data",
				...(input.idempotencyKey
					? { "Idempotency-Key": input.idempotencyKey }
					: {}),
			},
		},
	);
	return data;
}

export async function confirmBudgetVersionImport(
	workId: string,
	importId: string,
	expectedSourceVersionId: string | null,
	idempotencyKey?: string,
) {
	const { data } = idempotencyKey
		? await api.post<BudgetVersionDraft>(
				`/construction/works/${workId}/budget-versions/imports/${importId}/confirm`,
				{ expectedSourceVersionId },
				{ headers: { "Idempotency-Key": idempotencyKey } },
			)
		: await api.post<BudgetVersionDraft>(
				`/construction/works/${workId}/budget-versions/imports/${importId}/confirm`,
				{ expectedSourceVersionId },
			);
	return data;
}

export async function getBudgetItems(workId: string) {
	const { data } = await api.get<BudgetViewResponse>(
		`/construction/works/${workId}/budget`,
	);
	return data;
}

export async function createBudgetItem(
	workId: string,
	input: CreateBudgetItemInput,
) {
	const { data } = await api.post<BudgetViewResponse["items"][number]>(
		`/construction/works/${workId}/budget/items`,
		input,
	);
	return data;
}

export async function updateBudgetItem(
	workId: string,
	itemId: string,
	input: UpdateBudgetItemInput,
) {
	const { data } = await api.patch<BudgetViewResponse["items"][number]>(
		`/construction/works/${workId}/budget/items/${itemId}`,
		input,
	);
	return data;
}
