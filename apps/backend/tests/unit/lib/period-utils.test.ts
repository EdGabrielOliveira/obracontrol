import { describe, expect, it } from "bun:test";
import {
	fillPeriodGaps,
	nextPeriodKey,
	periodKeyOf,
} from "../../../src/lib/period-utils";

describe("period-utils", () => {
	describe("periodKeyOf", () => {
		it("formats daily keys with the exact UTC date", () => {
			expect(periodKeyOf(new Date("2026-07-09T12:00:00Z"), "daily")).toBe(
				"2026-07-09",
			);
		});
		it("formats monthly keys", () => {
			expect(periodKeyOf(new Date("2026-01-15T00:00:00Z"), "monthly")).toBe(
				"2026-01",
			);
			expect(periodKeyOf(new Date("2026-12-31T00:00:00Z"), "monthly")).toBe(
				"2026-12",
			);
		});

		it("splits biweekly keys at day 15", () => {
			expect(periodKeyOf(new Date("2026-07-01T00:00:00Z"), "biweekly")).toBe(
				"2026-07-1",
			);
			expect(periodKeyOf(new Date("2026-07-15T00:00:00Z"), "biweekly")).toBe(
				"2026-07-1",
			);
			expect(periodKeyOf(new Date("2026-07-16T00:00:00Z"), "biweekly")).toBe(
				"2026-07-2",
			);
			expect(periodKeyOf(new Date("2026-07-31T00:00:00Z"), "biweekly")).toBe(
				"2026-07-2",
			);
		});

		it("buckets weekly keys by week of the month", () => {
			expect(periodKeyOf(new Date("2026-07-01T00:00:00Z"), "weekly")).toBe(
				"2026-07-1",
			);
			expect(periodKeyOf(new Date("2026-07-07T00:00:00Z"), "weekly")).toBe(
				"2026-07-1",
			);
			expect(periodKeyOf(new Date("2026-07-08T00:00:00Z"), "weekly")).toBe(
				"2026-07-2",
			);
			expect(periodKeyOf(new Date("2026-07-21T00:00:00Z"), "weekly")).toBe(
				"2026-07-3",
			);
			expect(periodKeyOf(new Date("2026-07-28T00:00:00Z"), "weekly")).toBe(
				"2026-07-4",
			);
			expect(periodKeyOf(new Date("2026-07-29T00:00:00Z"), "weekly")).toBe(
				"2026-07-5",
			);
			expect(periodKeyOf(new Date("2026-07-31T00:00:00Z"), "weekly")).toBe(
				"2026-07-5",
			);
		});
	});

	describe("nextPeriodKey", () => {
		it("advances daily keys by one day", () => {
			expect(nextPeriodKey("2026-07-31", "daily")).toBe("2026-08-01");
		});
		it("advances monthly keys", () => {
			expect(nextPeriodKey("2026-01", "monthly")).toBe("2026-02");
			expect(nextPeriodKey("2026-12", "monthly")).toBe("2027-01");
		});

		it("advances biweekly keys inside and across months", () => {
			expect(nextPeriodKey("2026-07-1", "biweekly")).toBe("2026-07-2");
			expect(nextPeriodKey("2026-07-2", "biweekly")).toBe("2026-08-1");
			expect(nextPeriodKey("2026-12-2", "biweekly")).toBe("2027-01-1");
		});

		it("advances weekly keys inside and across months", () => {
			expect(nextPeriodKey("2026-07-1", "weekly")).toBe("2026-07-2");
			expect(nextPeriodKey("2026-07-4", "weekly")).toBe("2026-07-5");
			expect(nextPeriodKey("2026-07-5", "weekly")).toBe("2026-08-1");
			expect(nextPeriodKey("2026-12-5", "weekly")).toBe("2027-01-1");
		});
	});

	describe("fillPeriodGaps", () => {
		it("fills weekly gaps", () => {
			expect(fillPeriodGaps(["2026-07-1", "2026-07-4"], "weekly")).toEqual([
				"2026-07-1",
				"2026-07-2",
				"2026-07-3",
				"2026-07-4",
			]);
		});

		it("fills biweekly gaps across months", () => {
			expect(fillPeriodGaps(["2026-07-2", "2026-08-2"], "biweekly")).toEqual([
				"2026-07-2",
				"2026-08-1",
				"2026-08-2",
			]);
		});

		it("fills weekly gaps across months", () => {
			expect(fillPeriodGaps(["2026-07-5", "2026-08-2"], "weekly")).toEqual([
				"2026-07-5",
				"2026-08-1",
				"2026-08-2",
			]);
		});

		it("keeps monthly behavior unchanged", () => {
			expect(fillPeriodGaps(["2026-01", "2026-04"], "monthly")).toEqual([
				"2026-01",
				"2026-02",
				"2026-03",
				"2026-04",
			]);
		});
	});
});
