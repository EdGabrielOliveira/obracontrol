import type { AddressValue } from "./address";
import type {
	ConstructionItemStatus,
	CostRisk,
	DataCompleteness,
	ScheduleRisk,
} from "./shared";

export type WorkSummary = {
	id: string;
	code: string;
	name: string;
	address?: string | null;
	clientName: string | null;
	plannedStart: string | null;
	plannedEnd: string | null;
	baseDate: string | null;
	costCenterId: string | null;
	totalBudget: number;
	activeBudget: number;
	directBudget?: number;
	bdiPercentage?: number;
	bdiValue?: number;
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
	dataCompleteness?: DataCompleteness;
	computedStatus: ConstructionItemStatus;
	operationalStatus: ConstructionItemStatus;
	lastImportAt: string;
	scheduleRisk: ScheduleRisk;
	costRisk: CostRisk;
};

export type WorkSummaryWithHierarchy = WorkSummary & {
	organizationId: string | null;
	organizationName: string | null;
	costCenterName: string | null;
};

export type WorkDetail = {
	id: string;
	code: string;
	name: string;
	address: string | null;
	structuredAddress: AddressValue | null;
	clientName: string | null;
	baseDate: string | null;
	plannedStart: string | null;
	plannedEnd: string | null;
	areaM2: string | null;
	operationalStatus: ConstructionItemStatus | null;
	statusReason?: string | null;
	responsibleName: string | null;
	costCenterId: string | null;
	organizationId: string | null;
	organizationName: string | null;
	costCenterName: string | null;
	activeBudget: number;
	measuredPercentage: number;
	computedStatus: ConstructionItemStatus;
	scheduleRisk: ScheduleRisk;
	costRisk: CostRisk;
	lastImportAt?: string;
	imports?: Array<{
		id: string;
		fileName: string;
		rowCount: number;
		status: string;
		importedSections?: string[];
		createdAt: string;
	}>;
	items?: Array<{
		id: string;
		index: string;
		type: "STAGE" | "ITEM";
		description: string;
		unit: string | null;
		quantity: string | null;
		totalCost: string;
		totalBudget: string;
		plannedStart: string | null;
		plannedEnd: string | null;
		completionPercentage: string;
		computedStatus: ConstructionItemStatus;
	}>;
};

export type WorkCreateInput = {
	code?: string;
	name: string;
	costCenterId: string;
	structuredAddress?: AddressValue | null;
	clientName?: string;
	baseDate?: string;
	plannedStart?: string;
	plannedEnd?: string;
	areaM2?: number;
	responsibleName?: string;
	operationalStatus?: ConstructionItemStatus;
	statusReason?: string;
};

export type WorkUpdateInput = Partial<WorkCreateInput>;

export type WorksFilter = {
	q?: string;
	status?: ConstructionItemStatus;
	costCenterId?: string;
	page?: number;
	limit?: number;
};
