export type MeasurementWarning = {
	code: string;
	severity: "warning";
	message: string;
	measurementDate?: string;
	periodStart?: string | null;
	periodEnd?: string | null;
};

export type MeasurementApprovalStatus = "APPROVED" | "PENDING_APPROVAL";

export type WorkMeasurement = {
	id: string;
	workId: string;
	number: number;
	date: string;
	title: string;
	discountValue: number | null;
	retentionValue: number | null;

	totalMeasuredValue: number;

	currentMeasuredValue?: number;

	accumulatedMeasuredValue?: number;
	notes: string | null;
	createdBy: string | null;

	createdByName?: string | null;
	createdAt: string;

	approvalStatus?: MeasurementApprovalStatus;
	approvalRequestId?: string | null;
	warnings?: MeasurementWarning[];
	balanceOverride: boolean;
	evidenceNote: string | null;
	items?: WorkMeasurementItem[];
};

export type WorkMeasurementItem = {
	id: string;
	measurementId: string;
	budgetItemId: string;
	budgetItemIndex: string;
	budgetItemDescription: string;
	measuredQuantity: number | null;
	measuredValue: number | null;

	measuredPercentage: number | null;
	accumulatedQuantity: number | null;
	accumulatedValue: number | null;

	accumulatedPercentage: number | null;

	availableQuantity?: number | null;

	impactStatus?: "APPROVED" | "PENDING_APPROVAL" | null;
};

export type WorkMeasurementDetailResponse = {
	work: {
		id: string;
		code: string;
		name: string;
	};
	measurement: WorkMeasurement;
	budgetSummary: {
		totalBudgeted: number;
		totalMeasured: number;
		balanceToMeasure: number;
	};
	items: MeasurementTreeItem[];
	totals: {
		current: {
			quantity: number;
			measuredQuantity: number;
			measuredValue: number;

			measuredPercentage: number;
		};
		accumulated: {
			quantity: number;
			measuredQuantity: number;
			measuredValue: number;

			measuredPercentage: number;
		};
		balance: {
			quantity: number;
			value: number;

			percentage: number;
		};
	};
};

export type MeasurementTreeItem = {
	id: string;
	index: string;
	parentId: string | null;
	sortOrder: number;
	quantity: number;
	totalCost: number;
	description: string;
	children: MeasurementTreeItem[];
	measuredCurrent: {
		quantity: number;
		value: number;

		percentage: number;
	};
	measuredAccumulated: {
		quantity: number;
		value: number;

		percentage: number;
	};
	balanceToMeasure: {
		quantity: number;
		value: number;

		percentage: number;
	};
};

export type WorkMeasurementMapResponse = {
	work: { id: string; code: string; name: string };
	budgetSummary: {
		totalBudgeted: number;
		totalMeasured: number;
		balanceToMeasure: number;
	};
	workMeasurements: Array<{
		id: string;
		number: number;
		date: string;
		title: string;
		totalMeasured: number;
	}>;

	items: MeasurementTreeItem[];
	totals: {
		budgeted: number;
		measured: number;
		balance: number;
	};
};

export type WorkMeasurementReportsResponse = {
	measurementByStage: Array<{
		stage: string;
		budgeted: number;
		measured: number;

		percentage: number;
	}>;
	plannedVsMeasured: Array<{
		month: string;
		planned: number;
		measured: number;

		performance: number;
		plannedAccumulated: number;
		measuredAccumulated: number;
		performanceAccumulated: number;
	}>;
};

export type WorkMeasurementSummaryResponse = {
	totalMeasured: number;
	totalMeasuredPercentage: number;
	totalBudgeted: number;
	balanceToMeasure: number;
	measurementCount: number;
	lastMeasurementDate: string | null;
};

export type MeasurementReportResponse = {
	measurement: WorkMeasurement;
	items: MeasurementTreeItem[];
	totals: {
		current: {
			quantity: number;
			measuredQuantity: number;
			measuredValue: number;
			measuredPercentage: number;
		};
		accumulated: {
			quantity: number;
			measuredQuantity: number;
			measuredValue: number;
			measuredPercentage: number;
		};
		balance: {
			quantity: number;
			value: number;
			percentage: number;
		};
	};
	report: {
		budgetSummary: {
			totalBudgeted: number;
			totalMeasured: number;
			balanceToMeasure: number;
		};
		generatedAt: string;
	};
};

export type CreateMeasurementInput = {
	date: string;
	title: string;
	items: Array<{
		budgetItemId: string;
		measuredQuantity: number;
	}>;
	balanceOverride?: boolean;
	evidenceNote?: string;
};

export type MeasurementCoverage = {
	id: string;
	ownerId: string;
	workMeasurementItemId: string;
	contractMeasurementItemId: string;
	quantity: number;
	amount: number;
	workMeasurementItem?: {
		id: string;
		budgetItemId: string;
		measurement: { id: string; number: number };
	};
	contractMeasurementItem?: {
		id: string;
		serviceId: string;
		measurement: {
			id: string;
			number: number;
			contract: { id: string; code: string };
		};
	};
};

export type CreateCoverageInput = {
	workMeasurementItemId: string;
	contractMeasurementItemId: string;
	quantity: number;
};

export type ActualCostAllocation = {
	id: string;
	actualCostId: string;
	budgetItemId: string;
	basis?: "PERCENTAGE" | "VALUE";
	percentage?: number | null;
	value?: number | null;
	ownerId: string;
	budgetItem?: {
		id: string;
		index: string;
		type: string;
		description: string;
		unit: string | null;
	} | null;
};

export type LegacyActualCost = {
	id: string;
	workId: string;
	costDate: string | null;
	budgetIndex: string | null;
	category: string;
	categoryDetail?: string | null;
	description: string | null;
	amount: number;
	costType: string;
	sourceDocument: string | null;
	supplierName: string | null;
	supplierId: string | null;
	supplier?: { id: string; name: string } | null;
	paymentStatus: "PAID" | "OPEN";
	appropriationStatus: string;
	approval?: {
		requestId: string;
		status:
			| "PENDING"
			| "APPROVED"
			| "REJECTED"
			| "CONFLICTED"
			| "CANCELLED"
			| "EXECUTED";
		requiredApproverRole: string;
		createdAt: string;
	} | null;
	allocations?: ActualCostAllocation[];
	budgetVersionItem?: ActualCostBudgetItem | null;
	migration?: {
		sourceCostId: string;
		sourceAllocationId: string;
		resolution:
			| "DIRECT_CURRENT_ITEM"
			| "CURRENT_PARENT_STAGE"
			| "HISTORICAL_ITEM";
	} | null;
};

export type ActualCostBudgetItemRelation =
	| "CURRENT_ITEM"
	| "CURRENT_PARENT_STAGE"
	| "HISTORICAL_ITEM";

export type ActualCostBudgetItem = {
	versionId: string;
	versionNumber: number;
	versionLabel: string;
	versionItemId: string;
	index: string;
	displayIndex: string;
	description: string;
	unit: string | null;
	relation: ActualCostBudgetItemRelation;
};

export type CostBudgetItemStage = {
	index: string;
	displayIndex: string;
	description: string;
};

export type CostBudgetItemOption = {
	id: string;
	budgetItemId: string;
	identityId: string;
	index: string;
	displayIndex: string;
	description: string;
	unit: string | null;
	quantity: number | null;
	totalCost: number;
	unitCost: number | null;
	stage: CostBudgetItemStage | null;
};

export type CostBudgetItemSelectorResponse = {
	version: {
		id: string;
		number: number;
		label: string;
		displayIndex: string;
	};
	items: CostBudgetItemOption[];
};
