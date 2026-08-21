import { describe, expect, it } from "bun:test";
import { buildDataQualityIssues } from "../../../../../src/modules/construction-planning/bi/metrics-quality";

function metrics(overrides: Record<string, unknown> = {}) {
	return {
		plannedValue: 100,
		actualCost: 50,
		dataCompleteness: {
			hasBaselineSchedule: true,
			hasMeasurements: true,
			hasActualCosts: true,
			hasFutureCosts: false,
			hasUnappropriatedActualCosts: false,
			hasUnappropriatedFutureCosts: false,
		},
		indicators: {} as never,
		...overrides,
	} as never;
}

describe("buildDataQualityIssues", () => {
	it("returns no issues for complete data", () => {
		expect(buildDataQualityIssues(metrics(), "work-1")).toEqual([]);
	});

	it("reports missing sources with the affected metric", () => {
		const issues = buildDataQualityIssues(
			metrics({
				dataCompleteness: {
					hasBaselineSchedule: false,
					hasMeasurements: false,
					hasActualCosts: false,
					hasFutureCosts: false,
					hasUnappropriatedActualCosts: false,
					hasUnappropriatedFutureCosts: false,
				},
			}),
			"work-1",
		);

		expect(issues.map((item) => item.code)).toEqual([
			"MISSING_BASELINE_SCHEDULE",
			"MISSING_MEASUREMENTS",
			"MISSING_ACTUAL_COSTS",
		]);
		expect(issues.every((item) => item.workId === "work-1")).toBe(true);
	});

	it("keeps unappropriated and zero-denominator problems explicit", () => {
		const issues = buildDataQualityIssues(
			metrics({
				plannedValue: 0,
				actualCost: -10,
				dataCompleteness: {
					hasBaselineSchedule: true,
					hasMeasurements: true,
					hasActualCosts: true,
					hasFutureCosts: true,
					hasUnappropriatedActualCosts: true,
					hasUnappropriatedFutureCosts: true,
				},
			}),
		);

		expect(issues.map((item) => item.code)).toEqual([
			"UNAPPROPRIATED_ACTUAL_COSTS",
			"UNAPPROPRIATED_FUTURE_COSTS",
			"ZERO_PLANNED_VALUE_DENOMINATOR",
			"ZERO_ACTUAL_COST_DENOMINATOR",
		]);
		expect(issues[2]).toMatchObject({ severity: "HIGH", metric: "SPI" });
		expect(issues[3]).toMatchObject({ severity: "HIGH", metric: "CPI" });
	});
});
