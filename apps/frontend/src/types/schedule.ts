export type ScheduleItemType = "STAGE" | "ITEM";

export type ScheduleItem = {
	id: string;
	parentId: string | null;
	index: string;
	type: ScheduleItemType;
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
	plannedValue: number;
	earnedValue: number;
	balance: number;
	computedStatus: string;
	children?: ScheduleItem[];
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
	measuredPercentage: number | null;
	status: string;
	revisionVersion: string | null;
	revisionDate: string | null;
};

export type ReplanningSummary = {
	totalRevisedItems: number;
	latestRevisionDate: string | null;
	totalRevisions: number;
	itemsShifted: number;
	maxDeltaDays: number;
	revisedEndAt: string | null;
};

export type ScheduleRevision = {
	id: string;
	index: string;
	version: string | null;
	replannedStart: string | null;
	replannedEnd: string | null;
	revisionDate: string | null;
	reason: string | null;
};

export type ScheduleResponse = {
	work: import("@/types/works").WorkSummary;
	items: ScheduleItem[];
	gantt: GanttItem[];
	replanning: ReplanningSummary;
};

export type ScheduleVersionItem = {
	index: string;
	baselineStart: string | null;
	baselineEnd: string | null;
	baselineWeight: number | null;
	replannedStart: string | null;
	replannedEnd: string | null;
	deltaDays: number | null;
};

export type ScheduleVersionView = {
	id: string;
	versionNumber: number;
	label: string;
	status: "RASCUNHO" | "VIGENTE";
	isActive: boolean;
	revisionDate: string | null;
	reason: string | null;
	createdBy: string | null;
	createdAt: string;
	items: ScheduleVersionItem[];
};

export type SchedulePhysicalFinancialResponse = {
	stages: Array<{
		stageName: string;
		stageIndex: string;
		months: Array<{
			month: string;
			planned: number;
			measured: number;
			actual: number;
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
