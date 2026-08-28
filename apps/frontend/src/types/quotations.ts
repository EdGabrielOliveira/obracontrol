export type QuotationProposal = {
	id: string;
	supplierId: string | null;
	supplierName: string;
	supplierDocument: string | null;
	supplierAddress: string | null;
	supplierPhone: string | null;
	supplierEmail: string | null;
	supplierResponsible: string | null;
	serviceDescription: string | null;
	value: number;
	serviceStartDate: string | null;
	executionTermDays: number | null;
	paymentTerms: string | null;
	notes: string | null;
	isWinner: boolean;
};

export type QuotationBudgetItem = {
	id?: string;
	budgetItemId: string;
	quantity: number;
	budgetItem?: {
		id: string;
		index: string;
		description: string;
		unit: string | null;
		unitCost: number | null;
		totalCost: number | null;
	};
};

export type Quotation = {
	id: string;
	workId: string;
	serviceType: string | null;
	title: string;
	observation: string | null;
	status: string;
	maxSuppliers: number;
	contractId: string | null;
	proposals: QuotationProposal[];
	items: QuotationBudgetItem[];
	createdAt: string;
};

export type QuotationComparisonProposal = QuotationProposal & {
	supplierRegistered: boolean;
	differenceFromBudget: number | null;
	round?: number | null;
};

export type QuotationComparison = Omit<Quotation, "proposals"> & {
	budgetTotal: number | null;
	proposals: QuotationComparisonProposal[];
};

export type QuotationCreateInput = {
	serviceType?: string | null;
	title: string;
	observation?: string | null;
	startDate?: string | null;
	endDate?: string | null;
	maxSuppliers?: number;
	items: Array<{ budgetItemId: string; quantity: number }>;
};

export type QuotationProposalInput = {
	supplierId?: string | null;
	supplierDocument?: string | null;
	supplierName: string;
	value: number;
	justification?: string | null;
};

export type QuotationNegotiateInput = {
	value: number;
	justification: string;
};
