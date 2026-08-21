import { describe, expect, it } from "bun:test";
import { isScheduleItemDelayed } from "../../../../../src/modules/construction-planning/schedule/schedule-service";

describe("schedule delay eligibility", () => {
	it("accepts an incomplete item whose planned end is before the reference date", () => {
		expect(
			isScheduleItemDelayed(
				{
					plannedEnd: new Date("2026-08-01"),
					completionPercentage: 75,
				},
				new Date("2026-08-06"),
			),
		).toBe(true);
	});

	it("rejects future and completed items", () => {
		expect(
			isScheduleItemDelayed(
				{
					plannedEnd: new Date("2026-08-07"),
					completionPercentage: 75,
				},
				new Date("2026-08-06"),
			),
		).toBe(false);
		expect(
			isScheduleItemDelayed(
				{
					plannedEnd: new Date("2026-08-01"),
					completionPercentage: 100,
				},
				new Date("2026-08-06"),
			),
		).toBe(false);
	});
});
