import type { DataCompleteness, Indicator } from "./shared";

export type DataQualityIssueCode =
	| "MISSING_BASELINE_SCHEDULE"
	| "MISSING_MEASUREMENTS"
	| "MISSING_ACTUAL_COSTS"
	| "UNAPPROPRIATED_ACTUAL_COSTS"
	| "UNAPPROPRIATED_FUTURE_COSTS"
	| "ZERO_PLANNED_VALUE_DENOMINATOR"
	| "ZERO_ACTUAL_COST_DENOMINATOR";

export type DataQualityIssue = {
	code: DataQualityIssueCode;
	severity: "HIGH" | "MEDIUM" | "LOW";
	message: string;
	suggestedAction?: string;
	metric?: "PV" | "EV" | "AC" | "SPI" | "CPI";
	workId?: string;
};

export type MacroQualityIssue = {
	code: string;
	severity: "HIGH" | "MEDIUM" | "LOW";
	message: string;
	metric?: string;
};

export type WorkBISummary = {
	dataDate: string;
	activeBudget: number;
	ignoredBudget: number;
	suspendedBudget: number;
	plannedValue: number;
	earnedValue: number;
	actualCost: number;
	futureCost: number;
	measuredPercentage: number;
	plannedPercentage: number | null;
	scheduleVariance: number | null;
	schedulePerformanceIndex: number | null;
	costVariance: number | null;
	costPerformanceIndex: number | null;
	currentBudgetBalance: number;
	projectedBudgetBalance: number;
	balance: number;
	scheduleDifference: number | null;
	plannedDays: number | null;
	elapsedDays: number | null;
	remainingDays: number | null;
	budget: number;
	executedValue: number;
	lastProgressDate: string | null;
	idc: number | null;
	idp: number | null;
	bac: number;
	eacTypical: number | null;
	eacAtypical: number | null;
	selectedEac: number | null;
	etc: number | null;
	vac: number | null;
	tcpi: number | null;
	dataCompleteness: DataCompleteness;
};

export type SCurvePoint = {
	period: string;
	plannedAccumulated: number;
	measuredAccumulated: number | null;
	trendProjected: number | null;
	plannedPercentage?: number;
	measuredPercentage?: number | null;
};

export type CostByStage = {
	stageId: string;
	stageIndex: string;
	stageName: string;
	budget: number;
	executedValue: number;
	activeBudget: number;
	ignoredBudget: number;
	suspendedBudget: number;
	plannedValue: number;
	earnedValue: number;
	actualCost: number;
	measuredPercentage: number;
	plannedPercentage: number | null;
	scheduleVariance: number | null;
	schedulePerformanceIndex: number | null;
	costPerformanceIndex: number | null;
	estimatedExecutedCost: number | null;
	variation: number | null;
	balance: number;
};

export type UnappropriatedCosts = {
	totalActual: number;
	totalFuture: number;
	items: Array<{
		description: string;
		amount: number;
		costDate: string | null;
		supplierName: string | null;
		category: string | null;
		costType: "CURRENT" | "FUTURE";
		paymentStatus: string | null;
	}>;
};

export type CalculationAuditEntry = {
	key:
		| "PV"
		| "EV"
		| "AC"
		| "SPI"
		| "CPI"
		| "saldo"
		| "EAC"
		| "ETC"
		| "VAC"
		| "TCPI";
	source: string;
	formula: string;
	result: number | null;
	status: Indicator<unknown>["status"];
	unavailableReason?: string;
};

export type FinancialBreakdown = {
	budgetCostPerM2: number | null;
	actualCostPerM2: number | null;
	paidAmount: number;
	openAmount: number;
	bySupplier: Array<{
		supplierName: string;
		totalAmount: number;
		paidAmount: number;
		openAmount: number;
		percentage: number;
	}>;
	abcBySupplier: Array<{
		supplierName: string;
		totalAmount: number;
		percentage: number;
		accumulatedPercentage: number;
		abcClass: "A" | "B" | "C";
	}>;
	byGroup: Array<{ group: string; totalAmount: number; percentage: number }>;
	byCategory: Array<{
		category: string;
		totalAmount: number;
		percentage: number;
	}>;
};

export type WorkBIResponse = {
	summary: WorkBISummary;
	indicators: Record<string, Indicator<number>>;
	sCurve: SCurvePoint[];
	costByStage: CostByStage[];
	unappropriatedCosts: UnappropriatedCosts;
	calculationAudit: CalculationAuditEntry[];
	financial: FinancialBreakdown;
	qualityIssues?: DataQualityIssue[];
	alerts?: ThresholdAlert[];
	sourceMode: BiSnapshotScopeMode;
	snapshot: WorkMetricsSnapshotMetadata | null;
};

