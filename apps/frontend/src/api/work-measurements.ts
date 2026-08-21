import type {
	CreateMeasurementInput,
	WorkMeasurement,
	WorkMeasurementDetailResponse,
	WorkMeasurementMapResponse,
	WorkMeasurementReportsResponse,
	WorkMeasurementSummaryResponse,
} from "@/types/measurements";
import { sanitizeQueryParams } from "@/utils/sanitizeQueryParams";
import type { BackendPaginated } from "./api";
import { api, normalizePagination } from "./api";

export type WorkMeasurementFilter = {
	q?: string;
	page?: number;
	limit?: number;
};

export async function listWorkMeasurements(
	workId: string,
	filters: WorkMeasurementFilter = {},
) {
	const limit = filters.limit ?? 10;
	const { data: raw } = await api.get<BackendPaginated<WorkMeasurement>>(
		`/construction/works/${workId}/work-measurements`,
		{
			params: sanitizeQueryParams(filters as Record<string, unknown>),
		},
	);
	return normalizePagination(raw, limit);
}

export async function getWorkMeasurement(
	workId: string,
	measurementId: string,
) {
	const { data } = await api.get<WorkMeasurementDetailResponse>(
		`/construction/works/${workId}/work-measurements/${measurementId}`,
	);
	return data;
}

export async function createWorkMeasurement(
	workId: string,
	input: CreateMeasurementInput,
) {
	const { data } = await api.post<WorkMeasurement>(
		`/construction/works/${workId}/work-measurements`,
		input,
	);
	return data;
}

export async function updateWorkMeasurement(
	workId: string,
	measurementId: string,
	input: Partial<CreateMeasurementInput>,
) {
	const { data } = await api.patch<WorkMeasurement>(
		`/construction/works/${workId}/work-measurements/${measurementId}`,
		input,
	);
	return data;
}

export async function deleteWorkMeasurement(
	workId: string,
	measurementId: string,
) {
	await api.delete(
		`/construction/works/${workId}/work-measurements/${measurementId}`,
	);
}

export async function getWorkMeasurementMap(workId: string) {
	const { data } = await api.get<WorkMeasurementMapResponse>(
		`/construction/works/${workId}/work-measurements/map`,
	);
	return data;
}

export async function getWorkMeasurementReports(workId: string) {
	const { data } = await api.get<WorkMeasurementReportsResponse>(
		`/construction/works/${workId}/work-measurements/reports`,
	);
	return data;
}

export async function getWorkMeasurementSummary(workId: string) {
	const { data } = await api.get<WorkMeasurementSummaryResponse>(
		`/construction/works/${workId}/work-measurements/summary`,
	);
	return data;
}

export async function downloadWorkMeasurementPdf(
	workId: string,
	measurementId: string,
): Promise<Blob> {
	const { data } = await api.get(
		`/construction/works/${workId}/work-measurements/${measurementId}/pdf`,
		{ responseType: "blob" },
	);
	return data;
}
