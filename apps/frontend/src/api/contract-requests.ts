import type {
	ContractRequestAcceptance,
	ContractRequestComparison,
	ContractRequestCreateInput,
	ContractRequestDetail,
	ContractRequestSummary,
	ManualContractRequestProposalInput,
	QuotationMapConfirmResult,
} from "@/types/contract-requests";
import type { ImportPreviewPage } from "@/types/import";
import { api } from "./api";

export async function createContractRequest(
	workId: string,
	input: ContractRequestCreateInput,
) {
	const { data } = await api.post<ContractRequestDetail>(
		`/construction/works/${workId}/contract-requests`,
		input,
	);
	return data;
}

export async function listContractRequests(workId: string) {
	const { data } = await api.get<ContractRequestSummary[]>(
		`/construction/works/${workId}/contract-requests`,
	);
	return data;
}

export async function getContractRequest(workId: string, requestId: string) {
	const { data } = await api.get<ContractRequestDetail>(
		`/construction/works/${workId}/contract-requests/${requestId}`,
	);
	return data;
}

export async function cancelContractRequest(workId: string, requestId: string) {
	const { data } = await api.post<{ cancelled: boolean; requestId: string }>(
		`/construction/works/${workId}/contract-requests/${requestId}/cancel`,
	);
	return data;
}

export async function getContractRequestComparison(
	workId: string,
	requestId: string,
) {
	const { data } = await api.get<ContractRequestComparison>(
		`/construction/works/${workId}/contract-requests/${requestId}/comparison`,
	);
	return data;
}

export async function uploadContractRequestQuotationMap(
	workId: string,
	requestId: string,
	file: File,
) {
	const formData = new FormData();
	formData.append("file", file);
	const { data } = await api.post<ImportPreviewPage>(
		`/construction/works/${workId}/contract-requests/${requestId}/quotation-imports`,
		formData,
		{ headers: { "Content-Type": "multipart/form-data" } },
	);
	return data;
}

export async function confirmContractRequestQuotationMap(
	workId: string,
	requestId: string,
	batchId: string,
	idempotencyKey: string,
	selectedRowIds?: string[],
) {
	const { data } = await api.post<QuotationMapConfirmResult>(
		`/construction/works/${workId}/contract-requests/${requestId}/quotation-imports/${batchId}/confirm`,
		selectedRowIds ? { selectedRowIds } : undefined,
		{ headers: { "Idempotency-Key": idempotencyKey } },
	);
	return data;
}

export type ContractRequestSelection = {
	requestId: string;
	status: "PENDING" | "EXECUTED";
	approvalRequestId: string | null;
	requiredApproverRole?: "GERENTE" | "GESTOR" | null;
	contractId: string | null;
	data: ContractRequestAcceptance["contract"] | null;
	supplierRegistrationRequired?: boolean;
};

export async function selectContractRequestWinner(
	workId: string,
	requestId: string,
	proposalId: string,
	idempotencyKey: string,
) {
	const { data } = await api.post<ContractRequestSelection>(
		`/construction/works/${workId}/contract-requests/${requestId}/select/${proposalId}`,
		undefined,
		{ headers: { "Idempotency-Key": idempotencyKey } },
	);
	return data;
}

export async function revertContractRequestAcceptance(
	workId: string,
	requestId: string,
) {
	const { data } = await api.post<{
		requestId: string;
		reverted: boolean;
		status: string;
	}>(
		`/construction/works/${workId}/contract-requests/${requestId}/revert-acceptance`,
	);
	return data;
}

export async function negotiateContractRequestProposal(
	workId: string,
	requestId: string,
	proposalId: string,
	proposalValue: number,
	reason: string,
) {
	const { data } = await api.post<{
		proposalId: string;
		proposalValue: number;
		originalProposalValue: number;
		negotiationReductionAmount: number;
	}>(
		`/construction/works/${workId}/contract-requests/${requestId}/proposals/${proposalId}/negotiate`,
		{ proposalValue, reason },
	);
	return data;
}

export async function addManualContractRequestProposal(
	workId: string,
	requestId: string,
	input: ManualContractRequestProposalInput,
) {
	const { data } = await api.post<{ id: string }>(
		`/construction/works/${workId}/contract-requests/${requestId}/proposals/manual`,
		input,
	);
	return data;
}

export async function downloadContractRequestTemplate() {
	const response = await api.get(
		"/construction/quotation-templates/contract-request",
		{ responseType: "blob" },
	);
	return response.data as Blob;
}
