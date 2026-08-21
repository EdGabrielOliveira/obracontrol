import { describe, expect, it } from "bun:test";
import { MemoryRateLimitStore } from "../../../src/lib/rate-limit-store";

describe("MemoryRateLimitStore", () => {
	it("allows requests within the limit and blocks beyond it", async () => {
		const store = new MemoryRateLimitStore();
		const options = { windowMs: 60_000, max: 2 };

		const first = await store.check("k", "client-1", options);
		const second = await store.check("k", "client-1", options);
		const third = await store.check("k", "client-1", options);

		expect(first.allowed).toBe(true);
		expect(first.remaining).toBe(1);
		expect(second.allowed).toBe(true);
		expect(second.remaining).toBe(0);
		expect(third.allowed).toBe(false);
		expect(third.retryAfter).toBeGreaterThan(0);
	});

	it("isolates buckets by key and client", async () => {
		const store = new MemoryRateLimitStore();
		const options = { windowMs: 60_000, max: 1 };

		const a1 = await store.check("key-a", "client-1", options);
		const b1 = await store.check("key-b", "client-1", options);
		const a2 = await store.check("key-a", "client-2", options);

		expect(a1.allowed).toBe(true);
		expect(b1.allowed).toBe(true);
		expect(a2.allowed).toBe(true);
	});

	it("is race-safe under concurrent checks", async () => {
		const store = new MemoryRateLimitStore();
		const options = { windowMs: 60_000, max: 1 };

		const results = await Promise.all([
			store.check("race", "client-1", options),
			store.check("race", "client-1", options),
			store.check("race", "client-1", options),
		]);

		const allowed = results.filter((r) => r.allowed);
		expect(allowed).toHaveLength(1);
	});

	it("prunes expired timestamps within the window", async () => {
		const store = new MemoryRateLimitStore();
		const options = { windowMs: 60_000, max: 1 };

		const before = Date.now;
		let now = Date.now();
		Date.now = () => now;

		try {
			await store.check("expire", "client-1", options);
			now += 61_000;
			const result = await store.check("expire", "client-1", options);
			expect(result.allowed).toBe(true);
		} finally {
			Date.now = before;
		}
	});
});
