export type SupplierStatus =
	| "DRAFT"
	| "PENDING_APPROVAL"
	| "APPROVED"
	| "BLOCKED";

export type SupplierPixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM";

export type SupplierBankAccountType = "CHECKING" | "SAVINGS";

export type Supplier = {
	id: string;
	ownerId: string;
	name: string;
	document: string | null;
	responsibleName: string | null;
	responsibleDocument: string | null;
	contact: string | null;
	pixKey: string | null;
	pixKeyType: SupplierPixKeyType | null;
	bankCode: string | null;
	bankName: string | null;
	bankBranch: string | null;
	bankAccount: string | null;
	bankAccountType: SupplierBankAccountType | null;
	addressZipCode: string | null;
	addressStreet: string | null;
	addressNumber: string | null;
	addressComplement: string | null;
	addressDistrict: string | null;
	addressCity: string | null;
	addressState: string | null;
	notes: string | null;
	status: SupplierStatus;
	approvalRequestId: string | null;
	createdAt: string;
	updatedAt: string;
};

export type SupplierDetail = {
	supplier: Supplier;
	contracts: Array<{
		id: string;
		code: string;
		title: string | null;
		contractValue: string | number;
		status: string;
		work: { id: string; name: string };
	}>;
	actualCosts: Array<{
		id: string;
		costDate: string | null;
		description: string | null;
		amount: string | number;
		category: string;
		paymentStatus: string;
		work: { id: string; name: string };
	}>;
	workLinks: Array<{
		id: string;
		status: string;
		work: { id: string; name: string };
	}>;
};

export type SupplierAnalyticsItem = {
	supplierId: string | null;
	supplierName: string;
	contractCount: number;
	contractedAmount: number;
	measuredAmount: number;
	paidAmount: number;
	openAmount: number;
	roundCount: number;
	proposalCount: number;
	negotiationCount: number;
	awardedValue: number;
	reductionAmount: number;
	reductionPercent: number | null;
	participationPercent: number | null;
};

export type SupplierProfileFields = {
	name: string;
	document?: string | null;
	responsibleName?: string | null;
	responsibleDocument?: string | null;
	contact?: string | null;
	pixKey?: string | null;
	pixKeyType?: SupplierPixKeyType | null;
	bankCode?: string | null;
	bankName?: string | null;
	bankBranch?: string | null;
	bankAccount?: string | null;
	bankAccountType?: SupplierBankAccountType | null;
	addressZipCode?: string | null;
	addressStreet?: string | null;
	addressNumber?: string | null;
	addressComplement?: string | null;
	addressDistrict?: string | null;
	addressCity?: string | null;
	addressState?: string | null;
	notes?: string | null;
};

export type SupplierCreateInput = SupplierProfileFields;

export type SupplierUpdateInput = Partial<SupplierProfileFields>;

export type WorkSupplierStatus = "PENDING_APPROVAL" | "ACTIVE" | "REVOKED";

export type WorkSupplier = {
	id: string;
	ownerId: string;
	workId: string;
	supplierId: string;
	status: WorkSupplierStatus;
	approvalRequestId: string | null;
	createdAt: string;
	updatedAt: string;
	supplier: Supplier;
};
