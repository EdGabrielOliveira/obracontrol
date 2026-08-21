import type {
	ContractPayment,
	CreateContractPaymentInput,
	UpdateContractPaymentInput,
} from "@/types/contracts";
import { sanitizeQueryParams } from "@/utils/sanitizeQueryParams";
import type { BackendPaginated } from "./api";
import { api, normalizePagination } from "./api";

export type ContractPaymentFilter = {
	page?: number;
	limit?: number;
};

export async function listContractPayments(
	workId: string,
	contractId: string,
	filters: ContractPaymentFilter = {},
) {
	const cleaned = sanitizeQueryParams(filters as Record<string, unknown>);
	const limit = filters.limit ?? 10;
	const { data: raw } = await api.get<BackendPaginated<ContractPayment>>(
		`/construction/works/${workId}/contracts/${contractId}/payments`,
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

export async function createContractPayment(
	workId: string,
	contractId: string,
	input: CreateContractPaymentInput,
) {
	const { data } = await api.post<ContractPayment>(
		`/construction/works/${workId}/contracts/${contractId}/payments`,
		input,
	);
	return data;
}

export async function updateContractPayment(
	workId: string,
	contractId: string,
	paymentId: string,
	input: UpdateContractPaymentInput,
) {
	const { data } = await api.patch<ContractPayment>(
		`/construction/works/${workId}/contracts/${contractId}/payments/${paymentId}`,
		input,
	);
	return data;
}

export async function deleteContractPayment(
	workId: string,
	contractId: string,
	paymentId: string,
) {
	await api.delete(
		`/construction/works/${workId}/contracts/${contractId}/payments/${paymentId}`,
	);
}
