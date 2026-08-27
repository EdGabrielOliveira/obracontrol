import type { MultiworksBIResponse } from "../types";
import {
	isOperationalPortfolioWork,
	normalizeWorkOperationalStatus,
} from "../works/work-operational-status";
import {
	computeWorkStatus,
	type WorkForBIInput,
	type WorkMetricCalculationResult,
} from "./calculations";
import { buildMultiworksBIFromMetrics } from "./multiworks-builder";
import type { ManualWorkMeasurementInput } from "./work-metrics-snapshot";
import {
	buildWorkMetricsSnapshot,
	type WorkMetricsSnapshotInput,
} from "./work-metrics-snapshot";

export type MultiworksAggregatorDependencies = {
	getManualMeasurements: (
		ownerId: string,
		workId: string,
	) => Promise<ManualWorkMeasurementInput[]>;
	getManualMeasurementsForManyWorks: (
		ownerId: string,
		workIds: string[],
	) => Promise<Map<string, ManualWorkMeasurementInput[]>>;
};

export type MultiworksResolutionError = {
	workId: string;
	code: string;
	message: string;
};

export type MultiworksAggregateResponse = MultiworksBIResponse & {
	sourceMode: "LIVE";
	asOfDate: string | null;
	resolutionErrors: MultiworksResolutionError[];
};

type AggregateEntry = {
	work: WorkMetricsSnapshotInput;
	metrics: WorkMetricCalculationResult;
	mode: "LIVE";
	version: null;
};

export async function buildMultiworksAggregate(input: {
	ownerId: string;
	works: WorkForBIInput[];
	asOfDate?: Date;
	status?: string;
	deps: MultiworksAggregatorDependencies;
}): Promise<MultiworksAggregateResponse> {
	const { works, asOfDate, status, deps } = input;
	const entries: AggregateEntry[] = [];

	const measurementsByWork = await deps.getManualMeasurementsForManyWorks(
		input.ownerId,
		works.map((work) => work.id),
	);

	for (const work of works) {
		const manualMeasurements = measurementsByWork.get(work.id) ?? [];
		const snapshot = buildWorkMetricsSnapshot({
			work,
			manualMeasurements,
			asOf: asOfDate,
		});
		entries.push({
			work: snapshot.input,
			metrics: snapshot.metrics,
			mode: "LIVE",
			version: null,
		});
	}

	// Obras concluídas ou ignoradas permanecem consultáveis, mas não devem
	// contaminar os gráficos operacionais do portfólio. Um filtro explícito
	// continua permitindo analisá-las isoladamente.
	let selected = entries.filter(
		({ work }) =>
			status !== undefined ||
			isOperationalPortfolioWork(
				normalizeWorkOperationalStatus(work.operationalStatus),
			),
	);
	if (status) {
		selected = selected.filter(
			({ work, metrics }) =>
				(work.operationalStatus
					? normalizeWorkOperationalStatus(work.operationalStatus)
					: computeWorkStatus(metrics.measuredPercentage)) === status,
		);
	}

	const base = buildMultiworksBIFromMetrics(
		selected.map(({ work, metrics }) => ({ work, metrics })),
	);

	return {
		...base,
		sourceMode: "LIVE",
		asOfDate: asOfDate ? asOfDate.toISOString() : null,
		resolutionErrors: [],
		works: base.works.map((row) => ({
			...row,
			sourceMode: "LIVE" as const,
			snapshotVersion: null,
		})),
	};
}
