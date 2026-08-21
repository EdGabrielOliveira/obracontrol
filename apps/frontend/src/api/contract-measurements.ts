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
	input: UpdateContractMeasurementMetadataInput,
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

export async function updateContractMeasurementItems(
	workId: string,
	contractId: string,
	measurementId: string,
	items: UpdateContractMeasurementItemsInput["items"],
) {
	const cleaned = items.map((item) => ({
		...item,
		measuredQuantity: item.measuredQuantity ?? undefined,
		measuredValue: item.measuredValue ?? undefined,
		measuredPercentage: item.measuredPercentage ?? undefined,
		accumulatedQuantity: item.accumulatedQuantity ?? undefined,
		accumulatedValue: item.accumulatedValue ?? undefined,
		accumulatedPercentage: item.accumulatedPercentage ?? undefined,
	}));
	const { data } = await api.patch<ContractMeasurement>(
		`/construction/works/${workId}/contracts/${contractId}/measurements/${measurementId}`,
		{ items: cleaned },
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
	measurements: Array<Record<string, unknown>>;
	payments: ContractAggregatePayment[];
	totals: {
		totalContracted: number;
		totalServicesValue: number;
		totalMeasured: number;
		totalPaid: number;
		retentionTotal: number;
		discountTotal: number;
		balance: number;
		measuredPercentage: number;
	};
	measurementsCount: number;
	paymentsCount: number;
};

export type ContractAggregateService = {
	id: string;
	description: string;
	type: string;
	contractValue?: number | null;
	totalCost?: number | null;
	measuredAccumulated?: number | null;
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
