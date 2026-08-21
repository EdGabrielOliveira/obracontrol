import type {
	AnalysisFilter,
	ComparisonResponse,
	MacroQualityIssue,
	MultiworksBIResponse,
	WorkBIResponse,
} from "@/types/bi";
import type { Indicator } from "@/types/shared";
import { sanitizeQueryParams } from "@/utils/sanitizeQueryParams";
import { api } from "./api";

export function serializeAnalysisFilter(filter: AnalysisFilter = {}) {
	return sanitizeQueryParams({
		q: filter.q,
		status: filter.status,
		organizationIds: filter.organizationIds?.join(","),
		costCenterIds: filter.costCenterIds?.join(","),
		workIds: filter.workIds?.join(","),
	});
}

export async function getWorkBI(workId: string, asOfDate?: string) {
	const { data } = await api.get<WorkBIResponse>(
		`/construction/works/${workId}/overview`,
		{ params: asOfDate ? { asOfDate } : {} },
	);
	return data;
}

export async function getMultiworksBI(filter: AnalysisFilter = {}) {
	const cleaned = serializeAnalysisFilter(filter);
	const { data } = await api.get<MultiworksBIResponse>(
		"/construction/bi/multiworks",
		{
			params: cleaned,
		},
	);
	return data;
}

export async function compareWorks(workIds: string[]) {
	const { data } = await api.get<ComparisonResponse>(
		"/construction/bi/compare",
		{
			params: { workIds: workIds.join(",") },
		},
	);
	return data;
}

export type MonthlyFactView = {
	id: string;
	ownerId: string;
	workId: string;
	competencia: string;
	origem: string;
	version: number;
	status: string;
	valores: Record<string, number | null>;
	fingerprint: string;
	reason: string | null;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
	derived: Record<string, Indicator<number>>;
	qualityIssues: MacroQualityIssue[];
};
