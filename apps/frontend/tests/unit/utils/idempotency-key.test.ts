import { describe, expect, it } from "bun:test";
import { createIdempotencyKey } from "@/utils/idempotency-key";

describe("createIdempotencyKey", () => {
	it("returns a non-empty key", () => {
		expect(createIdempotencyKey("work")).toMatch(/^work-.+/);
	});

	it("falls back when the browser has no Web Crypto API", () => {
		const originalCrypto = globalThis.crypto;
		Object.defineProperty(globalThis, "crypto", {
			configurable: true,
			value: undefined,
		});

		try {
			expect(createIdempotencyKey("work")).toMatch(/^work-.+/);
		} finally {
			Object.defineProperty(globalThis, "crypto", {
				configurable: true,
				value: originalCrypto,
			});
		}
	});
});
