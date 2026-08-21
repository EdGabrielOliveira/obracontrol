import { describe, expect, it } from "bun:test";
import type { WorkForBIInput } from "../../../../../src/modules/construction-planning/bi/calculations";
import {
	buildWorkMetricsSnapshot,
	hydrateSnapshotInputDates,
} from "../../../../../src/modules/construction-planning/bi/work-metrics-snapshot";

function work(): WorkForBIInput {
	return {
		id: "work-1",
		code: "OBRA-001",
		name: "Obra",
		clientName: null,
		plannedStart: null,
		plannedEnd: null,
		baseDate: new Date("2026-01-31T00:00:00.000Z"),
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		imports: [],
		items: [
			{
				id: "item-1",
				parentId: null,
				index: "1.1",
				type: "ITEM",
				description: "Escavacao",
				quantity: 10,
				totalCost: 1000,
				totalBudget: 1000,
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
		measurements: [
			{
				id: "imported-measurement",
				budgetItemId: "item-1",
				measurementDate: new Date("2026-01-10T00:00:00.000Z"),
				measuredPercentageAccumulated: 25,
			},
		],
		actualCosts: [],
	};
}

describe("buildWorkMetricsSnapshot", () => {
	it("normalizes imported and manual measurements through the same snapshot", () => {
		const snapshot = buildWorkMetricsSnapshot({
			work: work(),
			manualMeasurements: [
				{
					date: new Date("2026-01-20T00:00:00.000Z"),
					items: [{ budgetItemId: "item-1", accumulatedValue: 600 }],
				},
			],
		});

		expect(snapshot.metrics.earnedValue).toBe(600);
		expect(snapshot.metrics.measuredPercentage).toBe(0.6);
		expect(snapshot.input.measurements).toHaveLength(2);
	});
});

describe("hydrateSnapshotInputDates", () => {
	type StoredInput = {
		plannedStart: string | Date | null;
		plannedEnd: string | Date | null;
		baseDate: string | Date | null;
		createdAt: string | Date;
		lastImportAt: string | Date | null;
		items: Array<{
			id: string;
			parentId: string | null;
			index: string;
			type: string;
			description: string;
			quantity: number;
			totalCost: number;
			totalBudget: number;
			plannedStart: string | Date | null;
			plannedEnd: string | Date | null;
			actualStart: string | Date | null;
			actualEnd: string | Date | null;
			completionPercentage: number;
			computedStatus: string;
			sortOrder: number;
		}>;
		baselineSchedules: Array<{
			budgetItemId: string;
			plannedStart: string | Date | null;
			plannedEnd: string | Date | null;
		}>;
		scheduleRevisions: Array<{
			budgetItemId: string;
			replannedStart: string | Date | null;
			replannedEnd: string | Date | null;
			revisionDate: string | Date | null;
		}>;
		measurements: Array<{
			id: string;
			budgetItemId: string;
			measurementDate: string | Date | null;
			measuredPercentageAccumulated: number;
		}>;
		actualCosts: Array<{
			budgetItemId: string;
			costDate: string | Date | null;
			amount: number;
		}>;
		manualMeasurements: Array<{
			date: string | Date | null;
			items: Array<{ budgetItemId: string; accumulatedValue: number }>;
		}>;
	};

	const iso = (value: string) => new Date(value).toISOString();

	function storedInput(): StoredInput {
		return {
			plannedStart: iso("2026-01-01T00:00:00.000Z"),
			plannedEnd: iso("2026-12-31T00:00:00.000Z"),
			baseDate: iso("2026-01-31T00:00:00.000Z"),
			createdAt: iso("2026-01-01T00:00:00.000Z"),
			lastImportAt: iso("2026-01-02T00:00:00.000Z"),
			items: [
				{
					id: "item-1",
					parentId: null,
					index: "1.1",
					type: "ITEM",
					description: "Escavacao",
					quantity: 10,
					totalCost: 1000,
					totalBudget: 1000,
					plannedStart: iso("2026-01-05T00:00:00.000Z"),
					plannedEnd: iso("2026-03-05T00:00:00.000Z"),
					actualStart: iso("2026-01-10T00:00:00.000Z"),
					actualEnd: iso("2026-02-10T00:00:00.000Z"),
					completionPercentage: 100,
					computedStatus: "DONE",
					sortOrder: 1,
				},
			],
			baselineSchedules: [
				{
					budgetItemId: "item-1",
					plannedStart: iso("2026-01-05T00:00:00.000Z"),
					plannedEnd: iso("2026-03-05T00:00:00.000Z"),
				},
			],
			scheduleRevisions: [
				{
					budgetItemId: "item-1",
					replannedStart: iso("2026-02-01T00:00:00.000Z"),
					replannedEnd: iso("2026-04-01T00:00:00.000Z"),
					revisionDate: iso("2026-01-15T00:00:00.000Z"),
				},
			],
			measurements: [
				{
					id: "measurement-1",
					budgetItemId: "item-1",
					measurementDate: iso("2026-01-10T00:00:00.000Z"),
					measuredPercentageAccumulated: 100,
				},
			],
			actualCosts: [
				{
					budgetItemId: "item-1",
					costDate: iso("2026-01-13T00:00:00.000Z"),
					amount: 100,
				},
			],
			manualMeasurements: [
				{ date: iso("2026-01-20T00:00:00.000Z"), items: [] },
			],
		};
	}

	const hydrate = (input: StoredInput) =>
		hydrateSnapshotInputDates(
			input as unknown as Parameters<typeof hydrateSnapshotInputDates>[0],
		) as unknown as StoredInput;

	it("converts ISO date strings back to Date at all known snapshot input paths", () => {
		const hydrated = hydrate(storedInput());

		expect(hydrated.plannedStart).toBeInstanceOf(Date);
		expect(hydrated.plannedEnd).toBeInstanceOf(Date);
		expect(hydrated.baseDate).toBeInstanceOf(Date);
		expect(hydrated.createdAt).toBeInstanceOf(Date);
		expect(hydrated.lastImportAt).toBeInstanceOf(Date);
		expect(hydrated.items[0].plannedStart).toBeInstanceOf(Date);
		expect(hydrated.items[0].plannedEnd).toBeInstanceOf(Date);
		expect(hydrated.items[0].actualStart).toBeInstanceOf(Date);
		expect(hydrated.items[0].actualEnd).toBeInstanceOf(Date);
		expect(hydrated.baselineSchedules[0].plannedStart).toBeInstanceOf(Date);
		expect(hydrated.baselineSchedules[0].plannedEnd).toBeInstanceOf(Date);
		expect(hydrated.scheduleRevisions[0].replannedStart).toBeInstanceOf(Date);
		expect(hydrated.scheduleRevisions[0].replannedEnd).toBeInstanceOf(Date);
		expect(hydrated.scheduleRevisions[0].revisionDate).toBeInstanceOf(Date);
		expect(hydrated.measurements[0].measurementDate).toBeInstanceOf(Date);
		expect(hydrated.actualCosts[0].costDate).toBeInstanceOf(Date);
		expect(hydrated.manualMeasurements[0].date).toBeInstanceOf(Date);

		expect(hydrated.createdAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
		expect(hydrated.measurements[0].measurementDate).toEqual(
			new Date("2026-01-10T00:00:00.000Z"),
		);
	});

	it("keeps existing Date instances unchanged", () => {
		const input = storedInput();
		input.createdAt = new Date("2026-01-01T00:00:00.000Z");
		input.items[0].actualEnd = new Date("2026-02-10T00:00:00.000Z");

		const hydrated = hydrate(input);

		expect(hydrated.createdAt).toBe(input.createdAt);
		expect(hydrated.items[0].actualEnd).toBe(input.items[0].actualEnd);
		expect(hydrated.plannedStart).toBeInstanceOf(Date);
	});

	it("keeps null values as null", () => {
		const input = storedInput();
		input.plannedStart = null;
		input.plannedEnd = null;
		input.baseDate = null;
		input.lastImportAt = null;
		input.items[0].actualStart = null;
		input.scheduleRevisions[0].revisionDate = null;
		input.measurements[0].measurementDate = null;
		input.actualCosts[0].costDate = null;
		input.manualMeasurements[0].date = null;

		const hydrated = hydrate(input);

		expect(hydrated.plannedStart).toBeNull();
		expect(hydrated.plannedEnd).toBeNull();
		expect(hydrated.baseDate).toBeNull();
		expect(hydrated.lastImportAt).toBeNull();
		expect(hydrated.items[0].actualStart).toBeNull();
		expect(hydrated.scheduleRevisions[0].revisionDate).toBeNull();
		expect(hydrated.measurements[0].measurementDate).toBeNull();
		expect(hydrated.actualCosts[0].costDate).toBeNull();
		expect(hydrated.manualMeasurements[0].date).toBeNull();
		expect(hydrated.createdAt).toBeInstanceOf(Date);
	});

	it("keeps non-date strings as-is", () => {
		const input = storedInput();
		input.plannedStart = "not-a-date";
		input.items[0].actualStart = "tbd";

		const hydrated = hydrate(input);

		expect(hydrated.plannedStart).toBe("not-a-date");
		expect(hydrated.items[0].actualStart).toBe("tbd");
		expect(hydrated.baseDate).toBeInstanceOf(Date);
	});
});
