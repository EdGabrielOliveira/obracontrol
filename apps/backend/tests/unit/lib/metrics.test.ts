import { describe, expect, it } from "bun:test";
import { metrics } from "../../../src/lib/metrics";

describe("metrics", () => {
	it("increments a counter by 1 by default", () => {
		metrics.reset();
		metrics.increment("import.count");
		metrics.increment("import.count");
		expect(metrics.snapshot().counters["import.count"]).toBe(2);
	});

	it("increments a counter by the given amount", () => {
		metrics.reset();
		metrics.increment("import.rejected", 5);
		expect(metrics.snapshot().counters["import.rejected"]).toBe(5);
	});

	it("records timings with count, sum, min, max, last and avg", () => {
		metrics.reset();
		metrics.timing("import.duration_ms", 10);
		metrics.timing("import.duration_ms", 30);
		metrics.timing("import.duration_ms", 20);
		const timing = metrics.snapshot().timings["import.duration_ms"];
		expect(timing).toEqual({
			count: 3,
			sum: 60,
			min: 10,
			max: 30,
			last: 20,
			avg: 20,
		});
	});

	it("snapshot returns a plain object copy, immune to external mutation", () => {
		metrics.reset();
		metrics.increment("auth.denied");
		metrics.timing("bi.calc.duration_ms", 15);
		const snapshot = metrics.snapshot();
		snapshot.counters["auth.denied"] = 999;
		snapshot.timings["bi.calc.duration_ms"].count = 999;
		const fresh = metrics.snapshot();
		expect(fresh.counters["auth.denied"]).toBe(1);
		expect(fresh.timings["bi.calc.duration_ms"].count).toBe(1);
	});

	it("reset clears counters and timings", () => {
		metrics.reset();
		metrics.increment("auth.denied");
		metrics.timing("reconcile.duration_ms", 5);
		metrics.reset();
		expect(metrics.snapshot()).toEqual({ counters: {}, timings: {} });
	});
});
