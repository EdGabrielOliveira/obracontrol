import { describe, expect, it } from "bun:test";
import { Elysia, t } from "elysia";
import { handleConstructionError } from "../../../src/lib/construction-error-handler";

describe("handleConstructionError", () => {
	it("returns Elysia validation issues without exposing submitted values", async () => {
		const app = new Elysia()
			.onError(handleConstructionError)
			.post("/works", () => null, {
				body: t.Object({ name: t.String() }),
			});

		const response = await app.handle(
			new Request("http://localhost/works", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: 123 }),
			}),
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			message: "Dados invalidos",
			errors: [
				expect.objectContaining({
					field: "/name",
					message: expect.any(String),
				}),
			],
		});
	});
});
