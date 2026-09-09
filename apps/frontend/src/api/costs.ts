import type { LegacyActualCost } from "@/types/measurements";
import { sanitizeQueryParams } from "@/utils/sanitizeQueryParams";
import type { BackendPaginated } from "./api";
import { api, normalizePagination } from "./api";

export type ActualCostFilter = {
	q?: string;
	category?: string;
	supplierName?: string;
	status?: string;
	costType?: string;
	startDate?: string;
	endDate?: string;
	page?: number;
	limit?: number;
};

export async function listActualCosts(
	workId: string,
	filters: ActualCostFilter = {},
) {
	const cleaned = sanitizeQueryParams(filters as Record<string, unknown>);
	const limit = filters.limit ?? 10;
	const { data: raw } = await api.get<BackendPaginated<LegacyActualCost>>(
		`/construction/works/${workId}/actual-costs`,
		{
			params: { ...cleaned, limit, page: filters.page ?? 1 },
		},
	);
	return normalizePagination(raw, limit);
}

export type CreateActualCostInput = {
	title?: string;
	budgetVersionItemId: string;
	costDate: string;
	category: string;
	categoryDetail?: string;
	amount: number;
	costType: string;
	description?: string;
	supplierId?: string | null;
	paymentStatus?: string;
};

export type UpdateActualCostInput = Partial<CreateActualCostInput>;

export async function createActualCost(
	workId: string,
	input: CreateActualCostInput,
) {
	const { data } = await api.post<LegacyActualCost>(
		`/construction/works/${workId}/actual-costs`,
		input,
	);
	return data;
}

export async function getActualCost(workId: string, costId: string) {
	const { data } = await api.get<LegacyActualCost>(
		`/construction/works/${workId}/actual-costs/${costId}`,
	);
	return data;
}

export async function updateActualCost(
	workId: string,
	costId: string,
	input: UpdateActualCostInput,
) {
	const { data } = await api.patch<LegacyActualCost>(
		`/construction/works/${workId}/actual-costs/${costId}`,
		input,
	);
	return data;
}

export async function deleteActualCost(workId: string, actualCostId: string) {
	await api.delete(
		`/construction/works/${workId}/actual-costs/${actualCostId}`,
	);
}

export type CostItem = Omit<LegacyActualCost, "title"> & {
	budgetItem?: {
		id: string;
		index: string;
		description: string;
		unit: string | null;
		parent?: { index: string; description: string } | null;
	} | null;
	budgetVersionItem?: {
		id: string;
		index: string;
		description: string;
		unit: string | null;
		parentVersion?: { index: string; description: string } | null;
	} | null;
};

export type Cost = {
	id: string;
	workId: string;
	importId: string | null;
	title: string;
	createdAt: string;
	updatedAt: string;
	items: CostItem[];
	itemCount: number;
	amount: number;
	categories: string[];
};

export type CreateCostInput = {
	title: string;
	items: Array<{
		budgetVersionItemId: string;
		costDate: string;
		category: string;
		categoryDetail?: string;
		description: string;
		amount: number;
		costType: string;
		supplierId?: string | null;
		paymentStatus: string;
	}>;
};

export async function listCosts(
	workId: string,
	filters: ActualCostFilter = {},
) {
	const cleaned = sanitizeQueryParams(filters as Record<string, unknown>);
	const limit = filters.limit ?? 10;
	const { data: raw } = await api.get<BackendPaginated<Cost>>(
		`/construction/works/${workId}/costs`,
		{ params: { ...cleaned, limit, page: filters.page ?? 1 } },
	);
	return normalizePagination(raw, limit);
}

export async function createCost(workId: string, input: CreateCostInput) {
	const { data } = await api.post<Cost>(
		`/construction/works/${workId}/costs`,
		input,
	);
	return data;
}

export async function getCost(workId: string, costId: string) {
	const { data } = await api.get<Cost>(
		`/construction/works/${workId}/costs/${costId}`,
	);
	return data;
}

export async function deleteCost(workId: string, costId: string) {
	await api.delete(`/construction/works/${workId}/costs/${costId}`);
}
