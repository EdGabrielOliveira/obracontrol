import type {
	Quotation,
	QuotationComparison,
	QuotationNegotiateInput,
} from "@/types/quotations";
import { api } from "./api";

export async function getQuotation(
	workId: string,
	quotationId: string,
): Promise<Quotation> {
	const { data } = await api.get<Quotation>(
		`/construction/works/${workId}/quotations/${quotationId}`,
	);
	return data;
}

export async function getQuotationComparison(
	workId: string,
	quotationId: string,
): Promise<QuotationComparison> {
	const { data } = await api.get<QuotationComparison>(
		`/construction/works/${workId}/quotations/${quotationId}/comparison`,
	);
	return data;
}

export async function negotiateQuotationProposal(
	workId: string,
	quotationId: string,
	proposalId: string,
	input: QuotationNegotiateInput,
): Promise<Quotation> {
	const { data } = await api.patch<Quotation>(
		`/construction/works/${workId}/quotations/${quotationId}/proposals/${proposalId}/negotiate`,
		input,
	);
	return data;
}

export async function requoteQuotation(
	workId: string,
	quotationId: string,
): Promise<Quotation> {
	const { data } = await api.post<Quotation>(
		`/construction/works/${workId}/quotations/${quotationId}/requote`,
	);
	return data;
}

export async function revertQuotationContract(
	workId: string,
	quotationId: string,
): Promise<Quotation> {
	const { data } = await api.post<Quotation>(
		`/construction/works/${workId}/quotations/${quotationId}/revert-contract`,
	);
	return data;
}

export async function chooseQuotationWinner(
	workId: string,
	quotationId: string,
	proposalId: string,
): Promise<Quotation> {
	const { data } = await api.post<Quotation>(
		`/construction/works/${workId}/quotations/${quotationId}/choose/${proposalId}`,
	);
	return data;
}
