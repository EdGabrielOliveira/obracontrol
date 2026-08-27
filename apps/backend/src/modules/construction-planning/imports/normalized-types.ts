import type { ImportValidationError } from "../types";

export type BudgetType = "STAGE" | "ITEM";
export type BudgetStatus =
	| "NOT_STARTED"
	| "IN_PROGRESS"
	| "DONE"
	| "IGNORED"
	| "SUSPENDED";
export type CostCategory = "LABOR" | "MATERIAL" | "EQUIPMENT" | "OTHER";
export type CostType = "CURRENT" | "FUTURE";
export type AppropriationStatus = "APPROPRIATED" | "UNAPPROPRIATED";
export type PaymentStatus = "PAID" | "OPEN";

export type NormalizedBudgetItem = {
	identityId?: string;
	rowNumber: number;
	index: string;
	parentIndex: string | null;
	type: BudgetType;
	description: string;
	unit: string | null;
	quantity: number | null;
	laborUnitCost: number;
	materialUnitCost: number;
	equipmentUnitCost: number;
	otherUnitCost: number;
	unitCostTotal: number;
	totalBudget: number;
	unitCost: number | null;
	totalCost: number;
	plannedStart: Date | null;
	plannedEnd: Date | null;
	actualStart: Date | null;
	actualEnd: Date | null;
	completionPercentage: number;
	providedStatus: string | null;
	computedStatus: BudgetStatus;
	sortOrder: number;
};

export type NormalizedWork = {
	code: string;
	name: string;
	clientName: string | null;
	baseDate: Date | null;
	plannedStart: Date | null;
	plannedEnd: Date | null;
	areaM2: number | null;
	operationalStatus: string | null;
	responsibleName: string | null;
	fileName: string;
	sheetName: string;
	importedSections: string[];
};

export type NormalizedBaselineSchedule = {
	rowNumber: number;
	index: string;
	plannedStart: Date | null;
	plannedEnd: Date | null;
	plannedWeight: number | null;
};

export type NormalizedScheduleRevision = {
	rowNumber: number;
	index: string;
	version: string | null;
	replannedStart: Date | null;
	replannedEnd: Date | null;
	revisionDate: Date | null;
	reason: string | null;
};

export type NormalizedMeasurement = {
	rowNumber: number;
	index: string;
	itemName?: string | null;
	measurementDate: Date;
	measuredPercentageAccumulated: number;
	measuredQuantityAccumulated: number | null;
	notes: string | null;
};

export type NormalizedActualCost = {
	rowNumber: number;
	costDate: Date | null;
	budgetIndex: string | null;
	category: CostCategory;
	description: string | null;
	amount: number;
	costType: CostType;
	sourceDocument: string | null;
	appropriationStatus: AppropriationStatus;
	supplierName: string | null;
	costGroup: string | null;
	paymentStatus: PaymentStatus;
	competenceDate: Date | null;
	dueDate: Date | null;
	paymentDate: Date | null;
	documentNumber: string | null;
};

export type ContractStatus =
	| "RASCUNHO"
	| "A_INICIAR"
	| "EM_ANDAMENTO"
	| "PARALISADO"
	| "FINALIZADO";
export type ContractPaymentStatus = "EM_ABERTO" | "PAGO";

export type NormalizedContract = {
	rowNumber: number;
	code: string;
	supplierName: string;
	contractValue: number;
	serviceType: string | null;
	title: string | null;
	startDate: Date | null;
	endDate: Date | null;
	status: ContractStatus;
	notes: string | null;
};

export type NormalizedContractService = {
	rowNumber: number;
	index: string;
	type: ContractServiceType;
	description: string;
	unit: string | null;
	quantity: number | null;
	unitCost: number | null;
	totalCost: number | null;
};

export type NormalizedContractMeasurement = {
	rowNumber: number;
	number: string | null;
	date: Date;
	title: string | null;
	discountValue: number | null;
	retentionValue: number | null;
	taxValue: number | null;
	notes: string | null;
};

export type NormalizedContractPayment = {
	rowNumber: number;
	date: Date;
	value: number;
	paidValue: number;
	description: string | null;
	retentionValue: number | null;
	discountValue: number | null;
	status: ContractPaymentStatus;
};

export type ContractServiceType =
	| "ETAPA"
	| "SUBETAPA"
	| "COMPOSICAO"
	| "INSUMO"
	| "ITEM";

export type ValidationResult = {
	valid: boolean;
	errors: ImportValidationError[];
	warnings: ImportValidationError[];
	work: NormalizedWork;
	normalizedRows: NormalizedBudgetItem[];
	normalizedItens: NormalizedBudgetItem[];
	baselineSchedules: NormalizedBaselineSchedule[];
	scheduleRevisions: NormalizedScheduleRevision[];
	measurements: NormalizedMeasurement[];
	actualCosts: NormalizedActualCost[];
	contracts: NormalizedContract[];
	contractServices: NormalizedContractService[];
	contractMeasurements: NormalizedContractMeasurement[];
	contractPayments: NormalizedContractPayment[];
	importedSections?: string[];
	processedSheets: string[];
};
