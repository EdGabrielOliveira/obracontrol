import type { CommandResult } from "@/types/authorization";
import type {
	Contract,
	ContractAmendment,
	ContractCreateInput,
	ContractDetail,
	ContractStatus,
	ContractSummaryResponse,
	ContractUpdateInput,
	CreateContractAmendmentInput,
	UpdateContractAmendmentInput,
} from "@/types/contracts";
import { sanitizeQueryParams } from "@/utils/sanitizeQueryParams";
import type { BackendPaginated } from "./api";
import { api, normalizePagination } from "./api";

export type ContractFilter = {
	q?: string;
	status?: ContractStatus;
	supplierName?: string;
	page?: number;
	limit?: number;
};

export async function listContracts(
	workId: string,
	filters: ContractFilter = {},
) {
	const cleaned = sanitizeQueryParams(filters as Record<string, unknown>);
	const limit = filters.limit ?? 10;
	const { data: raw } = await api.get<BackendPaginated<Contract>>(
		`/construction/works/${workId}/contracts`,
		{
			params: {
				...cleaned,
				limit,
				page: filters.page ?? 1,
			},
		},
	);
	return normalizePagination(raw, limit);
}

export async function getContract(workId: string, contractId: string) {
	const { data } = await api.get<ContractDetail>(
		`/construction/works/${workId}/contracts/${contractId}`,
	);
	return data;
}

export async function createContract(
	workId: string,
	input: ContractCreateInput,
) {
	const { data } = await api.post<CommandResult<Contract>>(
		`/construction/works/${workId}/contracts`,
		input,
	);
	return data;
}

export async function updateContract(
	workId: string,
	contractId: string,
	input: ContractUpdateInput,
) {
	const { data } = await api.patch<Contract>(
		`/construction/works/${workId}/contracts/${contractId}`,
		input,
	);
	return data;
}

export async function deleteContract(workId: string, contractId: string) {
	await api.delete(`/construction/works/${workId}/contracts/${contractId}`);
}

export async function getContractSummary(workId: string) {
	const { data } = await api.get<ContractSummaryResponse>(
		`/construction/works/${workId}/contracts/summary`,
	);
	return data;
}

export async function listContractAmendments(
	workId: string,
	contractId: string,
) {
	const { data } = await api.get<ContractAmendment[]>(
		`/construction/works/${workId}/contracts/${contractId}/amendments`,
	);
	return data;
}

export async function createContractAmendment(
	workId: string,
	contractId: string,
	input: CreateContractAmendmentInput,
) {
	const { data } = await api.post<ContractAmendment>(
		`/construction/works/${workId}/contracts/${contractId}/amendments`,
		input,
	);
	return data;
}

export async function updateContractAmendment(
	workId: string,
	contractId: string,
	amendmentId: string,
	input: UpdateContractAmendmentInput,
) {
	const { data } = await api.patch<ContractAmendment>(
		`/construction/works/${workId}/contracts/${contractId}/amendments/${amendmentId}`,
		input,
	);
	return data;
}

export async function deleteContractAmendment(
	workId: string,
	contractId: string,
	amendmentId: string,
) {
	await api.delete(
		`/construction/works/${workId}/contracts/${contractId}/amendments/${amendmentId}`,
	);
}

export async function decideContractAmendment(
	workId: string,
	contractId: string,
	amendmentId: string,
	input: { decision: "APPROVE" | "REJECT"; reason?: string },
) {
	const { data } = await api.post<ContractAmendment>(
		`/construction/works/${workId}/contracts/${contractId}/amendments/${amendmentId}/decision`,
		input,
	);
	return data;
}
