import type { QueryClient } from "@tanstack/react-query";
import {
	contractKeys,
	measurementCoverageKeys,
	workKeys,
} from "@/api/query-keys";

export function invalidateContractRelated(
	queryClient: QueryClient,
	workId: string,
	contractId: string,
) {
	const keys = [
		contractKeys.services(workId, contractId),
		contractKeys.measurements(workId, contractId),
		contractKeys.measurementDetailBase(workId),
		contractKeys.measurementMap(workId, contractId),
		contractKeys.measurementMapBase(workId),
		contractKeys.payments(workId, contractId),
		contractKeys.paymentsSummary(workId, contractId),
		contractKeys.aggregate(workId, contractId),
		contractKeys.aggregateBase(workId),
		contractKeys.report(workId, contractId),
		contractKeys.reportBase(workId),
		contractKeys.detail(workId, contractId),
		contractKeys.instrumentReadiness(workId, contractId),
		measurementCoverageKeys.list(workId),
		workKeys.contracts(workId),
		workKeys.contractsSummary(workId),
		workKeys.budget(workId),
		workKeys.measurementsBase(workId),
		workKeys.measurementMap(workId),
		workKeys.measurementSummary(workId),
		workKeys.measurementReports(workId),
		workKeys.physicalFinancialBase(workId),
		workKeys.management(workId),
		workKeys.bi(workId),
		workKeys.reports(workId),
		workKeys.detail(workId),
	];
	for (const key of keys) {
		queryClient.invalidateQueries({ queryKey: key });
	}
}
