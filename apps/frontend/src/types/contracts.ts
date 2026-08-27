// ARQUIVADO is accepted from the API for historical contracts.
export type ContractStatus =
	| "RASCUNHO"
	| "A_INICIAR"
	| "EM_ANDAMENTO"
	| "PARALISADO"
	| "FINALIZADO"
	| "ARQUIVADO";

export type PaymentStatus = "EM_ABERTO" | "PAGO";

export type ContractServiceType =
	| "ETAPA"
	| "SUBETAPA"
	| "COMPOSICAO"
	| "INSUMO"
	| "ITEM";

export type Contract = {
	id: string;
	workId: string;
	code: string;
	contractRequestId?: string | null;
	quotationId?: string | null;
	supplierName: string;
	supplierId: string | null;
	supplier?: ContractSupplierSummary | null;
	contractValue: number;
	serviceType: string | null;
	objectDescription: string | null;
	title: string | null;
	startDate: string | null;
	endDate: string | null;
	status: ContractStatus;
	statusReason?: string | null;
	statusChangedAt?: string | null;
	notes: string | null;
	createdAt: string;
};

export type ContractSupplierSummary = {
	id: string;
	name: string;
	document: string | null;
	responsibleName: string | null;
	responsibleDocument: string | null;
	contact: string | null;
	addressZipCode: string | null;
	addressStreet: string | null;
	addressNumber: string | null;
	addressComplement: string | null;
	addressDistrict: string | null;
	addressCity: string | null;
	addressState: string | null;
};

export type ContractSupplierCandidate = {
	name: string;
	document: string | null;
	address: string | null;
	phone: string | null;
	email: string | null;
	responsibleName: string | null;
};

export type ContractQuotationSnapshot = {
	originalProposalValue: number | null;
	negotiatedValue: number;
	negotiationReductionAmount: number | null;
	negotiationReductionPercent: number | null;
};

export type ContractCreateInput = {
	code: string;
	supplierName?: string;
	supplierId?: string | null;
	contractValue: number;
	serviceType?: string;
	objectDescription: string;
	title?: string;
	startDate?: string;
	endDate?: string;
	status?: ContractStatus;
	notes?: string;
	services?: Array<{
		budgetItemId: string;
		quantity: number;
		unitCost: number;
	}>;
};

export type ContractEditInput = Pick<
	ContractCreateInput,
	| "title"
	| "serviceType"
	| "objectDescription"
	| "startDate"
	| "endDate"
	| "status"
> & { statusReason?: string };

export type ContractUpdateInput = Partial<ContractEditInput>;

export type ContractDetail = Contract & {
	totalValue: number;
	amendmentTotal: number;
	quotation?: ContractQuotationSnapshot | null;
	supplierCandidate?: ContractSupplierCandidate | null;
};

export type ContractAmendmentKind = "ADITIVO" | "REDUCAO";

export type ContractAmendment = {
	id: string;
	ownerId: string;
	contractId: string;
	kind: ContractAmendmentKind;
	value: number;
	reason: string;
	date: string;
	createdBy: string;
	createdAt: string;
	approvalStatus:
		| "PENDING_GESTOR"
		| "PENDING_GERENTE"
		| "APPROVED"
		| "REJECTED";
	gestorReviewedBy?: string | null;
	gerenteReviewedBy?: string | null;
	effectiveAt?: string | null;
	measurementIds: string[];
};

export type CreateContractAmendmentInput = {
	kind: ContractAmendmentKind;
	value: number;
	reason: string;
	date: string;
	measurementIds: string[];
};

export type UpdateContractAmendmentInput =
	Partial<CreateContractAmendmentInput>;

export type ContractSummaryResponse = {
	totalContracts: number;
	operationalContracts: number;
	pendingContracts: number;
	draftContracts: number;
	pendingContractValue: number;
	totalContractValue: number;
	approvedMeasurements: number;
	totalMeasuredValue: number;
	measuredPercentage: number;
	totalPaidValue: number;
	totalOutstandingValue: number;
	paidPercentage: number;
};

export type ContractService = {
	id: string;
	parentId: string | null;
	description: string;
	type: ContractServiceType;
	unit: string | null;
	quantity: number | null;
	unitCost: number | null;
	totalCost: number | null;
	budgetItemId: string | null;
	sortOrder: number;
	budgetItem?: {
		id: string;
		displayIndex?: string;
		description: string;
		index: string;
		unit?: string | null;
		quantity?: number | null;
		unitCost?: number | null;
		totalCost?: number | null;
	} | null;
	children?: ContractService[];
};

