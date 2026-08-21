import { describe, expect, it } from "bun:test";
import { hashPassword, verifyPassword } from "../../../src/lib/password-hasher";

describe("password-hasher", () => {
	it("creates a bcrypt hash that verifies only the original password", async () => {
		const hash = await hashPassword("Senha@2026");

		expect(hash).toStartWith("$2");
		expect(await verifyPassword(hash, "Senha@2026")).toBe(true);
		expect(await verifyPassword(hash, "Senha@2027")).toBe(false);
	});
});