export type ThresholdAlert = {
	code: string;
	severity: "HIGH" | "MEDIUM" | "LOW";
	message: string;
	metric: string;
	value: number;
	threshold: number;
	direction: "below" | "above";
};

export type MultiworksBIResponse = {
	cards: {
		totalWorks: number;
		worksWithProgress: number;
		worksWithoutPlanning: number;
		worksAheadSchedule: number;
		worksBehindSchedule: number;
		totalActiveBudget: number;
		totalEarnedValue: number;
		totalPlannedValue: number;
		totalActualCost: number;
		totalBudgetBalance: number;
		totalCurrentBudgetBalance: number;
		totalProjectedBudgetBalance: number;
		worksBelowCost: number | null;
		worksAboveCost: number | null;
		totalBac: number;
		totalEacTypical: number | null;
		totalEacAtypical: number | null;
		totalEtc: number | null;
		totalVac: number | null;
	};
	rankings: {
		costPerformance: Array<{
			workId: string;
			name: string;
			value: number | null;
		}>;
		schedulePerformance: Array<{
			workId: string;
			name: string;
			value: number | null;
		}>;
		budgetBalance: Array<{
			workId: string;
			name: string;
			value: number | null;
		}>;
	};
	portfolioChart: Array<{
		workId: string;
		workName: string;
		activeBudget: number;
		earnedValue: number;
		actualCost: number;
		plannedValue: number;
		spi: number | null;
		cpi: number | null;
	}>;
	costsByWork: Array<{
		workId: string;
		name: string;
		budget: number;
		executedValue: number;
		measuredPercentage: number;
		activeBudget: number;
		balance: number;
		plannedPercentage: number | null;
		bac: number;
		eacTypical: number | null;
		eacAtypical: number | null;
		selectedEac: number | null;
		etc: number | null;
		vac: number | null;
		tcpi: number | null;
	}>;
	scheduleByWork: Array<{
		workId: string;
		name: string;
		plannedStart: string | null;
		plannedEnd: string | null;
		daysRemaining: number | null;
		plannedPercentage: number | null;
		measuredPercentage: number;
		scheduleVariance: number | null;
		schedulePerformanceIndex: number | null;
	}>;
	works: Array<{
		workId: string;
		costCenterId: string | null;
		name: string;
		clientName: string | null;
		activeBudget: number;
		plannedValue: number;
		earnedValue: number;
		actualCost: number;
		measuredPercentage: number;
		plannedPercentage: number | null;
		schedulePerformanceIndex: number | null;
		costPerformanceIndex: number | null;
		bac: number;
		eacTypical: number | null;
		eacAtypical: number | null;
		selectedEac: number | null;
		etc: number | null;
		vac: number | null;
		tcpi: number | null;
		currentBudgetBalance: number;
		projectedBudgetBalance: number;
		dataCompleteness: DataCompleteness;
		qualityIssues?: DataQualityIssue[];
	}>;
	dataCompleteness: DataCompleteness;
	qualityIssues?: DataQualityIssue[];
	financial: FinancialBreakdown;

	sourceMode?: "LIVE" | "PERSISTED" | "MIXED";
	asOfDate?: string | null;
	resolutionErrors?: Array<{
		workId: string;
		code: string;
		message: string;
	}>;
};

export type CompareWorkItem = {
	workId: string;
	code: string;
	name: string;
	status: string;
	plannedStart: string | null;
	plannedEnd: string | null;
	activeBudget: number;
	earnedValue: number;
	balance: number;
	measuredPercentage: number;
	plannedValue: number;
	actualCost: number;
	costPerformanceIndex: number | null;
	schedulePerformanceIndex: number | null;
	costVariance: number | null;
	scheduleVariance: number | null;
	scheduleRisk: string;
	costRisk: string;
};

export type ComparisonResponse = {
	works: CompareWorkItem[];
};

export type WorkMetricsSnapshotKind = "CURRENT" | "BASELINE";

export type WorkMetricsSnapshotMetadata = {
	id: string;
	version: number;
	snapshotKind: WorkMetricsSnapshotKind;
	status: "RASCUNHO" | "EM_REVISAO" | "ACEITO" | "TRAVADO";
	sourceFingerprint: string;
	reason: string | null;
	generatedBy: string;
	generatedAt: string;
};

export type BiSnapshotScopeMode = "LIVE" | "PERSISTED";

export type AnalysisFilter = {
	q?: string;
	status?: BIWorkStatus;
	organizationIds?: string[];
	costCenterIds?: string[];
	workIds?: string[];
};

export type BIWorkStatus =
	| "DRAFT"
	| "NOT_STARTED"
	| "IN_PROGRESS"
	| "DONE"
	| "SUSPENDED"
	| "IGNORED";

export type {
	GanttItem,
	ScheduleItem,
} from "./schedule";