export type CreateContractServiceInput = {
	budgetItemId: string;
	quantity?: number;
	unitCost?: number;
	sortOrder?: number;
};

export type ContractServicePreviewResult = {
	budgetItem: { id: string; description: string; index: string };
	availableBefore: number;
	projectedValue: number;
	availableAfter: number;
	warnings: string[];
};

export type ContractPayment = {
	id: string;
	contractId: string;
	date: string;
	value: number;
	paidValue: number;
	description: string | null;
	measurementId: string | null;
	retentionValue: number | null;
	discountValue: number | null;
	status: PaymentStatus;
	balanceOverride: boolean;
};

export type CreateContractPaymentInput = {
	date: string;
	value: number;
	paidValue: number;
	measurementId?: string;
	description?: string;
	retentionValue?: number;
	discountValue?: number;
	status?: PaymentStatus;
	balanceOverride?: boolean;
	reason?: string | null;
};

export type UpdateContractPaymentInput = Partial<
	Omit<CreateContractPaymentInput, "measurementId">
> & {
	measurementId?: string | null;
};

export type ContractMeasurement = {
	id: string;
	contractId: string;
	number: number;
	date: string;
	title: string | null;
	discountValue: number | null;
	retentionValue: number | null;
	taxValue: number | null;
	notes: string | null;
	status: "RASCUNHO" | "ACEITO" | "RECUSADO" | "ARQUIVADO";
	statusReason?: string | null;
	approvalStatus?: "APPROVED" | "PENDING_APPROVAL";
	approvalRequestId?: string | null;
	warnings?: Array<{
		code: string;
		severity: "warning";
		message: string;
		measurementDate?: string;
		periodStart?: string | null;
		periodEnd?: string | null;
	}>;
	items?: ContractMeasurementItem[];
};

export type ContractMeasurementItem = {
	id: string;
	serviceId: string;
	measuredQuantity: number | null;
	measuredValue: number | null;
	measuredPercentage: number | null;
	accumulatedQuantity: number | null;
	accumulatedValue: number | null;
	accumulatedPercentage: number | null;
};

export type CreateContractMeasurementInput = {
	date: string;
	title: string;
	number?: number;
	notes?: string;
	items: Array<{
		serviceId: string;
		measuredQuantity: number;
	}>;
};

export type UpdateContractMeasurementMetadataInput = {
	title?: string;
	date?: string;
	notes?: string;
};

export type UpdateContractMeasurementItemInput = {
	id?: string;
	serviceId: string;
	measuredQuantity: number;
};

export type UpdateContractMeasurementItemsInput = {
	items: UpdateContractMeasurementItemInput[];
};

export type ContractFolder = {
	id: string;
	contractId: string;
	name: string;
	files: Array<{
		id: string;
		name: string;
		url: string;
		size: number | null;
		mimeType: string | null;
		createdAt: string;
	}>;
};

export type ContractMeasurementDetailServiceItem = {
	id: string;
	parentId: string | null;
	description: string;
	type: ContractServiceType;
	unit: string | null;
	quantity: number | null;
	unitCost: number | null;
	totalCost: number | null;
	sortOrder: number;
	budgetItemId: string | null;
	budgetItem?: {
		id: string;
		description: string;
		index: string;
		unit?: string | null;
		quantity?: number | null;
		unitCost?: number | null;
		totalCost?: number | null;
	} | null;
	measuredCurrent: { quantity: number; value: number; percentage: number };
	measuredAccumulated: { quantity: number; value: number; percentage: number };
	balance: { quantity: number; value: number; percentage: number };
	children?: ContractMeasurementDetailServiceItem[];
};

export type ContractMeasurementDetail = {
	contract: {
		id: string;
		code: string;
		supplierName: string;
		title: string | null;
		status: ContractStatus;
		contractValue: number;
	};
	measurement: ContractMeasurement;
	serviceTree: ContractMeasurementDetailServiceItem[];
	totals: {
		contractValue: number;
		measuredCurrent: number;
		measuredAccumulated: number;
		balance: number;
	};
};
