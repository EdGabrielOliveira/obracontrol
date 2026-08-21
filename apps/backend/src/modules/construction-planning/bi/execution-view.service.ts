import { resolveBudgetAnalysisVersion } from "../../../lib/budget-version-adapter";
import { ConstructionError } from "../../../lib/errors";
import type { ConstructionScheduleService } from "../schedule/schedule-service";
import type { ScheduleItem } from "../types";
import type { WorkMetricCalculationResult } from "./calculations";
import {
	type ExecutionViewRepository,
	prismaExecutionViewRepository,
} from "./execution-view.repository";
import type { ResolvedMetricSource } from "./metric-source";
import type { MetricSourceResolver } from "./metric-source-resolver";
import { buildDataQualityIssues } from "./metrics-quality";

export type BudgetExecutionCompleteness =
	| "COMPLETE"
	| "PARTIAL"
	| "UNAVAILABLE";

export type BudgetExecutionMetric = {
	budgeted: number | null;
	realized: number | null;
	variance: number | null;
	completeness: BudgetExecutionCompleteness;
};

export type FinancialExecutionIssue = {
	code: string;
	message: string;
};

export type FinancialExecutionView = {
	grossMargin: BudgetExecutionMetric;
	grossProfit: BudgetExecutionMetric;
	billing: BudgetExecutionMetric;
	costs: BudgetExecutionMetric;
	issues: FinancialExecutionIssue[];
};

export type OperationalDeviationStatus =
	| "ON_TRACK"
	| "AT_RISK"
	| "DELAYED"
	| "NO_DATA";

export type OperationalDeviation = {
	id: string;
	workId: string;
	budgetItemId: string | null;
	scheduleItemId: string | null;
	index: string;
	description: string;
	plannedStart: string | null;
	plannedEnd: string | null;
	realizedStart: string | null;
	realizedEnd: string | null;
	varianceDays: number | null;
	status: OperationalDeviationStatus;
	cause: string | null;
	action: string | null;
	responsibleId: string | null;
	dueDate: string | null;
	evidence: string | null;
};

export type ExecutionViewResponse = {
	work: { id: string; code: string; name: string };
	sourceMode: "LIVE";
	budgetVersionId: string | null;
	snapshotVersion: null;
	asOfDate: string;
	generatedAt: string;
	qualityIssues: ReturnType<typeof buildDataQualityIssues>;
	financial: FinancialExecutionView;
	contracts: Array<{
		contractId: string;
		code: string;
		supplierName: string;
		contractValue: number;
		amendmentNet: number;
		status: string;
		linkedBudgetItems: Array<{
			id: string;
			index: string;
			description: string;
		}>;
		financial: FinancialExecutionView;
	}>;
	schedule: {
		baselineVersionId: string | null;
		baselineLabel: string | null;
		revisionCount: number;
		latestRevisionDate: string | null;
		revisedEndAt: string | null;
		maxDeltaDays: number | null;
		items: number;
		deviations: OperationalDeviation[];
	};
};

const PENDING_DEFINITION_ISSUE = (label: string): FinancialExecutionIssue => ({
	code: "PENDING_DEFINITION",
	message: `Formula "${label}" aguardando decisao de metrica macro (DEC-MET).`,
});

export function blockedFinancialMetric(): BudgetExecutionMetric {
	return {
		budgeted: null,
		realized: null,
		variance: null,
		completeness: "UNAVAILABLE",
	};
}

export function buildCostsMetric(
	budgeted: number | null,
	realized: number | null,
	variance: number | null,
): BudgetExecutionMetric {
	if (budgeted == null && realized == null) {
		return {
			budgeted: null,
			realized: null,
			variance: null,
			completeness: "UNAVAILABLE",
		};
	}
	if (budgeted != null && realized != null) {
		return { budgeted, realized, variance, completeness: "COMPLETE" };
	}
	return { budgeted, realized, variance: null, completeness: "PARTIAL" };
}

export function buildRootFinancial(
	metrics: Pick<
		WorkMetricCalculationResult,
		"activeBudget" | "actualCost" | "currentBudgetBalance" | "dataCompleteness"
	>,
): FinancialExecutionView {
	const hasCosts = metrics.dataCompleteness.hasActualCosts;
	const budgeted = metrics.activeBudget;
	const realized = hasCosts ? metrics.actualCost : null;
	const variance = hasCosts ? metrics.currentBudgetBalance : null;

	return {
		grossMargin: blockedFinancialMetric(),
		grossProfit: blockedFinancialMetric(),
		billing: blockedFinancialMetric(),
		costs: buildCostsMetric(budgeted, realized, variance),
		issues: [
			PENDING_DEFINITION_ISSUE("Margem bruta orcada"),
			PENDING_DEFINITION_ISSUE("Meta de lucro bruto"),
			PENDING_DEFINITION_ISSUE("Origem do faturado"),
		],
	};
}

