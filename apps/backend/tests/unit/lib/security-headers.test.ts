import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import {
	buildSecurityHeaders,
	securityHeaders,
} from "../../../src/lib/security-headers";

describe("securityHeaders", () => {
	it("applies security headers to manual Response objects", async () => {
		const app = new Elysia().use(securityHeaders).get(
			"/",
			() =>
				new Response("ok", {
					status: 201,
					headers: { "x-custom": "keep" },
				}),
		);

		const response = await app.handle(new Request("http://localhost/"));

		expect(response.status).toBe(201);
		expect(await response.text()).toBe("ok");
		expect(response.headers.get("x-custom")).toBe("keep");
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(response.headers.get("x-frame-options")).toBe("DENY");
		expect(response.headers.get("referrer-policy")).toBe(
			"strict-origin-when-cross-origin",
		);
		expect(response.headers.get("content-security-policy")).toContain(
			"default-src 'self'",
		);
	});

	it("applies security headers to plain object responses", async () => {
		const app = new Elysia()
			.use(securityHeaders)
			.get("/", () => ({ ok: true }));

		const response = await app.handle(new Request("http://localhost/"));

		expect(response.status).toBe(200);
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(response.headers.get("x-frame-options")).toBe("DENY");
	});

	it("emits production transport and CSP directives", () => {
		const headers = buildSecurityHeaders({ isProduction: true });
		const csp = headers["content-security-policy"];

		expect(headers["strict-transport-security"]).toBe(
			"max-age=63072000; includeSubDomains; preload",
		);
		expect(csp).toContain("frame-ancestors 'none'");
		expect(csp).toContain("object-src 'none'");
		expect(csp).toContain("base-uri 'self'");
		expect(csp).toContain("form-action 'self'");
	});

	it("does not emit HSTS outside production", () => {
		const headers = buildSecurityHeaders({ isProduction: false });

		expect(headers["strict-transport-security"]).toBeUndefined();
	});

	it("does not emit HSTS for an HTTP production request", () => {
		const headers = buildSecurityHeaders({
			isProduction: true,
			isSecure: false,
		});

		expect(headers["strict-transport-security"]).toBeUndefined();
	});
});
