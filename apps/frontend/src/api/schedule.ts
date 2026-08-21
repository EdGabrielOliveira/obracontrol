import type { ImportWorkbookResponse } from "@/types/import";
import type {
	SchedulePhysicalFinancialResponse,
	ScheduleResponse,
	ScheduleRevision,
	ScheduleVersionView,
} from "@/types/schedule";
import { api } from "./api";

export async function getSchedule(workId: string) {
	const { data } = await api.get<ScheduleResponse>(
		`/construction/works/${workId}/schedule`,
	);
	return data;
}

export async function importSchedule(workId: string, file: File) {
	const formData = new FormData();
	formData.append("file", file);
	const { data } = await api.post<ImportWorkbookResponse>(
		`/construction/works/${workId}/schedule/import`,
		formData,
		{ headers: { "Content-Type": "multipart/form-data" } },
	);
	return data;
}

export type ManualScheduleItemInput = {
	budgetItemId: string;
	plannedStart: string;
	plannedEnd: string;
};

export type ManualScheduleItemResult = {
	id: string;
	budgetItemId: string;
	index: string;
	plannedStart: string;
	plannedEnd: string;
	created: boolean;
};

export async function saveManualScheduleItem(
	workId: string,
	input: ManualScheduleItemInput,
) {
	const { data } = await api.post<ManualScheduleItemResult>(
		`/construction/works/${workId}/schedule/items`,
		input,
	);
	return data;
}

export type CreateScheduleRevisionInput = {
	index: string;
	version?: string;
	replannedStart: string;
	replannedEnd: string;
	revisionDate?: string;
	reason?: string;
};

export async function createScheduleRevision(
	workId: string,
	input: CreateScheduleRevisionInput,
) {
	const { data } = await api.post<ScheduleRevision>(
		`/construction/works/${workId}/schedule/revisions`,
		input,
	);
	return data;
}

export async function getPhysicalFinancialSchedule(
	workId: string,
	period?: "daily" | "monthly" | "biweekly" | "weekly",
) {
	const { data } = await api.get<SchedulePhysicalFinancialResponse>(
		`/construction/works/${workId}/schedule/physical-financial`,
		{ params: period ? { period } : undefined },
	);
	return data;
}

export async function listScheduleVersions(workId: string) {
	const { data } = await api.get<ScheduleVersionView[]>(
		`/construction/works/${workId}/schedule-versions/`,
	);
	return data;
}

export type CreateScheduleRevisionVersionInput = {
	index: string;
	replannedStart: string;
	replannedEnd: string;
	revisionDate?: string;
	reason?: string;
};
