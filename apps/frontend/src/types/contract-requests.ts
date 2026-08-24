export type ContractRequestStatus =
	| "EM_ESPERA"
	| "AGUARDANDO_APROVACAO_FINAL"
	| "ACEITA";

export type ContractRequestSummary = {
	id: string;
	title: string;
	serviceType: string;
	status: string;
	createdAt: string;
	contractId: string | null;
};

export type ContractRequestItem = {
	budgetItemId: string;
	quantity: number;
	sortOrder: number;
};

export type ContractRequestDetail = {
	id: string;
	ownerId: string;
	workId: string;
	title: string;
	serviceType: string;
	description: string | null;
	startDate: string | null;
	endDate: string | null;
	status: ContractRequestStatus;
	confirmedBatchId: string | null;
	acceptedProposalId: string | null;
	acceptedAt: string | null;
	acceptedBy: string | null;
	contractId: string | null;
	createdBy: string | null;
	items: ContractRequestItem[];
};

export type ContractRequestCreateInput = {
	title: string;
	serviceType: string;
	description: string;
	startDate: string;
	endDate: string;
	items: Array<{ budgetItemId: string; quantity: number }>;
};

export type ContractRequestComparison = {
	request: {
		id: string;
		title: string;
		serviceType: string;
		description: string | null;
		startDate: string | null;
		endDate: string | null;
		status: ContractRequestStatus;
	};
	selectedItems: Array<{
		budgetItemId: string;
		index: string | null;
		description: string | null;
		unit: string | null;
		quantity: number;
		budgetTotal: number;
	}>;
	budget: { total: number };
	statistics: {
		budgetTotal: number;
		supplierCount: number;
		supplierLowest: number | null;
		supplierHighest: number | null;
		supplierAverage: number | null;
		lowestRatioPercent: number | null;
		averageRatioPercent: number | null;
		averageProfitMarginPercent: number | null;
		negotiatedReductionTotal: number;
		originalProposalTotal: number;
		negotiatedReductionPercent: number | null;
		negotiatedReductionSupplierName: string | null;
		bestSupplier: {
			name: string;
			proposalValue: number;
			costRatioPercent: number;
		} | null;
		worstSupplier: {
			name: string;
			proposalValue: number;
			costRatioPercent: number;
		} | null;
		classification: {
			profit: {
				count: number;
				amount: number;
				supplier: {
					name: string;
					proposalValue: number;
					costRatioPercent: number;
				} | null;
			};
			neutral: {
				count: number;
				amount: number;
				supplier: {
					name: string;
					proposalValue: number;
					costRatioPercent: number;
				} | null;
			};
			expense: {
				count: number;
				amount: number;
				supplier: {
					name: string;
					proposalValue: number;
					costRatioPercent: number;
				} | null;
			};
		};
	};
	quotation: {
		batchId: string;
		version: string | null;
		fileName: string | null;
		uploadedAt: string | null;
	} | null;
	proposals: Array<{
		id: string;
		supplier: {
			cnpj: string;
			name: string;
			registered: boolean;
			supplierId: string | null;
			linked: boolean;
		};
		proposalValue: number;
		originalProposalValue: number;
		negotiationReductionAmount: number;
		negotiationReductionPercent: number;
		profitMarginAmount: number;
		profitMarginPercent: number;
		costRatioPercent: number;
		costAlert: "GREEN" | "YELLOW" | "RED";
		semaphore?: {
			status: "GREEN" | "YELLOW" | "RED" | "UNAVAILABLE";
			budgetTotal: number | null;
			varianceAmount: number | null;
			variancePercent: number | null;
			limitPercent: number;
		};
		costStatus: "PROFIT" | "NEUTRAL" | "EXPENSE";
		costDifferenceAmount: number;
		difference: { amount: number; percent: number };
		notes: string | null;
		suggestedWinner: boolean;
	}>;
	permissions: { canAccept: boolean };
};

export type ContractRequestAcceptance = {
	requestId: string;
	status: "ACEITA";
	acceptedProposalId: string;
	contract: {
		id: string;
		code: string | null;
		status: string | null;
		supplierId: string | null;
		supplierName: string | null;
		contractValue: number | null;
	};
	acceptedAt: string;
	acceptedBy: string;
};

export type QuotationMapConfirmResult = {
	batchId: string;
	confirmed: boolean;
	proposalCount: number;
};
