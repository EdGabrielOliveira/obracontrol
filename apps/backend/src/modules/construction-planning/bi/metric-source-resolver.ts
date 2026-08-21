import { createHash } from "node:crypto";
import { ConstructionError } from "../../../lib/errors";
import { listContractSnapshotRows } from "../contract.repository";
import { deriveWorkIdentity } from "../identity";
import { summarizeLedger } from "../ledger/ledger.service";
import { getWorkMeasurementsForBI } from "../work-measurement.repository";
import { getWorkWithItems } from "../works/works.repository";
import { getOfficialWorkBalance } from "./budget-balance-source";
import type {
	WorkForBIInput,
	WorkMetricCalculationResult,
} from "./calculations";
import { projectPhysicalFinancialSchedule } from "./management-projections";
import type {
	ContractSnapshotRow,
	DataQualitySummary,
	MetricSourceRequest,
	PhysicalFinancialSeries,
	ResolvedMetricSource,
} from "./metric-source";
import { buildDataQualityIssues } from "./metrics-quality";
import {
	buildWorkMetricsSnapshot,
	type ManualWorkMeasurementInput,
	type WorkMetricsSnapshotInput,
} from "./work-metrics-snapshot";

export type MetricSourceResolverDependencies = {
	getWork: (ownerId: string, workId: string) => Promise<WorkForBIInput | null>;
	getManualMeasurements: (
		ownerId: string,
		workId: string,
	) => Promise<ManualWorkMeasurementInput[]>;
	listContracts: (
		ownerId: string,
		workId: string,
		asOfDate?: Date,
	) => Promise<ContractSnapshotRow[]>;
	getLedgerSummary: (
		ownerId: string,
		workId: string,
		asOfDate?: Date,
	) => Promise<import("../ledger/ledger.types").LedgerSummary | null>;
	getBudgetBalance: (
		ownerId: string,
		workId: string,
		asOfDate?: Date,
	) => Promise<import("./budget-balance-source").WorkBalanceDto | null>;
};

function fingerprintEnvelope(envelope: {
	input: unknown;
	metrics: unknown;
	manualMeasurements: unknown;
}): string {
	return createHash("sha256")
		.update(
			JSON.stringify({
				input: envelope.input,
				metrics: envelope.metrics,
				manualMeasurements: envelope.manualMeasurements,
			}),
		)
		.digest("hex");
}

export function seriesPointStatus(
	plannedValue: number | null,
	earnedValue: number | null,
	actualCost: number | null,
): "AVAILABLE" | "PARTIAL" | "UNAVAILABLE" {
	if (plannedValue == null && earnedValue == null && actualCost == null) {
		return "UNAVAILABLE";
	}
	return "AVAILABLE";
}

export function buildSeriesFromProjection(
	projection: ReturnType<typeof projectPhysicalFinancialSchedule>,
): PhysicalFinancialSeries {
	const { months, plannedByMonth, measuredByMonth, actualByMonth } =
		projection.totals;
	return {
		points: months.map((period, index) => {
			const plannedValue = plannedByMonth[index] ?? null;
			const earnedValue = measuredByMonth[index] ?? null;
			const actualCost = actualByMonth[index] ?? null;
			return {
				period,
				plannedValue,
				earnedValue,
				actualCost,
				status: seriesPointStatus(plannedValue, earnedValue, actualCost),
			};
		}),
	};
}

export function cutInputFactsAt(
	input: WorkMetricsSnapshotInput,
	asOf: Date,
): WorkMetricsSnapshotInput {
	const atOrBefore = (date: Date | null | undefined) =>
		date != null && date.getTime() <= asOf.getTime();
	return {
		...input,
		measurements: (input.measurements ?? []).filter((measurement) =>
			atOrBefore(measurement.measurementDate),
		),
		actualCosts: (input.actualCosts ?? []).filter((cost) =>
			atOrBefore(cost.costDate),
		),
	};
}

export function cutManualMeasurementsAt(
	manualMeasurements: ManualWorkMeasurementInput[],
	asOf: Date,
): ManualWorkMeasurementInput[] {
	return manualMeasurements.filter(
		(measurement) =>
			measurement.date != null && measurement.date.getTime() <= asOf.getTime(),
	);
}

const MISSING_ISSUES = new Set([
	"MISSING_BASELINE_SCHEDULE",
	"MISSING_MEASUREMENTS",
	"MISSING_ACTUAL_COSTS",
]);

const INVALID_ISSUES = new Set([
	"ZERO_PLANNED_VALUE_DENOMINATOR",
	"ZERO_ACTUAL_COST_DENOMINATOR",
]);

