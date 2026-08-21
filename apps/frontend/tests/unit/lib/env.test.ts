import { describe, expect, it } from "bun:test";
import { normalizeServerUrl } from "../../../src/env";

describe("normalizeServerUrl", () => {
	it("preserves an API origin without a trailing slash", () => {
		expect(normalizeServerUrl("https://api.example.test")).toBe(
			"https://api.example.test",
		);
	});

	it("removes trailing slashes so endpoint paths are composed consistently", () => {
		expect(normalizeServerUrl("https://api.example.test///")).toBe(
			"https://api.example.test",
		);
	});

	it("keeps same-origin requests when the variable is absent", () => {
		expect(normalizeServerUrl(undefined)).toBe("");
	});
});
