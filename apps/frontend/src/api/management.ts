import type {
	BiSnapshotScopeMode,
	WorkMetricsSnapshotMetadata,
} from "@/types/bi";
import { api } from "./api";

export type CostByCategory = {
	category: string;
	amount: number;
	percentage: number;
};

export type SupplierBreakdown = {
	supplierName: string;
	totalAmount: number;
	paidAmount: number;
	openAmount: number;
};

export type WorkManagementResponse = {
	budgeted: number;
	spent: number;
	balance: number;
	executionPercentage?: number;
	costsByCategory: CostByCategory[];
	supplierBreakdown: SupplierBreakdown[];
	sourceMode: BiSnapshotScopeMode;
	snapshot: WorkMetricsSnapshotMetadata | null;
};

export async function getWorkManagement(workId: string, asOfDate?: string) {
	const { data } = await api.get<WorkManagementResponse>(
		`/construction/works/${workId}/management`,
		{ params: asOfDate ? { asOfDate } : {} },
	);
	return data;
}