const UNLINKED_ISSUES = new Set([
	"UNAPPROPRIATED_ACTUAL_COSTS",
	"UNAPPROPRIATED_FUTURE_COSTS",
]);

export function buildQualitySummary(
	metrics: WorkMetricCalculationResult,
): DataQualitySummary {
	const issues = buildDataQualityIssues(metrics);
	return {
		missing: issues.filter((issue) => MISSING_ISSUES.has(issue.code)).length,
		invalid: issues.filter((issue) => INVALID_ISSUES.has(issue.code)).length,
		unlinked: issues.filter((issue) => UNLINKED_ISSUES.has(issue.code)).length,
		duplicated: 0,
		stale: 0,
	};
}

const defaultDependencies: MetricSourceResolverDependencies = {
	getWork: async (ownerId, workId) => {
		const work = await getWorkWithItems(ownerId, workId);
		if (!work) return null;
		const identity = deriveWorkIdentity({
			code: work.code,
			name: work.name,
			baseDate: work.baseDate,
		});
		return {
			id: work.id,
			code: work.code,
			name: identity.name,
			clientName: work.clientName ?? null,
			plannedStart: work.plannedStart,
			plannedEnd: work.plannedEnd,
			baseDate: identity.baseDate,
			createdAt: work.createdAt,
			imports: work.imports.map((importRow) => ({
				createdAt: importRow.createdAt,
			})),
			items: work.items,
			baselineSchedules: work.baselineSchedules,
			scheduleRevisions: work.scheduleRevisions,
			measurements: work.measurements,
			actualCosts: work.actualCosts,
		};
	},
	getManualMeasurements: (ownerId, workId) =>
		getWorkMeasurementsForBI(ownerId, workId),
	listContracts: (ownerId, workId, asOfDate) =>
		listContractSnapshotRows(ownerId, workId, asOfDate),
	getLedgerSummary: (ownerId, workId, asOfDate) =>
		summarizeLedger(ownerId, workId, asOfDate ?? new Date()),
	getBudgetBalance: (ownerId, workId, asOfDate) =>
		getOfficialWorkBalance(ownerId, workId, asOfDate),
};

export class MetricSourceResolver {
	constructor(
		private readonly dependencies: MetricSourceResolverDependencies = defaultDependencies,
	) {}

	async resolve(request: MetricSourceRequest): Promise<ResolvedMetricSource> {
		const { ownerId, workId, asOfDate } = request;
		return this.resolveLive(ownerId, workId, asOfDate);
	}

	private async resolveLive(
		ownerId: string,
		workId: string,
		asOfDate?: Date,
	): Promise<ResolvedMetricSource> {
		const work = await this.dependencies.getWork(ownerId, workId);
		if (!work) {
			throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
		}
		const [manualMeasurements, contracts, ledger, budgetBalance] =
			await Promise.all([
				this.dependencies.getManualMeasurements(ownerId, workId),
				this.dependencies.listContracts(ownerId, workId, asOfDate),
				this.dependencies.getLedgerSummary(ownerId, workId, asOfDate),
				this.dependencies.getBudgetBalance(ownerId, workId, asOfDate),
			]);
		const snapshot = buildWorkMetricsSnapshot({
			work,
			manualMeasurements,
			asOf: asOfDate,
		});
		const cutManualMeasurements = asOfDate
			? cutManualMeasurementsAt(manualMeasurements, asOfDate)
			: manualMeasurements;
		const input = asOfDate
			? cutInputFactsAt(snapshot.input, asOfDate)
			: snapshot.input;
		const cutSnapshot = {
			...snapshot,
			input,
			manualMeasurements: cutManualMeasurements,
		};
		return {
			mode: "LIVE",
			ownerId,
			workId,
			snapshotId: null,
			version: null,
			fingerprint: fingerprintEnvelope(cutSnapshot),
			asOfDate: snapshot.metrics.dataDate,
			input: cutSnapshot.input,
			metrics: snapshot.metrics,
			manualMeasurements: cutSnapshot.manualMeasurements,
			series: buildSeriesFromProjection(
				projectPhysicalFinancialSchedule(cutSnapshot, "monthly"),
			),
			contracts,
			quality: buildQualitySummary(snapshot.metrics),
			snapshot: null,
			ledger,
			budgetBalance,
		};
	}
}

export const metricSourceResolver = new MetricSourceResolver();

export async function resolveMetricSource(
	request: MetricSourceRequest,
): Promise<ResolvedMetricSource> {
	return metricSourceResolver.resolve(request);
}
