import type {
	CostCenterReportResponse,
	OrganizationReportResponse,
	WorkReport,
} from "@/types/reports";
import { api } from "./api";

function reportParams(asOfDate?: string) {
	return asOfDate ? { asOfDate } : {};
}

export async function getWorkReport(
	workId: string,
	asOfDate?: string,
): Promise<WorkReport> {
	const { data } = await api.get<WorkReport>(
		`/construction/reports/work/${workId}`,
		{ params: reportParams(asOfDate) },
	);
	return data;
}

export type ContractReportResponse = {
	contract: {
		id: string;
		code: string;
		supplierName: string;
		title: string | null;
		status: string;
		contractValue: number;
	};
	totals: {
		contractValue: number;
		measuredCurrent: number;
		measuredAccumulated: number;
		balance: number;
	};
	measurementsCount: number;
	paymentsCount: number;
};

export async function downloadCostCenterPdf(ccId: string): Promise<Blob> {
	const { data } = await api.get(
		`/construction/reports/cost-center/${ccId}/pdf`,
		{ responseType: "blob" },
	);
	return data;
}

export async function downloadOrgPdf(orgId: string): Promise<Blob> {
	const { data } = await api.get(`/organizations/${orgId}/reports/pdf`, {
		responseType: "blob",
	});
	return data;
}

export async function getOrgReport(
	orgId: string,
): Promise<OrganizationReportResponse> {
	const { data } = await api.get<OrganizationReportResponse>(
		`/organizations/${orgId}/reports`,
	);
	return data;
}

export async function getOrgCostCenterReport(
	orgId: string,
	ccId: string,
): Promise<CostCenterReportResponse> {
	const { data } = await api.get<CostCenterReportResponse>(
		`/organizations/${orgId}/cost-centers/${ccId}/reports`,
	);
	return data;
}
