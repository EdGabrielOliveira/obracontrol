import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import {
	buildContractsForWork,
	contractValue,
} from "../../../../prisma/fixtures/contracts";
import {
	API_KEYS,
	COST_CENTERS,
	ORGANIZATIONS,
	SEED_USERS,
	WORK_ALLOCATIONS,
} from "../../../../prisma/fixtures/portfolio";
import {
	dt,
	hashDemoApiKey,
	money,
	pct,
} from "../../../../prisma/fixtures/types";
import { OBRAS } from "../../../../prisma/fixtures/works";

describe("realistic seed fixtures", () => {
	it("rounds deterministic calculation helpers", () => {
		expect(money(10.123456)).toBe(10.1235);
		expect(pct(33.3333)).toBe(33.33);
		expect(dt("07-15").toISOString()).toBe("2026-07-15T00:00:00.000Z");
	});

	it("hashes demo API keys with the API-key service convention", () => {
		const fullKey = "obi_demo_portfolio_key_000000000001";
		expect(hashDemoApiKey(fullKey)).toBe(
			createHash("sha256").update(fullKey).digest("hex"),
		);
	});

	it("defines a single admin user with realistic organizational layers", () => {
		expect(SEED_USERS.length).toBe(1);
		expect(SEED_USERS[0].email).toBe("admin@admin.com");
		expect(ORGANIZATIONS).toHaveLength(3);
		expect(COST_CENTERS).toHaveLength(6);
	});

	it("allocates every work to a known cost center", () => {
		const knownCostCenters = new Set(COST_CENTERS.map((cc) => cc.key));
		expect(OBRAS.length).toBe(36);

		for (const work of OBRAS) {
			expect(knownCostCenters.has(WORK_ALLOCATIONS[work.code])).toBe(true);
			expect(work.items.length).toBeGreaterThan(20);
			expect(work.baselines.length).toBeGreaterThan(10);
			expect(work.meds.length).toBeGreaterThan(0);
			expect(work.costs.length).toBeGreaterThan(0);
			expect(work.workMeasurements?.length ?? 0).toBeGreaterThan(0);
		}
	});

	it("defines realistic contract data for every work", () => {
		let totalContracts = 0;

		for (const work of OBRAS) {
			const contracts = buildContractsForWork(work.code);
			expect(contracts.length).toBeGreaterThan(0);

			for (const contract of contracts) {
				expect(contractValue(contract)).toBeGreaterThan(0);
				expect(contract.services.length).toBeGreaterThan(1);
				expect(contract.measurements.length).toBeGreaterThan(0);
				expect(contract.payments.length).toBeGreaterThan(0);
				expect(contract.folders.length).toBeGreaterThan(0);
			}

			totalContracts += contracts.length;
		}

		expect(totalContracts).toBeGreaterThanOrEqual(36);
	});

	it("defines API key rows without storing real secrets", () => {
		expect(API_KEYS).toHaveLength(2);
		for (const apiKey of API_KEYS) {
			expect(apiKey.fullKey.startsWith("obi_demo_")).toBe(true);
			expect(apiKey.id).toBe(apiKey.fullKey.slice(0, 11));
		}
	});
});
