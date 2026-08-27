import type { ThresholdAlert } from "./bi/alert-thresholds";
import type {
	DataCompleteness,
	FinancialBreakdown,
	Indicator,
	WorkMetricIndicators,
} from "./bi/metrics";
import type { DataQualityIssue } from "./bi/metrics-quality";

export type PaymentStatus = "PAID" | "OPEN";

export type ParsedWorkbookHeader = {
	workName: string;
	workCode: string;
	plannedStart: Date | null;
	plannedEnd: Date | null;
	baseDate: Date | null;
};

export type ParsedWorkSheet = {
	code: string;
	name: string;
	clientName: string | null;
	baseDate: string | null;
	plannedStart: string | null;
	plannedEnd: string | null;
	areaM2: number | null;
	operationalStatus: string | null;
	responsibleName: string | null;
};

export type ParsedBudgetRow = {
	rowNumber: number;
	index: string | null;
	type: string | null;
	description: string | null;
	unit: string | null;
	quantity: unknown;
	laborUnitCost: unknown;
	materialUnitCost: unknown;
	equipmentUnitCost: unknown;
	otherUnitCost: unknown;
	unitCost?: unknown;
	totalCost?: unknown;
	providedStatus: string | null;
};

export type ParsedBaselineRow = {
	rowNumber: number;
	index: string | null;
	plannedStart: unknown;
	plannedEnd: unknown;
	plannedWeight: unknown;
};

export type ParsedReplanningRow = {
	rowNumber: number;
	index: string | null;
	version: string | null;
	replannedStart: unknown;
	replannedEnd: unknown;
	revisionDate: unknown;
	reason: string | null;
};

export type ParsedMeasurementRow = {
	rowNumber: number;
	index: string | null;
	itemName?: string | null;
	measurementDate: unknown;
	measuredPercentageAccumulated: unknown;
	measuredQuantityAccumulated: unknown;
	notes: string | null;
};

export type ParsedContractRow = {
	rowNumber: number;
	code: string | null;
	supplierName: string | null;
	contractValue: unknown;
	serviceType: string | null;
	title: string | null;
	startDate: unknown;
	endDate: unknown;
	status: string | null;
	notes: string | null;
};

export type ParsedServiceRow = {
	rowNumber: number;
	index: string | null;
	type: string | null;
	description: string | null;
	unit: string | null;
	quantity: unknown;
	unitCost: unknown;
	totalCost: unknown;
};

export type ParsedContractMeasurementRow = {
	rowNumber: number;
	number: string | null;
	date: unknown;
	title: string | null;
	discountValue: unknown;
	retentionValue: unknown;
	taxValue: unknown;
	notes: string | null;
};

export type ParsedPaymentRow = {
	rowNumber: number;
	date: unknown;
	value: unknown;
	paidValue: unknown;
	description: string | null;
	retentionValue: unknown;
	discountValue: unknown;
	status: string | null;
};

export type ParsedQuotationRow = {
	rowNumber: number;
	supplierDocument: string | null;
	supplierName: string | null;
	supplierAddress: string | null;
	supplierPhone: string | null;
	supplierEmail: string | null;
	supplierResponsible: string | null;
	serviceDescription: string | null;
	value: unknown;
	serviceStartDate: unknown;
	executionTermDays: unknown;
	paymentTerms: string | null;
	notes: string | null;
	quotationCode: string | null;
	suggestedWinner: string | null;
};

export type ParsedActualCostRow = {
	rowNumber: number;
	costDate: unknown;
	budgetIndex: string | null;
	category: string | null;
	description: string | null;
	amount: unknown;
	costType: string | null;
	sourceDocument: string | null;
	supplierName: string | null;
	costGroup: string | null;
	paymentStatus: string | null;
	competenceDate: string | null;
	dueDate: string | null;
	paymentDate: string | null;
	documentNumber: string | null;
};

export type ParsedWorkbookLegacyFields = {
	fileName: string;
	sheetName: string;
	header: ParsedWorkbookHeader;
};

export type ParsedWorkbookUnifiedFields = {
	work: ParsedWorkSheet;
	budgetRows: ParsedBudgetRow[];
	itensRows: ParsedBudgetRow[];
	baselineRows: ParsedBaselineRow[];
	replanningRows: ParsedReplanningRow[];
	measurementRows: ParsedMeasurementRow[];
	contractRows: ParsedContractRow[];
	serviceRows: ParsedServiceRow[];
	contractMeasurementRows: ParsedContractMeasurementRow[];
	paymentRows: ParsedPaymentRow[];
	actualCostRows: ParsedActualCostRow[];
	quotationRows: ParsedQuotationRow[];
	sheetNames: string[];
	/** First-row headers keyed by the workbook's actual sheet name. */
	sheetHeaders?: Record<string, string[]>;
};

