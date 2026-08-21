import { describe, expect, it } from "bun:test";
import { createCepClient } from "../../../src/lib/cep-client";

describe("cep client", () => {
	it("normalizes the CEP and maps BrasilAPI coordinates", async () => {
		const client = createCepClient({
			fetch: async (url) => {
				expect(url).toBe("https://example.test/01001000");
				return {
					ok: true,
					status: 200,
					json: async () => ({
						street: "Praca da Se",
						neighborhood: "Se",
						city: "Sao Paulo",
						state: "SP",
						location: { coordinates: { latitude: -23.55, longitude: -46.63 } },
					}),
				};
			},
			baseUrl: "https://example.test",
		});

		expect(await client.lookup("01001-000")).toEqual({
			zipCode: "01001000",
			street: "Praca da Se",
			district: "Se",
			city: "Sao Paulo",
			state: "SP",
			latitude: -23.55,
			longitude: -46.63,
		});
	});

	it("rejects malformed CEPs before making a request", async () => {
		const client = createCepClient({
			fetch: async () => {
				throw new Error("unexpected");
			},
		});
		await expect(client.lookup("123")).rejects.toMatchObject({
			code: "INVALID_CEP",
			status: 400,
		});
	});
});
