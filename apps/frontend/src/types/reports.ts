import type {
	BiSnapshotScopeMode,
	DataQualityIssue,
	WorkMetricsSnapshotMetadata,
} from "./bi";

export interface WorkReport {
	work: { id: string; name: string; code: string };
	costCenter: { id: string; name: string } | null;
	budget: {
		total: number;
		itemsCount: number;
		byStatus: { active: number; done: number; notStarted: number };
	};
	measurements: {
		total: number;
		count: number;
		percentage: number;
	};
	costs: {
		total: number;
		balance: number;
	};
	evm: {
		plannedValue: number | null;
		earnedValue: number | null;
		actualCost: number | null;
		scheduleVariance: number | null;
		costVariance: number | null;
		schedulePerformanceIndex: number | null;
		costPerformanceIndex: number | null;
		currentBudgetBalance: number | null;
		projectedBudgetBalance: number | null;
	};
	sourceMode: BiSnapshotScopeMode;
	snapshot: WorkMetricsSnapshotMetadata | null;
	qualityIssues: DataQualityIssue[];
}

export interface CostCenterReport {
	costCenter: { id: string; name: string };
	works: Array<{
		id: string;
		name: string;
		code: string;
		status: string;
		budgeted: number;
		spent: number;
	}>;
	summary: {
		totalWorks: number;
		totalBudgeted: number;
		totalSpent: number;
		balance: number;
	};
}

export type OrganizationReportResponse = {
	organization: { id: string; name: string };
	costCenters: Array<{
		id: string;
		name: string;
		works: number;
		budgeted: number;
		spent: number;
	}>;
	summary: {
		totalCostCenters: number;
		totalWorks: number;
		totalBudgeted: number;
		totalSpent: number;
		balance: number;
	};
};

export type CostCenterReportResponse = CostCenterReport;