export type ParsedWorkbookUnified = ParsedWorkbookUnifiedFields &
	ParsedWorkbookLegacyFields;

export type ParsedWorkbook = ParsedWorkbookUnified;

export type ImportValidationError = {
	row?: number;
	field?: string;
	sheet?: string;
	code: string;
	message: string;
	dependency?: string;
};

export type ImportWorkbookResponse = {
	importId: string;
	workId: string;
	status: "IMPORTED";
	rowCount: number;
	warningCount: number;
	importedSections: string[];
	processedSheets: string[];
	importedCount: number;
	rejectedCount: number;
	warnings: ImportValidationError[];
	errors: ImportValidationError[];
};

export type PaginatedResponse<T> = {
	data: T[];
	currentPage: number;
	nextPage: number | null;
	previousPage: number | null;
	pageCount: number;
	totalCount: number;
	isLastPage: boolean;
	isFirstPage: boolean;
};

export type ScheduleRisk = "AHEAD" | "ON_TRACK" | "BEHIND" | "UNAVAILABLE";
export type CostRisk = "BELOW_COST" | "ON_COST" | "OVER_COST" | "UNAVAILABLE";

export type WorkBudgetFields = {
	activeBudget: number;
	ignoredBudget: number;
	suspendedBudget: number;
};

export type WorkEVMFields = {
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
};

export type WorkBalanceFields = {
	currentBudgetBalance: number;
	projectedBudgetBalance: number;
	balance: number;
};

export type WorkProjectionFields = {
	bac: number;
	eacTypical: number | null;
	eacAtypical: number | null;
	selectedEac: number | null;
	etc: number | null;
	vac: number | null;
	tcpi: number | null;
};

export type WorkSummary = WorkBudgetFields &
	WorkEVMFields &
	WorkBalanceFields & {
		id: string;
		code: string;
		name: string;
		costCenterId: string | null;
		clientName?: string | null;
		plannedStart: string | null;
		plannedEnd: string | null;
		baseDate: string | null;
		totalBudget: number;
		dataCompleteness?: DataCompleteness;
		computedStatus: string;
		lastImportAt: string;
		scheduleRisk: ScheduleRisk;
		costRisk: CostRisk;
	};

export type ScheduleItem = {
	id: string;
	parentId: string | null;
	index: string;
	type: "STAGE" | "ITEM";
	description: string;
	unit: string | null;
	quantity: number | null;
	unitCost: number | null;
	totalCost: number;
	plannedStart: string | null;
	plannedEnd: string | null;
	actualStart: string | null;
	actualEnd: string | null;
	durationDays: number | null;
	baselineEnd: string | null;
	revisedEnd: string | null;
	deltaDays: number | null;
	deltaPercent: number | null;
	completionPercentage: number;
	executedValue: number;
	activeBudget: number;
	ignoredBudget: number;
	suspendedBudget: number;
	plannedValue: number;
	earnedValue: number;
	plannedPercentage: number | null;
	scheduleVariance: number | null;
	schedulePerformanceIndex: number | null;
	balance: number;
	providedStatus: string | null;
	computedStatus: string;
	children?: ScheduleItem[];
};

export type ReplanningSummary = {
	totalRevisedItems: number;
	latestRevisionDate: string | null;
	totalRevisions: number;
	itemsShifted: number;
	maxDeltaDays: number;
	revisedEndAt: string | null;
};

export type ScheduleResponse = {
	work: WorkSummary;
	items: ScheduleItem[];
	gantt: GanttItem[];
	replanning: ReplanningSummary;
};

export type GanttItem = {
	id: string;
	itemId: string;
	index: string;
	label: string;
	description: string;
	baselineStart: string | null;
	baselineEnd: string | null;
	replannedStart: string | null;
	replannedEnd: string | null;
	measuredPercentage: number;
	status: string;
	revisionVersion: string | null;
	revisionDate: string | null;
};

export type MultiworksBICards = {
	totalWorks: number;
	worksWithProgress: number;
	worksWithoutPlanning: number;
	worksAheadSchedule: number;
	worksBehindSchedule: number;
	totalActiveBudget: number;
	totalEarnedValue: number;
	totalPlannedValue: number;
	totalActualCost: number;
	totalCurrentBudgetBalance: number;
	totalProjectedBudgetBalance: number;
	totalBudgetBalance: number;
	worksBelowCost: number | null;
	worksAboveCost: number | null;
	totalBac: number;
	totalEacTypical: number | null;
	totalEacAtypical: number | null;
	totalEtc: number | null;
	totalVac: number | null;
};

export type CostByWork = WorkBudgetFields &
	WorkEVMFields &
	WorkBalanceFields &
	WorkProjectionFields & {
		workId: string;
		name: string;
		budget: number;
		executedValue: number;
		dataCompleteness?: DataCompleteness;
	};

