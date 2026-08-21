import { api } from "./api";

export type DashboardSummary = {
	organizations: number;
	costCenters: number;
	suppliers: number;
	works: {
		total: number;
		byStatus: {
			NOT_STARTED: number;
			IN_PROGRESS: number;
			DONE: number;
			SUSPENDED: number;
		};
	};
	pendingContracts: number;
	pendingApprovals: number;
	worksAtRisk: number;
	pendingCosts: number;
};

export async function getDashboardSummary() {
	const { data } = await api.get<DashboardSummary>(
		"/construction/dashboard-summary",
	);
	return data;
}
