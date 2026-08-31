import { logger } from "../../../lib/logger";
import { metrics } from "../../../lib/metrics";
import { auditService } from "../../audit/audit.service";
import type * as constructionRepository from "../repository";
import type { ConstructionBIWorksFilter } from "../schema";
import type { WorkBIResponse } from "../types";
import type * as wmRepository from "../work-measurement.repository";
import { buildWorkSummary } from "./calculations";
import type { ResolvedMetricSource } from "./metric-source";
import {
	type MetricSourceResolver,
	metricSourceResolver,
} from "./metric-source-resolver";
import { buildMultiworksAggregate } from "./multiworks-aggregator";
import {
	buildWorkMetricsSnapshot,
	type ManualWorkMeasurementInput,
} from "./work-metrics-snapshot";
import { buildWorkBIFromResolved } from "./work-bi-builder";

type ConstructionBIRepository = Pick<
	typeof constructionRepository,
	"getWorkWithItems" | "getAllWorksWithItems" | "getWorksByIdsWithItems"
> &
	Pick<
		typeof wmRepository,
		"getWorkMeasurementsForBI" | "getWorkMeasurementsForManyWorks"
	>;

export type WorkBIOverviewResponse = WorkBIResponse & {
	sourceMode: "LIVE";
	snapshot: null;
};

export class ConstructionBIService {
	constructor(
		private readonly repository: ConstructionBIRepository,
		readonly _audit: typeof auditService = auditService,
		private readonly resolver: MetricSourceResolver = metricSourceResolver,
	) {}

	private toOverviewResponse(
		resolved: ResolvedMetricSource,
	): WorkBIOverviewResponse {
		return {
			...buildWorkBIFromResolved(resolved),
			sourceMode: "LIVE",
			snapshot: null,
		};
	}

	async getWorkBI(
		ownerId: string,
		workId: string,
		asOf?: Date,
	): Promise<WorkBIOverviewResponse> {
		const start = performance.now();
		try {
			const resolved = await this.resolver.resolve({
				ownerId,
				workId,
				asOfDate: asOf,
			});
			logger.info("bi.calculated", {
				workId,
				sourceMode: resolved.mode,
				durationMs: performance.now() - start,
			});
			return this.toOverviewResponse(resolved);
		} finally {
			metrics.timing("bi.calc.duration_ms", performance.now() - start);
		}
	}

	async getCompareBI(ownerId: string, workIds: string[]) {
		const works = await this.repository.getWorksByIdsWithItems(
			ownerId,
			workIds,
		);
		const manualMeasurementsByWork =
			await this.repository.getWorkMeasurementsForManyWorks(
				ownerId,
				works.map((work) => work.id),
			);

		const results = works.map((w) => {
			const manualMeasurements = (manualMeasurementsByWork.get(w.id) ??
				[]) as ManualWorkMeasurementInput[];
			const snapshot = buildWorkMetricsSnapshot({
				work: w,
				manualMeasurements,
			});
			const summary = buildWorkSummary(snapshot.input, snapshot.metrics);
			return {
				workId: w.id,
				code: summary.code,
				name: summary.name,
				status: summary.computedStatus,
				plannedStart: summary.plannedStart,
				plannedEnd: summary.plannedEnd,
				activeBudget: summary.activeBudget,
				earnedValue: summary.earnedValue,
				balance: summary.balance,
				measuredPercentage: summary.measuredPercentage,
				plannedValue: summary.plannedValue,
				actualCost: summary.actualCost,
				costPerformanceIndex: summary.costPerformanceIndex,
				schedulePerformanceIndex: summary.schedulePerformanceIndex,
				costVariance: summary.costVariance,
				scheduleVariance: summary.scheduleVariance,
				scheduleRisk: summary.scheduleRisk,
				costRisk: summary.costRisk,
			};
		});

		return { works: results };
	}

	async getMultiworksBI(
		ownerId: string,
		filter?: ConstructionBIWorksFilter,
		asOfDate?: Date,
	) {
		const start = performance.now();
		try {
			const works = await this.repository.getAllWorksWithItems(ownerId);

			let filtered = works;
			if (filter?.organizationIds?.length) {
				const organizationIds = new Set(filter.organizationIds);
				filtered = filtered.filter(
					(w) =>
						w.costCenter?.organizationId &&
						organizationIds.has(w.costCenter.organizationId),
				);
			}
			if (filter?.costCenterIds?.length) {
				const costCenterIds = new Set(filter.costCenterIds);
				filtered = filtered.filter(
					(w) => w.costCenterId && costCenterIds.has(w.costCenterId),
				);
			}
			if (filter?.workIds?.length) {
				const workIds = new Set(filter.workIds);
				filtered = filtered.filter((w) => workIds.has(w.id));
			}
			if (filter?.q) {
				const q = filter.q.toLowerCase();
				filtered = filtered.filter(
					(w) =>
						w.name.toLowerCase().includes(q) ||
						w.code.toLowerCase().includes(q),
				);
			}

			const result = await buildMultiworksAggregate({
				ownerId,
				works: filtered,
				asOfDate,
				status: filter?.status,
				deps: {
					getManualMeasurements: (owner, workId) =>
						this.repository.getWorkMeasurementsForBI(owner, workId),
					getManualMeasurementsForManyWorks: (owner, workIds) =>
						this.repository.getWorkMeasurementsForManyWorks(owner, workIds),
				},
			});
			logger.info("bi.multiworks.calculated", {
				worksCount: result.works.length,
				sourceMode: result.sourceMode,
				durationMs: performance.now() - start,
			});
			return result;
		} finally {
			metrics.timing("bi.calc.duration_ms", performance.now() - start);
		}
	}
}