export type ScheduleByWork = {
	workId: string;
	name: string;
	plannedStart: string | null;
	plannedEnd: string | null;
	daysRemaining: number | null;
	plannedPercentage: number | null;
	measuredPercentage: number;
	scheduleVariation: number | null;
	scheduleVariance: number | null;
	schedulePerformanceIndex: number | null;
	worksWithoutPlanning?: boolean;
};

export type MultiworksResolutionError = {
	workId: string;
	code: string;
	message: string;
};

export type MultiworksBIResponse = {
	cards: MultiworksBICards;
	rankings: MultiworksBIRankings;
	portfolioChart: PortfolioChartPoint[];
	works: PortfolioWorkSummary[];
	dataCompleteness: DataCompleteness;
	qualityIssues: DataQualityIssue[];
	costsByWork: CostByWork[];
	scheduleByWork: ScheduleByWork[];
	financial: {
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
	};

	sourceMode?: "LIVE";
	asOfDate?: string | null;
	resolutionErrors?: MultiworksResolutionError[];
};

export type RankingItem = {
	workId: string;
	name: string;
	value: number | null;
};

export type MultiworksBIRankings = {
	costPerformance: RankingItem[];
	schedulePerformance: RankingItem[];
	budgetBalance: RankingItem[];
};

export type PortfolioChartPoint = {
	workId: string;
	workName: string;
	activeBudget: number;
	earnedValue: number;
	actualCost: number;
	plannedValue: number;
	spi: number | null;
	cpi: number | null;
};

export type PortfolioWorkSummary = Pick<WorkBudgetFields, "activeBudget"> &
	Pick<
		WorkEVMFields,
		| "plannedValue"
		| "earnedValue"
		| "actualCost"
		| "measuredPercentage"
		| "plannedPercentage"
		| "schedulePerformanceIndex"
		| "costPerformanceIndex"
	> &
	Pick<WorkBalanceFields, "currentBudgetBalance" | "projectedBudgetBalance"> &
	WorkProjectionFields & {
		workId: string;
		costCenterId: string | null;
		name: string;
		clientName: string | null;
		dataCompleteness: DataCompleteness;
		qualityIssues: DataQualityIssue[];

		sourceMode?: "LIVE";
		snapshotVersion?: null;
	};

export type WorkBISummary = WorkBudgetFields &
	WorkEVMFields &
	WorkBalanceFields &
	WorkProjectionFields & {
		dataDate: string;
		scheduleDifference: number | null;
		plannedDays: number | null;
		elapsedDays: number | null;
		remainingDays: number | null;
		budget: number;
		executedValue: number;
		lastProgressDate: string | null;
		idc: number | null;
		idp: number | null;
		dataCompleteness: DataCompleteness;
	};

export type SCurvePoint = {
	period: string;
	plannedPercentage?: number;
	measuredPercentage?: number | null;
	plannedAccumulated: number;
	measuredAccumulated: number | null;
	trendProjected: number | null;
};

export type PlannedVsMeasuredByStage = {
	stageId: string;
	stageIndex: string;
	stageName: string;
	plannedAccumulated: number;
	measuredAccumulated: number;
	periods: Record<string, { planned?: number; measured?: number }>;
};

export type CostByStage = WorkBudgetFields &
	Pick<
		WorkEVMFields,
		| "plannedValue"
		| "earnedValue"
		| "actualCost"
		| "measuredPercentage"
		| "plannedPercentage"
		| "scheduleVariance"
		| "schedulePerformanceIndex"
		| "costPerformanceIndex"
	> &
	Pick<WorkBalanceFields, "balance"> & {
		stageId: string;
		stageIndex: string;
		stageName: string;
		budget: number;
		executedValue: number;
		estimatedExecutedCost: number | null;
		variation: number | null;
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

		needsReview: boolean;
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
	scheduleRisk: ScheduleRisk;
	costRisk: CostRisk;
};

export type ComparisonResponse = {
	works: CompareWorkItem[];
};

export type WorkBIResponse = {
	summary: WorkBISummary;
	indicators: WorkMetricIndicators;
	sCurve: SCurvePoint[];
	costByStage: CostByStage[];
	unappropriatedCosts: UnappropriatedCosts;
	calculationAudit: CalculationAuditEntry[];
	financial: FinancialBreakdown;
	qualityIssues: DataQualityIssue[];
	ledgerSummary: WorkBILedgerSummary | null;
	alerts: ThresholdAlert[];
};

export type WorkBILedgerSummary = {
	committed: number;
	incurred: number;
	dueOpen: number;
	paid: number;
	amendmentNet: number;
	contractedValue: number;
	measuredGross: number;
};
