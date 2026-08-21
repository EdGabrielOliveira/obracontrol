import { describe, expect, it } from "bun:test";
import { isTenantApiRouteAllowed } from "../../../src/lib/tenant-api-allowlist";

describe("tenant API allowlist", () => {
	it("allows only GET operational routes", () => {
		expect(
			isTenantApiRouteAllowed(
				"GET",
				"/construction/works/work-1/contracts/contract-1/services",
			),
		).toBe(true);
		expect(
			isTenantApiRouteAllowed("GET", "/construction/works/work-1/budget"),
		).toBe(true);
		expect(isTenantApiRouteAllowed("GET", "/construction/bi/multiworks")).toBe(
			true,
		);
		expect(
			isTenantApiRouteAllowed(
				"GET",
				"/construction/works/work-1/measurement-coverages",
			),
		).toBe(true);
		expect(
			isTenantApiRouteAllowed("GET", "/construction/reports/work/work-1"),
		).toBe(true);
		expect(
			isTenantApiRouteAllowed(
				"GET",
				"/construction/reports/work/work-1/management/pdf",
			),
		).toBe(true);
	});

	it("rejects writes and sensitive route families", () => {
		expect(
			isTenantApiRouteAllowed("POST", "/construction/works/work-1/contracts"),
		).toBe(false);
		expect(
			isTenantApiRouteAllowed("GET", "/construction/imports/import-1"),
		).toBe(false);
		expect(
			isTenantApiRouteAllowed(
				"GET",
				"/construction/works/work-1/import-batches",
			),
		).toBe(false);
		expect(
			isTenantApiRouteAllowed(
				"GET",
				"/construction/works/work-1/schedule/import",
			),
		).toBe(false);
		expect(
			isTenantApiRouteAllowed("GET", "/construction/works/work-1/suppliers"),
		).toBe(false);
		expect(isTenantApiRouteAllowed("GET", "/organizations")).toBe(false);
		expect(
			isTenantApiRouteAllowed("GET", "/construction/reports/cost-center/cc-1"),
		).toBe(false);
		expect(isTenantApiRouteAllowed("GET", "/health")).toBe(false);
		expect(isTenantApiRouteAllowed("GET", "/openapi/json")).toBe(false);
		expect(isTenantApiRouteAllowed("GET", "/api/auth/get-session")).toBe(false);
	});
});
