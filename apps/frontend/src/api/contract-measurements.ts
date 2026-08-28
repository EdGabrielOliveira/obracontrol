import type {
	ContractMeasurement,
	ContractMeasurementDetail,
	CreateContractMeasurementInput,
	UpdateContractMeasurementItemsInput,
	UpdateContractMeasurementMetadataInput,
} from "@/types/contracts";
import { sanitizeQueryParams } from "@/utils/sanitizeQueryParams";
import type { BackendPaginated } from "./api";
import { api, normalizePagination } from "./api";

export type ContractMeasurementFilter = {
	q?: string;
	page?: number;
	limit?: number;
};

export async function listContractMeasurements(
	workId: string,
	contractId: string,
	filters: ContractMeasurementFilter = {},
) {
	const cleaned = sanitizeQueryParams(filters as Record<string, unknown>);
	const limit = filters.limit ?? 10;
	const { data: raw } = await api.get<BackendPaginated<ContractMeasurement>>(
		`/construction/works/${workId}/contracts/${contractId}/measurements`,
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

export async function getContractMeasurement(
	workId: string,
	contractId: string,
	measurementId: string,
) {
	const { data } = await api.get<ContractMeasurementDetail>(
		`/construction/works/${workId}/contracts/${contractId}/measurements/${measurementId}`,
	);
	return data;
}

export async function createContractMeasurement(
	workId: string,
	contractId: string,
	input: CreateContractMeasurementInput,
) {
	const { data } = await api.post<ContractMeasurement>(
		`/construction/works/${workId}/contracts/${contractId}/measurements`,
		input,
	);
	return data;
}

export async function updateContractMeasurement(
	workId: string,
	contractId: string,
	measurementId: string,
	input: UpdateContractMeasurementMetadataInput & {
		items?: UpdateContractMeasurementItemsInput["items"];
	},
) {
	const { data } = await api.patch<ContractMeasurement>(
		`/construction/works/${workId}/contracts/${contractId}/measurements/${measurementId}`,
		input,
	);
	return data;
}

export async function deleteContractMeasurement(
	workId: string,
	contractId: string,
	measurementId: string,
) {
	await api.delete(
		`/construction/works/${workId}/contracts/${contractId}/measurements/${measurementId}`,
	);
}

export async function updateContractMeasurementStatus(
	workId: string,
	contractId: string,
	measurementId: string,
	status: ContractMeasurement["status"],
	reason?: string | null,
) {
	const { data } = await api.patch<ContractMeasurement>(
		`/construction/works/${workId}/contracts/${contractId}/measurements/${measurementId}/status`,
		{ status, reason },
	);
	return data;
}

export async function updateContractMeasurementItems(
	workId: string,
	contractId: string,
	measurementId: string,
	items: UpdateContractMeasurementItemsInput["items"],
) {
	const { data } = await api.patch<ContractMeasurement>(
		`/construction/works/${workId}/contracts/${contractId}/measurements/${measurementId}`,
		{ items },
	);
	return data;
}

export type ContractAggregateResponse = {
	contract: {
		id: string;
		code: string;
		supplierName: string;
		title: string | null;
		status: string;
		contractValue: number;
	};
	services: ContractAggregateService[];
	measurements: ContractMeasurement[];
	payments: ContractAggregatePayment[];
	totals: {
		totalContracted: number;
		totalServicesValue: number;
		totalMeasured: number;
		totalPaid: number;
		retentionTotal: number;
		discountTotal: number;
		balance: number;
		totalOutstanding: number;
		totalToMeasure: number;
		measuredPercentage: number;
		paidPercentage: number;
	};
	measurementsCount: number;
	paymentsCount: number;
	serviceCount: number;
	measuredServiceCount: number;
	pendingServiceCount: number;
};

export type ContractAggregateService = {
	id: string;
	description: string;
	type: string;
	contractValue?: number | null;
	totalCost?: number | null;
	measuredAccumulated?: number | null;
	measuredAccumulatedQuantity?: number | null;
	remainingQuantity?: number | null;
	remainingValue?: number | null;
	measuredPercentage?: number | null;
};

export type ContractAggregatePayment = {
	id: string;
	date: string;
	description: string | null;
	value: number;
	paidValue: number;
	status: string;
};

export async function downloadContractMeasurementPdf(
	workId: string,
	contractId: string,
	measurementId: string,
): Promise<Blob> {
	const { data } = await api.get(
		`/construction/works/${workId}/contracts/${contractId}/measurements/${measurementId}/pdf`,
		{ responseType: "blob" },
	);
	return data;
}

export async function getContractAggregate(
	workId: string,
	contractId: string,
): Promise<ContractAggregateResponse> {
	const { data } = await api.get<ContractAggregateResponse>(
		`/construction/works/${workId}/contracts/${contractId}/measurements/aggregate`,
	);
	return data;
}
