import { describe, expect, it } from "bun:test";
import { buildScheduleFromDbItems } from "../../../../src/modules/construction-planning/schedule/schedule-builder";

const work = {
	code: "OBRA-001",
	name: "Obra",
	plannedStart: null,
	plannedEnd: null,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	lastImportAt: null,
};

function item(id: string) {
	return {
		id,
		parentId: null,
		index: "1.1",
		type: "ITEM",
		description: "Serviço",
		quantity: 10,
		totalCost: 100,
		plannedStart: new Date("2026-01-01T00:00:00.000Z"),
		plannedEnd: new Date("2026-03-01T00:00:00.000Z"),
		actualStart: null,
		actualEnd: null,
		completionPercentage: 0,
		computedStatus: "NOT_STARTED",
		sortOrder: 1,
	};
}

describe("schedule measurements", () => {
	it("derives actual start and end from progress measurements", () => {
		const result = buildScheduleFromDbItems(
			{
				...work,
				id: "work-actual-dates",
				baseDate: new Date("2026-02-10T00:00:00.000Z"),
			},
			{
				items: [item("item-actual-dates")],
				measurements: [
					{
						budgetItemId: "item-actual-dates",
						measurementDate: new Date("2026-01-10T00:00:00.000Z"),
						measuredPercentageAccumulated: 0.25,
					},
					{
						budgetItemId: "item-actual-dates",
						measurementDate: new Date("2026-02-05T00:00:00.000Z"),
						measuredPercentageAccumulated: 1,
					},
				],
			},
		);

		expect(result.items[0]?.actualStart).toBe("2026-01-10T00:00:00.000Z");
		expect(result.items[0]?.actualEnd).toBe("2026-02-05T00:00:00.000Z");
		expect(result.gantt[0]?.actualStart).toBe("2026-01-10T00:00:00.000Z");
		expect(result.gantt[0]?.actualEnd).toBe("2026-02-05T00:00:00.000Z");
	});

	it("uses the latest completion measurement as actual end", () => {
		const firstCompleted = new Date("2026-02-10T00:00:00.000Z");
		const laterCompleted = new Date("2026-02-20T00:00:00.000Z");
		const response = buildScheduleFromDbItems(
			{
				...work,
				id: "work-latest-completion",
				baseDate: laterCompleted,
			},
			{
				items: [item("item-1")],
				measurements: [
					{
						budgetItemId: "item-1",
						measurementDate: laterCompleted,
						measuredPercentageAccumulated: 100,
					},
					{
						budgetItemId: "item-1",
						measurementDate: firstCompleted,
						measuredPercentageAccumulated: 100,
					},
				],
			},
		);

		expect(response.items[0]?.actualEnd).toBe(laterCompleted.toISOString());
		expect(response.gantt[0]?.actualEnd).toBe(laterCompleted.toISOString());
	});

	it("uses monetary progress when the percentage is stale", () => {
		const result = buildScheduleFromDbItems(
			{
				...work,
				id: "work-canonical-progress",
				baseDate: new Date("2026-02-10T00:00:00.000Z"),
			},
			{
				items: [item("item-canonical-progress")],
				measurements: [
					{
						budgetItemId: "item-canonical-progress",
						measurementDate: new Date("2026-01-10T00:00:00.000Z"),
						measuredPercentageAccumulated: 0,
						measuredValueAccumulated: 100,
					},
				],
			},
		);

		expect(result.items[0]?.actualStart).toBe("2026-01-10T00:00:00.000Z");
		expect(result.items[0]?.actualEnd).toBe("2026-01-10T00:00:00.000Z");
	});

	it("ignores measurements after the schedule data date", () => {
		const result = buildScheduleFromDbItems(
			{
				...work,
				id: "work-as-of",
				baseDate: new Date("2026-01-05T00:00:00.000Z"),
			},
			{
				items: [item("item-as-of")],
				measurements: [
					{
						budgetItemId: "item-as-of",
						measurementDate: new Date("2026-01-10T00:00:00.000Z"),
						measuredPercentageAccumulated: 1,
					},
				],
			},
		);

		expect(result.items[0]?.actualStart).toBeNull();
		expect(result.items[0]?.actualEnd).toBeNull();
	});

	it("counts index-only revisions once per budget item", () => {
		const result = buildScheduleFromDbItems(
			{
				...work,
				id: "work-revisions",
				baseDate: new Date("2026-02-10T00:00:00.000Z"),
			},
			{
				items: [item("item-revisions")],
				scheduleRevisions: [
					{
						budgetItemId: null,
						index: "1.1",
						replannedStart: new Date("2026-01-02T00:00:00.000Z"),
						replannedEnd: null,
						revisionDate: new Date("2026-01-03T00:00:00.000Z"),
					},
					{
						budgetItemId: null,
						index: "1.1",
						replannedStart: null,
						replannedEnd: new Date("2026-03-02T00:00:00.000Z"),
						revisionDate: new Date("2026-02-03T00:00:00.000Z"),
					},
				],
			},
		);

		expect(result.replanning.totalRevisedItems).toBe(1);
	});
});
