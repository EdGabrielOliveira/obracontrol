import type {
	Supplier,
	SupplierAnalyticsItem,
	SupplierCreateInput,
	SupplierDetail,
	SupplierUpdateInput,
} from "@/types/suppliers";
import { sanitizeQueryParams } from "@/utils/sanitizeQueryParams";
import type { BackendPaginated } from "./api";
import { api, normalizePagination } from "./api";

export type SupplierFilter = {
	q?: string;
	page?: number;
	pageSize?: number;
};

export async function listSuppliers(filters: SupplierFilter = {}) {
	const cleaned = sanitizeQueryParams(filters as Record<string, unknown>);
	const pageSize = filters.pageSize ?? 10;
	const { data: raw } = await api.get<BackendPaginated<Supplier>>(
		"/construction/suppliers",
		{
			params: {
				...cleaned,
				pageSize,
				page: filters.page ?? 1,
			},
		},
	);
	return normalizePagination(raw, pageSize);
}

export async function getSupplier(supplierId: string) {
	const { data } = await api.get<SupplierDetail>(
		`/construction/suppliers/${supplierId}`,
	);
	return data;
}

export async function getSupplierAnalytics() {
	const { data } = await api.get<{ items: SupplierAnalyticsItem[] }>(
		"/construction/suppliers/analytics",
	);
	return data.items;
}

export async function createSupplier(input: SupplierCreateInput) {
	const { data } = await api.post<Supplier>("/construction/suppliers", input);
	return data;
}

export async function updateSupplier(
	supplierId: string,
	input: SupplierUpdateInput,
) {
	const { data } = await api.patch<Supplier>(
		`/construction/suppliers/${supplierId}`,
		input,
	);
	return data;
}

export async function deleteSupplier(supplierId: string) {
	await api.delete(`/construction/suppliers/${supplierId}`);
}
