import { describe, expect, it } from "bun:test";

describe("reset-db guard", () => {
	it("rejeita reset sem RESET_CONFIRM=yes", async () => {
		const { assertResetConfirmed } = await import("../../../scripts/reset-db");
		expect(() => assertResetConfirmed(undefined)).toThrow("Reset abortado");
		expect(() => assertResetConfirmed("no")).toThrow("Reset abortado");
		expect(() => assertResetConfirmed("yes")).not.toThrow();
	});
});