export function buildContractFinancial(
	contractValue: number,
): FinancialExecutionView {
	return {
		grossMargin: blockedFinancialMetric(),
		grossProfit: blockedFinancialMetric(),
		billing: blockedFinancialMetric(),
		costs: buildCostsMetric(contractValue, null, null),
		issues: [
			PENDING_DEFINITION_ISSUE("Margem bruta orcada"),
			PENDING_DEFINITION_ISSUE("Meta de lucro bruto"),
			PENDING_DEFINITION_ISSUE("Origem do faturado"),
			PENDING_DEFINITION_ISSUE("Realizado do contrato"),
		],
	};
}

export function deviationStatusOf(
	item: Pick<ScheduleItem, "plannedStart" | "plannedEnd" | "deltaDays">,
): OperationalDeviationStatus {
	if (!item.plannedStart && !item.plannedEnd) return "NO_DATA";
	if (item.deltaDays == null) return "ON_TRACK";
	if (item.deltaDays > 0) return "DELAYED";
	return "ON_TRACK";
}

export function buildDeviation(
	workId: string,
	item: ScheduleItem,
): OperationalDeviation {
	return {
		id: `dev-${item.id}`,
		workId,
		budgetItemId: null,
		scheduleItemId: item.id,
		index: item.index,
		description: item.description,
		plannedStart: item.plannedStart,
		plannedEnd: item.plannedEnd,
		realizedStart: item.actualStart,
		realizedEnd: item.actualEnd,
		varianceDays: item.deltaDays,
		status: deviationStatusOf(item),
		cause: null,
		action: null,
		responsibleId: null,
		dueDate: null,
		evidence: null,
	};
}

export class ExecutionViewService {
	constructor(
		private readonly repository: ExecutionViewRepository = prismaExecutionViewRepository,
		private readonly resolver: MetricSourceResolver,
		private readonly scheduleService: ConstructionScheduleService,
		private readonly versionResolver: typeof resolveBudgetAnalysisVersion = resolveBudgetAnalysisVersion,
	) {}

	async getExecutionView(
		ownerId: string,
		workId: string,
		asOf?: Date,
	): Promise<ExecutionViewResponse> {
		const work = await this.repository.getWorkIdentity(ownerId, workId);
		if (!work) {
			throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
		}

		const resolved: ResolvedMetricSource = await this.resolver.resolve({
			ownerId,
			workId,
			asOfDate: asOf,
		});

		const [budgetAnalysis, contracts, scheduleVersion, schedule] =
			await Promise.all([
				this.versionResolver(ownerId, workId, {}),
				this.repository.listContractExecutionNodes(ownerId, workId, asOf),
				this.repository.getScheduleVersionIdentity(ownerId, workId),
				this.scheduleService.getWorkSchedule(ownerId, workId),
			]);

		return {
			work,
			sourceMode: resolved.mode,
			budgetVersionId: budgetAnalysis.budgetVersionId,
			snapshotVersion: resolved.version,
			asOfDate: resolved.asOfDate,
			generatedAt: new Date().toISOString(),
			qualityIssues: buildDataQualityIssues(resolved.metrics, workId),
			financial: buildRootFinancial(resolved.metrics),
			contracts: contracts.map((contract) => ({
				contractId: contract.id,
				code: contract.code,
				supplierName: contract.supplierName,
				contractValue: contract.contractValue,
				amendmentNet: contract.amendmentNet,
				status: contract.status,
				linkedBudgetItems: contract.linkedBudgetItems,
				financial: buildContractFinancial(contract.contractValue),
			})),
			schedule: {
				baselineVersionId: scheduleVersion?.id ?? null,
				baselineLabel: scheduleVersion?.label ?? null,
				revisionCount: schedule.replanning.totalRevisions,
				latestRevisionDate: schedule.replanning.latestRevisionDate,
				revisedEndAt: schedule.replanning.revisedEndAt,
				maxDeltaDays: schedule.replanning.maxDeltaDays,
				items: schedule.items.length,
				deviations: schedule.items.map((item) => buildDeviation(workId, item)),
			},
		};
	}
}
