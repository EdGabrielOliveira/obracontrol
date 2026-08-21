import type { PendingApprovalSummary } from "@/types/authorization";
import type {
	WorkCreateInput,
	WorkDetail,
	WorkSummaryWithHierarchy,
	WorksFilter,
	WorkUpdateInput,
} from "@/types/works";
import { createIdempotencyKey } from "@/utils/idempotency-key";
import { sanitizeQueryParams } from "@/utils/sanitizeQueryParams";
import type { BackendPaginated } from "./api";
import { api, normalizePagination } from "./api";

export async function listWorks(filter: WorksFilter = {}) {
	const cleaned = sanitizeQueryParams(filter);
	const limit = filter.limit ?? 10;
	const { data: raw } = await api.get<
		BackendPaginated<WorkSummaryWithHierarchy>
	>("/construction/works", {
		params: { ...cleaned, limit, page: filter.page ?? 1 },
	});
	return normalizePagination(raw, limit);
}

export async function getWork(workId: string) {
	const { data } = await api.get<WorkDetail>(`/construction/works/${workId}`);
	return data;
}

export async function createWork(input: WorkCreateInput) {
	const { data } = await api.post<WorkDetail>("/construction/works", input);
	return data;
}

export type CreateWorkWithBudgetResult = {
	status: "NO_UPLOAD" | "IMPORTED" | "IMPORT_REJECTED";
	work: WorkDetail;
	import?: { errors?: unknown[]; importedCount?: number };
	error?: { code: string; message: string };
};

export function buildWorkWithBudgetPayload(
	input: WorkCreateInput,
	file?: File,
) {
	if (!file) return input;

	const form = new FormData();
	for (const [key, value] of Object.entries(input)) {
		if (value === undefined || value === "") continue;
		form.append(
			key,
			typeof value === "object" ? JSON.stringify(value) : String(value),
		);
	}
	if (file) form.append("file", file);

	return form;
}

export function isCreateWorkWithBudgetResponse(status: number) {
	return (status >= 200 && status < 300) || status === 422;
}

export async function createWorkWithBudget(
	input: WorkCreateInput,
	file?: File,
	idempotencyKey = createIdempotencyKey("work"),
) {
	const headers: Record<string, string> = {
		"Idempotency-Key": idempotencyKey,
	};
	const payload = buildWorkWithBudgetPayload(input, file);
	const { data } = await api.post<CreateWorkWithBudgetResult>(
		"/construction/works/with-budget",
		payload,
		{ headers, validateStatus: isCreateWorkWithBudgetResponse },
	);
	return data;
}

export async function updateWork(workId: string, input: WorkUpdateInput) {
	const { data } = await api.patch<WorkDetail>(
		`/construction/works/${workId}`,
		input,
	);
	return data;
}

export async function deleteWork(workId: string) {
	const { data } = await api.delete<{
		status: "PENDING";
		approvalRequest: PendingApprovalSummary;
	} | null>(`/construction/works/${workId}`);
	return data;
}

export async function listWorkManagers() {
	const { data } = await api.get<Array<{ id: string; name: string }>>(
		"/construction/works/gestores",
	);
	return data;
}
