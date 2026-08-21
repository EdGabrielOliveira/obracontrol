import { describe, expect, it } from "bun:test";
import { normalizeScheduleRevisions } from "../../../../../../src/modules/construction-planning/imports/validators/replanning.validator";

describe("replanning import validation", () => {
	it("rejects a revision for an item that is not overdue", () => {
		const errors: never[] = [];
		normalizeScheduleRevisions(
			{
				replanningRows: [
					{
						rowNumber: 2,
						index: "1",
						version: "R1",
						replannedStart: "2099-01-10",
						replannedEnd: "2099-02-20",
						revisionDate: "2099-01-05",
						reason: "Ajuste",
					},
				],
				baselineRows: [
					{
						rowNumber: 2,
						index: "1",
						plannedStart: "2099-01-01",
						plannedEnd: "2099-12-31",
						plannedWeight: 1,
					},
				],
			} as never,
			errors,
			new Set(["1"]),
		);

		expect(errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "SCHEDULE_ITEM_NOT_DELAYED",
					row: 2,
				}),
			]),
		);
	});
});
