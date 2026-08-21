import { describe, expect, test } from "bun:test";
import { buildScatterSeries } from "@/components/organisms/bi/portfolio-charts";

const work = (workId: string, spi: number | null, cpi: number | null) => ({
	workId,
	name: workId,
	schedulePerformanceIndex: spi,
	costPerformanceIndex: cpi,
	measuredPercentage: 50,
});

describe("buildScatterSeries", () => {
	test("ignores incomplete indexes and classifies every valid point once", () => {
		const result = buildScatterSeries([
			work("healthy", 1.1, 1),
			work("delayed", 0.9, 1),
			work("over-budget", 1, 0.9),
			work("critical", 0.9, 0.9),
			work("unknown", null, 1),
		]);

		expect(result.healthy.map((point) => point.workId)).toEqual(["healthy"]);
		expect(result.delayed.map((point) => point.workId)).toEqual(["delayed"]);
		expect(result.overBudget.map((point) => point.workId)).toEqual(["over-budget"]);
		expect(result.critical.map((point) => point.workId)).toEqual(["critical"]);
	});
});
