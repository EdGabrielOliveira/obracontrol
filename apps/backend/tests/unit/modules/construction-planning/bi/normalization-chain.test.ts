import { describe, expect, it } from "bun:test";
import {
	calculateMetrics,
	toWorkWithMetricsInput,
	type WorkForBIInput,
} from "../../../../../src/modules/construction-planning/bi/calculations";
import { workMeasurementsToMetricInputs } from "../../../../../src/modules/construction-planning/bi/measurement-adapter";
import { computeWorkSummary } from "../../../../../src/modules/construction-planning/bi/work-summary";
import { buildScheduleFromDbItems } from "../../../../../src/modules/construction-planning/schedule/schedule-builder";

function workForBI(
	measurements: WorkForBIInput["measurements"],
): WorkForBIInput {
	return {
		id: "work-1",
		code: "OBRA-001",
		name: "Obra",
		clientName: null,
		plannedStart: null,
		plannedEnd: null,
		baseDate: new Date("2026-01-15T00:00:00.000Z"),
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		imports: [],
		items: [
			{
				id: "item-1",
				parentId: null,
				index: "1.1",
				type: "ITEM",
				description: "Escavacao",
				totalCost: 100,
				plannedStart: null,
				plannedEnd: null,
				actualStart: null,
				actualEnd: null,
				completionPercentage: 0,
				computedStatus: "IN_PROGRESS",
				sortOrder: 1,
			},
		],
		baselineSchedules: [],
		scheduleRevisions: [],
		measurements,
		actualCosts: [],
	};
}

function rawMeasurement(measuredPercentageAccumulated: number) {
	return {
		id: "measurement-1",
		budgetItemId: "item-1",
		measurementDate: new Date("2026-01-15T00:00:00.000Z"),
		measuredPercentageAccumulated,
	};
}

describe("percentage normalization chain", () => {
	it("rejects persisted percentage values above 100 at the adapter choke point", () => {
		expect(() =>
			toWorkWithMetricsInput(workForBI([rawMeasurement(200)])),
		).toThrow("Percentual invalido");
	});

	it("normalizes raw 0..100 measurement rows at the toWorkWithMetricsInput choke point", () => {
		const input = toWorkWithMetricsInput(workForBI([rawMeasurement(50)]));

		expect(input.measurements?.[0]?.measuredPercentageAccumulated).toBe(0.5);
	});

	it("computes canonical metrics from raw 0..100 rows through toWorkWithMetricsInput", () => {
		const input = toWorkWithMetricsInput(workForBI([rawMeasurement(50)]));
		const metrics = calculateMetrics(input, input);

		expect(metrics.earnedValue).toBe(50);
		expect(metrics.measuredPercentage).toBe(0.5);
	});

	it("keeps raw 0..100 measurement rows canonical through the schedule path", () => {
		const result = buildScheduleFromDbItems(
			{
				id: "work-1",
				code: "OBRA-001",
				name: "Obra",
				clientName: null,
				plannedStart: null,
				plannedEnd: null,
				baseDate: new Date("2026-01-31T00:00:00.000Z"),
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				lastImportAt: null,
			},
			{
				items: workForBI([]).items,
				measurements: [rawMeasurement(50)],
			},
		);

		expect(result.work.earnedValue).toBe(50);
		expect(result.work.measuredPercentage).toBe(0.5);
	});

	it("projects accepted work measurement progress into the Gantt item", () => {
		const result = buildScheduleFromDbItems(
			{
				id: "work-1",
				code: "OBRA-001",
				name: "Obra",
				clientName: null,
				plannedStart: null,
				plannedEnd: null,
				baseDate: new Date("2026-01-31T00:00:00.000Z"),
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				lastImportAt: null,
			},
			{
				items: workForBI([]).items,
				measurements: workMeasurementsToMetricInputs([
					{
						date: new Date("2026-01-15T00:00:00.000Z"),
						items: [
							{
								budgetItemId: "item-1",
								accumulatedValue: 50,
								accumulatedPercentage: 0.5,
							},
						],
					},
				]),
			},
		);

		expect(result.gantt[0]?.measuredPercentage).toBe(0.5);
	});

	it("keeps raw 0..100 measurement rows canonical through the work summary path", () => {
		const summary = computeWorkSummary({
			id: "work-1",
			code: "OBRA-001",
			name: "Obra",
			clientName: null,
			plannedStart: null,
			plannedEnd: null,
			baseDate: new Date("2026-01-15T00:00:00.000Z"),
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			lastImportAt: new Date("2026-01-02T00:00:00.000Z"),
			activeChildren: {
				items: workForBI([]).items,
				baselineSchedules: [],
				measurements: [rawMeasurement(50)],
				actualCosts: [],
			},
		});

		expect(summary.earnedValue).toBe(50);
		expect(summary.measuredPercentage).toBe(0.5);
	});

	it("includes accepted work measurements in the work summary path", () => {
		const summary = computeWorkSummary({
			id: "work-1",
			code: "OBRA-001",
			name: "Obra",
			clientName: null,
			plannedStart: null,
			plannedEnd: null,
			baseDate: new Date("2026-01-15T00:00:00.000Z"),
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			lastImportAt: new Date("2026-01-02T00:00:00.000Z"),
			activeChildren: {
				items: workForBI([]).items,
				baselineSchedules: [],
				measurements: [],
				actualCosts: [],
				manualMeasurements: [
					{
						date: new Date("2026-01-15T00:00:00.000Z"),
						items: [
							{
								budgetItemId: "item-1",
								accumulatedValue: 50,
								accumulatedPercentage: 0.5,
							},
						],
					},
				],
			},
		});

		expect(summary.earnedValue).toBe(50);
		expect(summary.measuredPercentage).toBe(0.5);
		expect(summary.dataCompleteness?.hasMeasurements).toBe(true);
	});
});
