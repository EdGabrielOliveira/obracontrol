import { describe, expect, it } from "bun:test";
import { queryRetryDelay, shouldRetryQuery } from "@/lib/query-client";

describe("query retry policy", () => {
	it("does not retry deterministic HTTP failures", () => {
		expect(shouldRetryQuery(0, { response: { status: 400 } })).toBe(false);
		expect(shouldRetryQuery(0, { response: { status: 429 } })).toBe(false);
		expect(shouldRetryQuery(0, { response: { status: 500 } })).toBe(false);
		expect(shouldRetryQuery(0, new Error("invalid response"))).toBe(false);
	});

	it("retries transient gateway failures and network errors with a cap", () => {
		expect(shouldRetryQuery(0, { response: { status: 502 } })).toBe(true);
		expect(shouldRetryQuery(1, { response: { status: 504 } })).toBe(true);
		expect(shouldRetryQuery(0, new TypeError("network down"))).toBe(true);
		expect(shouldRetryQuery(2, new TypeError("network down"))).toBe(false);
		expect(queryRetryDelay(0)).toBe(250);
		expect(queryRetryDelay(4)).toBe(2_000);
	});
});
