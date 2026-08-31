import {
	contractKeys,
	importBatchKeys,
	importKeys,
	workKeys,
} from "@/api/query-keys";
import type { ConstructionTemplateKind } from "@/types/import";

type WorkImportKind = Exclude<
	ConstructionTemplateKind,
	"medicao-contrato" | "cotacao"
>;

const MODULE_QUERY_KEYS: Record<
	WorkImportKind,
	(workId: string) => readonly (readonly unknown[])[]
> = {
	orcamento: (workId) => [workKeys.budget(workId)],
	"orcamento-aditivo": (workId) => [
		workKeys.budget(workId),
		workKeys.budgetVersion(workId),
	],
	cronograma: (workId) => [workKeys.schedule(workId)],
	"medicao-obra": (workId) => [
		workKeys.all,
		workKeys.schedule(workId),
		workKeys.measurementsBase(workId),
		workKeys.measurementDetailBase(workId),
		workKeys.measurementReportBase(workId),
		workKeys.measurementMap(workId),
		workKeys.measurementReports(workId),
		workKeys.measurementSummary(workId),
	],
	custos: (workId) => [workKeys.costs(workId)],
};

const WORK_AGGREGATE_KEYS = (
	workId: string,
): readonly (readonly unknown[])[] => [
	workKeys.physicalFinancialBase(workId),
	["work-statistics", workId],
	["work-statistics-schedule", workId],
	workKeys.bi(workId),
	workKeys.management(workId),
	workKeys.reports(workId),
];

export function workImportQueryKeys(
	kind: WorkImportKind,
	workId: string,
): readonly (readonly unknown[])[] {
	return [
		workKeys.detail(workId),
		...MODULE_QUERY_KEYS[kind](workId),
		...WORK_AGGREGATE_KEYS(workId),
	];
}

export function importConfirmationQueryKeys(
	workId: string,
): readonly (readonly unknown[])[] {
	return [
		importKeys.listBase(workId),
		importBatchKeys.listBase(workId),
		workKeys.detail(workId),
		workKeys.budgetVersion(workId),
		workKeys.budget(workId),
		workKeys.schedule(workId),
		workKeys.measurementsBase(workId),
		workKeys.measurementDetailBase(workId),
		workKeys.measurementReportBase(workId),
		workKeys.measurementMap(workId),
		workKeys.measurementReports(workId),
		workKeys.measurementSummary(workId),
		workKeys.costs(workId),
		workKeys.costDetailBase(workId),
		workKeys.contracts(workId),
		workKeys.contractsSummary(workId),
		contractKeys.detailBase(workId),
		contractKeys.servicesBase(workId),
		contractKeys.measurementsBase(workId),
		contractKeys.measurementDetailBase(workId),
		contractKeys.measurementMapBase(workId),
		contractKeys.aggregateBase(workId),
		contractKeys.reportBase(workId),
		workKeys.bi(workId),
		workKeys.management(workId),
		workKeys.reports(workId),
		workKeys.physicalFinancialBase(workId),
		["work-statistics", workId],
		["work-statistics-schedule", workId],
	];
}
