import { describe, expect, it } from "bun:test";
import { requestPath } from "../../../src/lib/request-path";

describe("requestPath", () => {
	it("accepts relative adapter URLs without throwing", () => {
		expect(requestPath({ url: "/" } as Request)).toBe("/");
		expect(requestPath({ url: "/openapi/json" } as Request)).toBe(
			"/openapi/json",
		);
	});
});
