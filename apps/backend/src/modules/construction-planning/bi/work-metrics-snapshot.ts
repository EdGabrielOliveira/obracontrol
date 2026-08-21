import {
	calculateMetrics,
	toWorkWithMetricsInput,
	type WorkForBIInput,
	type WorkMetricCalculationResult,
} from "./calculations";
import { workMeasurementsToMetricInputs } from "./measurement-adapter";

export type ManualWorkMeasurementInput = Parameters<
	typeof workMeasurementsToMetricInputs
>[0][number];

export type WorkMetricsSnapshot = {
	input: ReturnType<typeof toWorkWithMetricsInput>;
	metrics: WorkMetricCalculationResult;
	manualMeasurements: ManualWorkMeasurementInput[];
};

export type WorkMetricsSnapshotInput = ReturnType<
	typeof toWorkWithMetricsInput
>;

const SNAPSHOT_TOP_LEVEL_DATE_KEYS = [
	"plannedStart",
	"plannedEnd",
	"baseDate",
	"createdAt",
	"lastImportAt",
] as const;

const SNAPSHOT_ITEM_DATE_KEYS = [
	"plannedStart",
	"plannedEnd",
	"actualStart",
	"actualEnd",
] as const;

const SNAPSHOT_BASELINE_DATE_KEYS = ["plannedStart", "plannedEnd"] as const;

const SNAPSHOT_REVISION_DATE_KEYS = [
	"replannedStart",
	"replannedEnd",
	"revisionDate",
] as const;

function hydrateDateValue(value: unknown): unknown {
	if (value instanceof Date) return value;
	if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
		return new Date(value);
	}
	return value;
}

function hydrateRecord(
	record: Record<string, unknown>,
	keys: readonly string[],
): Record<string, unknown> {
	const hydrated = { ...record };
	for (const key of keys) {
		const value = hydrated[key];
		if (value != null) {
			hydrated[key] = hydrateDateValue(value);
		}
	}
	return hydrated;
}

export function hydrateRecords(
	records: unknown,
	keys: readonly string[],
): unknown {
	if (!Array.isArray(records)) return records;
	return records.map((record) =>
		record != null && typeof record === "object"
			? hydrateRecord(record as Record<string, unknown>, keys)
			: record,
	);
}

export function hydrateSnapshotInputDates(
	input: WorkMetricsSnapshotInput,
): WorkMetricsSnapshotInput {
	const stored = input as unknown as Record<string, unknown>;
	return {
		...hydrateRecord(stored, SNAPSHOT_TOP_LEVEL_DATE_KEYS),
		items: hydrateRecords(stored.items, SNAPSHOT_ITEM_DATE_KEYS),
		baselineSchedules: hydrateRecords(
			stored.baselineSchedules,
			SNAPSHOT_BASELINE_DATE_KEYS,
		),
		scheduleRevisions: hydrateRecords(
			stored.scheduleRevisions,
			SNAPSHOT_REVISION_DATE_KEYS,
		),
		measurements: hydrateRecords(stored.measurements, ["measurementDate"]),
		actualCosts: hydrateRecords(stored.actualCosts, ["costDate"]),
		manualMeasurements: hydrateRecords(stored.manualMeasurements, ["date"]),
	} as unknown as WorkMetricsSnapshotInput;
}

export function buildWorkMetricsSnapshot(input: {
	work: WorkForBIInput;
	manualMeasurements?: ManualWorkMeasurementInput[];
	asOf?: Date;
}): WorkMetricsSnapshot {
	const manualMeasurements = input.manualMeasurements ?? [];
	const metricInput = toWorkWithMetricsInput({
		...input.work,
		measurements: [
			...input.work.measurements,
			...workMeasurementsToMetricInputs(manualMeasurements),
		],
	});

	return {
		input: metricInput,
		metrics: calculateMetrics(metricInput, metricInput, input.asOf),
		manualMeasurements,
	};
}
