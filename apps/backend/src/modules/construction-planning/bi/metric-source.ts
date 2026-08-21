import type { WorkMetricCalculationResult } from "./calculations";
import type {
	ManualWorkMeasurementInput,
	WorkMetricsSnapshotInput,
} from "./work-metrics-snapshot";

export type MetricSourceRequest = {
	ownerId: string;
	workId: string;
	asOfDate?: Date;
};

export type PhysicalFinancialSeriesPoint = {
	period: string;
	plannedValue: number | null;
	earnedValue: number | null;
	actualCost: number | null;
	status: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";
};

export type PhysicalFinancialSeries = {
	points: PhysicalFinancialSeriesPoint[];
};

export type ContractSnapshotRow = {
	id: string;
	contractValue: number;
	measuredValue: number | null;
	paidValue: number | null;
	status: string;
};

export type DataQualitySummary = {
	missing: number;
	invalid: number;
	unlinked: number;
	duplicated: number;
	stale: number;
};

export type ResolvedMetricSource = {
	mode: "LIVE";
	ownerId: string;
	workId: string;
	snapshotId: null;
	version: null;
	fingerprint: string;
	asOfDate: string;
	input: WorkMetricsSnapshotInput;
	metrics: WorkMetricCalculationResult;
	manualMeasurements: ManualWorkMeasurementInput[];
	series: PhysicalFinancialSeries;
	contracts: ContractSnapshotRow[];
	quality: DataQualitySummary;
	snapshot: null;
	ledger: import("../ledger/ledger.types").LedgerSummary | null;
	budgetBalance: import("./budget-balance-source").WorkBalanceDto | null;
};
