export type BudgetItemType =
	| "STAGE"
	| "SUBSTAGE"
	| "ITEM"
	| "COMPOSITION"
	| "INPUT";

type BudgetItemFields = {
	parentId?: string | null;
	index: string;
	type: BudgetItemType;
	description: string;
	unit?: string | null;
	quantity?: number | null;
	laborUnitCost?: number | null;
	materialUnitCost?: number | null;
	equipmentUnitCost?: number | null;
	otherUnitCost?: number | null;
	unitCost?: number | null;
	totalCost?: number | null;
	plannedStart?: string | null;
	plannedEnd?: string | null;
	actualStart?: string | null;
	actualEnd?: string | null;
	completionPercentage?: number;
	providedStatus?: string | null;
	sortOrder?: number;
};

export type CreateBudgetItemInput = BudgetItemFields;

export type UpdateBudgetItemInput = Partial<
	Omit<BudgetItemFields, "index" | "type" | "description">
> & {
	index?: string;
	type?: BudgetItemType;
	description?: string;
};

export type BudgetTreeItem = {
	id: string;

	versionItemId?: string;
	parentId: string | null;
	index: string;
	type: BudgetItemType;
	description: string;
	unit: string | null;
	quantity: number | null;
	unitCost: number | null;
	totalCost: number | null;
	plannedStart: string | null;
	plannedEnd: string | null;
	completionPercentage: number | null;
	sortOrder: number;
	children: BudgetTreeItem[];
};

export type BudgetSummary = {
	totalBudgeted: number;
	totalDirectCost: number;
	bdiPercentage: number;
	bdiValue: number;
	totalFinalPrice: number;
	totalMeasured: number;
	balanceToMeasure: number;
	measurementCount: number;
	actualCostCount: number;
};

export type BudgetWork = {
	id: string;
	code: string;
	name: string;
	clientName: string | null;
	plannedStart: string | null;
	plannedEnd: string | null;
	baseDate: string | null;
	areaM2: number | null;
	operationalStatus: string;
	responsibleName: string | null;
	bdiPercentage: number;
};

export type BudgetViewResponse = {
	work: BudgetWork;
	items: BudgetTreeItem[];
	summary: BudgetSummary;

	governed?: boolean;
	schedule: {
		baselineSchedules: Array<{
			id: string;
			index: string;
			plannedStart: string | null;
			plannedEnd: string | null;
			plannedWeight: number | null;
		}>;
		scheduleRevisions: Array<{
			id: string;
			index: string;
			version: string | null;
			replannedStart: string | null;
			replannedEnd: string | null;
		}>;
	};
	physicalFinancial: {
		stages: Array<{
			stageName: string;
			stageIndex: string;
			months: Array<{
				month: string;
				planned: number;
				measured: number;
			}>;
		}>;
		totals: {
			months: string[];
			plannedByMonth: number[];
			measuredByMonth: number[];
			actualByMonth: number[];
			plannedAccumulated: number[];
			measuredAccumulated: number[];
			actualAccumulated: number[];
		};
	};
};

export type EffectiveBudgetVersion = {
	budgetVersionId: string;
	scheduleVersionId: string | null;
	mode: "EFFECTIVE" | "SELECTED_VERSION";
};

export type BudgetVersionStatus =
	| "DRAFT"
	| "PENDING_APPROVAL"
	| "ACTIVE"
	| "REJECTED"
	| "SUPERSEDED"
	| "ARCHIVED";

export type BudgetVersionSummary = {
	id: string;
	index: string;
	version: number;
	label: string;
	status: BudgetVersionStatus;
	isActive: boolean;
	sourceVersionId: string | null;
	approvalRequestId: string | null;
	submittedAt: string | null;
	reason: string | null;
	kind?: "ORIGINAL" | "ADITIVO" | null;
	totalCost?: number;
	acrescimoBruto?: number;
	supressao?: number;
	impactoLiquido?: number;
	percentualImpacto?: number;
};

export type BudgetVersionItem = {
	id: string;
	index: string;
	type: BudgetItemType;
	description: string;
	unit: string | null;
	quantity: number | null;
	unitCost: number | null;
	totalCost: number | null;
	parentIndex: string | null;
	sortOrder: number;
	plannedStart?: string | null;
	plannedEnd?: string | null;
};

export type BudgetVersionDetail = BudgetVersionSummary & {
	totals: { totalCost: number };
	items: BudgetVersionItem[];
};

export type BudgetVersionDraft = {
	id: string;
	label: string;
	version: number;
	status: "DRAFT";
	sourceVersionId: string;
};

export type BudgetVersionSubmitResult = {
	budgetVersionId: string;
	status: string;
	approvalRequestId: string;
};

export type BudgetVersionNewItemInput = {
	index: string;
	parentIndex?: string | null;
	type: string;
	description: string;
	unit?: string | null;
	quantity?: number | null;
	unitCost?: number | null;
	totalCost?: number | null;
	sortOrder?: number;
};

export type CreateBudgetVersionInput = {
	label: string;
	itemOverrides?: Array<{ index: string; totalCost: number }>;
	newItems?: BudgetVersionNewItemInput[];
};

export type BudgetChangeClassification =
	| "UNCHANGED"
	| "INCREASED"
	| "DECREASED"
	| "ADDED"
	| "REMOVED"
	| "STRUCTURE_CHANGED"
	| "SCHEDULE_CHANGED";

export type BudgetSnapshotItemJson = {
	index: string;
	parentIndex: string | null;
	type: "STAGE" | "ITEM";
	description: string;
	unit: string | null;
	quantity: number | null;
	unitCost: number | null;
	totalCost: number;
	plannedStart: string | null;
	plannedEnd: string | null;
};

export type BudgetComparisonRow = {
	itemIndex: string;
	parentIndex: string | null;
	level: "STAGE" | "ITEM";
	description: string;
	classification: BudgetChangeClassification[];
	previous: BudgetSnapshotItemJson | null;
	candidate: BudgetSnapshotItemJson | null;
	delta: {
		quantity: number;
		unitCost: number;
		totalCost: number;
		plannedStartDays: number | null;
		plannedEndDays: number | null;
		plannedDurationDays: number | null;
	};
	validation: {
		valid: boolean;
		violations: Array<{ code: string; itemIndex: string; message: string }>;
	};
};

export type BudgetVersionImportPreview = {
	batchId: string;
	role: "ORIGINAL" | "ADITIVO";
	sourceVersionId: string | null;
	comparison: {
		sourceTotal: number;
		candidateTotal: number;
		grossIncrease: number;
		suppression: number;
		netImpact: number;
		impactPercent: number;
		countsByClassification: Record<BudgetChangeClassification, number>;
		blockingIssues: Array<{ code: string; itemIndex: string; message: string }>;
		rows: BudgetComparisonRow[];
	};
};

export type BudgetVersionImportPreviewFilters = {
	page?: number;
	limit?: number;
	classification?: BudgetChangeClassification;
};

export type BudgetVersionImportPreviewPage = {
	importId: string;
	title: string | null;
	status: string;
	role: "ORIGINAL" | "ADITIVO";
	sourceVersionId: string | null;
	summary: {
		sourceTotal: number;
		candidateTotal: number;
		grossIncrease: number;
		suppression: number;
		netImpact: number;
		impactPercent: number;
		countsByClassification: Record<BudgetChangeClassification, number>;
	};
	conflicts: Array<{ code: string; itemIndex: string; message: string }>;
	changes: {
		data: BudgetComparisonRow[];
		page: number;
		limit: number;
		total: number;
	};
};
