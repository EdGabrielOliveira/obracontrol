import type { AnalysisFilter } from "@/types/bi";
import type {
	CostCenter,
	CostCenterBIData,
	CostCenterDetail,
	CreateCostCenterInput,
	CreateOrganizationInput,
	Organization,
	OrganizationBIData,
	UpdateCostCenterInput,
	UpdateOrganizationInput,
} from "@/types/organizations";
import { sanitizeQueryParams } from "@/utils/sanitizeQueryParams";
import type { BackendPaginated } from "./api";
import { api, normalizePagination } from "./api";
import { serializeAnalysisFilter } from "./bi";

export type AllCostCenterFilter = {
	q?: string;
	page?: number;
	limit?: number;
};

export async function getCostCenterById(ccId: string) {
	const { data } = await api.get<CostCenterDetail>(
		`/organizations/cost-centers/${ccId}`,
	);
	return data;
}

export async function listAllCostCenters(filters: AllCostCenterFilter = {}) {
	const cleaned = sanitizeQueryParams(filters as Record<string, unknown>);
	const limit = filters.limit ?? 10;
	const { data: raw } = await api.get<BackendPaginated<CostCenterDetail>>(
		"/organizations/cost-centers",
		{ params: { ...cleaned, limit, page: filters.page ?? 1 } },
	);
	return normalizePagination(raw, limit);
}

export type OrganizationFilter = {
	q?: string;
	page?: number;
	limit?: number;
};

export async function listOrganizations(filters: OrganizationFilter = {}) {
	const cleaned = sanitizeQueryParams(filters as Record<string, unknown>);
	const limit = filters.limit ?? 10;
	const { data: raw } = await api.get<BackendPaginated<Organization>>(
		"/organizations",
		{
			params: { ...cleaned, limit, page: filters.page ?? 1 },
		},
	);
	return normalizePagination(raw, limit);
}

export async function getOrganization(id: string) {
	const { data } = await api.get<Organization>(`/organizations/${id}`);
	return data;
}

export async function createOrganization(input: CreateOrganizationInput) {
	const { data } = await api.post<Organization>("/organizations", input);
	return data;
}

export async function updateOrganization(
	id: string,
	input: UpdateOrganizationInput,
) {
	const { data } = await api.patch<Organization>(`/organizations/${id}`, input);
	return data;
}

export async function deleteOrganization(id: string) {
	await api.delete(`/organizations/${id}`);
}

export type CostCenterFilter = {
	q?: string;
	page?: number;
	limit?: number;
};

export async function listCostCenters(
	organizationId: string,
	filters: CostCenterFilter = {},
) {
	const cleaned = sanitizeQueryParams(filters as Record<string, unknown>);
	const limit = filters.limit ?? 10;
	const { data: raw } = await api.get<BackendPaginated<CostCenter>>(
		`/organizations/${organizationId}/cost-centers`,
		{
			params: { ...cleaned, limit, page: filters.page ?? 1 },
		},
	);
	return normalizePagination(raw, limit);
}

export async function getCostCenter(
	organizationId: string,
	costCenterId: string,
) {
	const { data } = await api.get<CostCenter>(
		`/organizations/${organizationId}/cost-centers/${costCenterId}`,
	);
	return data;
}

export async function createCostCenter(
	organizationId: string,
	input: CreateCostCenterInput,
) {
	const { data } = await api.post<CostCenter>(
		`/organizations/${organizationId}/cost-centers`,
		input,
	);
	return data;
}

export async function updateCostCenter(
	costCenterId: string,
	input: UpdateCostCenterInput,
) {
	const { data } = await api.patch<CostCenter>(
		`/organizations/cost-centers/${costCenterId}`,
		input,
	);
	return data;
}

export async function deleteCostCenter(
	organizationId: string,
	costCenterId: string,
) {
	await api.delete(
		`/organizations/${organizationId}/cost-centers/${costCenterId}`,
	);
}

export async function getOrganizationBI(
	organizationId: string,
	filter: AnalysisFilter = {},
) {
	const { data } = await api.get<OrganizationBIData>(
		`/organizations/${organizationId}/bi`,
		{ params: serializeAnalysisFilter(filter) },
	);
	return data;
}

export async function getCostCenterBI(
	organizationId: string,
	costCenterId: string,
	filter: AnalysisFilter = {},
) {
	const { data } = await api.get<CostCenterBIData>(
		`/organizations/${organizationId}/cost-centers/${costCenterId}/bi`,
		{ params: serializeAnalysisFilter(filter) },
	);
	return data;
}
