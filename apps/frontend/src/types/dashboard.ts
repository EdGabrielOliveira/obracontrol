import type { MultiworksBIResponse, WorkBIResponse } from "./bi";

export type DashboardTab = "system" | "organization" | "costCenter" | "work";

export interface DashboardContext {
	activeTab: DashboardTab;
	selectedOrganizationId: string | null;
	selectedCostCenterId: string | null;
	selectedWorkId: string | null;
}

export interface OrganizationBarChartProps {
	data: MultiworksBIResponse["costsByWork"];
}

export interface CostCenterBarChartProps {
	data: MultiworksBIResponse["costsByWork"];
}

export interface CostPieChartProps {
	data: MultiworksBIResponse["costsByWork"] | WorkBIResponse["costByStage"];
	title?: string;
}

export interface TemporalEvolutionChartProps {
	data: MultiworksBIResponse["scheduleByWork"];
}

export interface WorkKPICardsProps {
	summary: WorkBIResponse["summary"];
}

export interface ContractMeasurementStatusProps {
	workId: string;
}
