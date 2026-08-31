import type { QueryClient } from "@tanstack/react-query";

import {
	biKeys,
	dashboardKeys,
	governanceKeys,
	workKeys,
} from "@/api/query-keys";

/**
 * Invalidates every obra/medição projection that can be affected by a
 * measurement mutation. Prefix keys deliberately cover filtered and dated
 * variants as well as the canonical detail queries.
 */
export function invalidateWorkMeasurementQueries(
	queryClient: QueryClient,
	workId: string,
): void {
	const queryKeys = [
		workKeys.all,
		biKeys.all,
		biKeys.multiworksAll,
		biKeys.compareAll,
		dashboardKeys.summary,
		workKeys.detail(workId),
		workKeys.schedule(workId),
		["work-statistics", workId],
		["work-statistics-schedule", workId],
		workKeys.measurementsBase(workId),
		workKeys.measurementDetailBase(workId),
		workKeys.measurementReportBase(workId),
		workKeys.measurementMap(workId),
		workKeys.measurementReports(workId),
		workKeys.measurementSummary(workId),
		workKeys.budget(workId),
		workKeys.physicalFinancialBase(workId),
		workKeys.bi(workId),
		workKeys.management(workId),
		workKeys.reports(workId),
		governanceKeys.pendingApprovals(workId),
	] as const;

	for (const queryKey of queryKeys) {
		void queryClient.invalidateQueries({ queryKey });
	}
}
