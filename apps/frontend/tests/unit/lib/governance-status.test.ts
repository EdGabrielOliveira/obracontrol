import { describe, expect, it } from "bun:test";
import {
	canManageGovernanceStatus,
	getGovernanceStatusOptions,
	governanceTransitionRequiresReason,
} from "@/lib/governance-status";
import { toGovernanceApiStatus } from "@/api/governance";

describe("governance status policy", () => {
	it("gives all elevated roles every status option except the current one", () => {
		for (const role of ["ADMIN", "GERENTE", "GESTOR"] as const) {
			expect(getGovernanceStatusOptions("RASCUNHO", role)).toEqual([
				"EM_REVISAO",
				"ACEITO",
				"TRAVADO",
			]);
			expect(getGovernanceStatusOptions("TRAVADO", role)).toEqual([
				"RASCUNHO",
				"EM_REVISAO",
				"ACEITO",
			]);
		}
	});

	it("does not grant status management to supervisor or missing roles", () => {
		expect(canManageGovernanceStatus("SUPERVISOR")).toBe(false);
		expect(canManageGovernanceStatus(null)).toBe(false);
		expect(getGovernanceStatusOptions("RASCUNHO", "SUPERVISOR")).toEqual([
			"EM_REVISAO",
		]);
	});

	it("requires a reason for direct transitions and reopens", () => {
		expect(governanceTransitionRequiresReason("RASCUNHO", "ACEITO")).toBe(true);
		expect(governanceTransitionRequiresReason("TRAVADO", "RASCUNHO")).toBe(true);
		expect(governanceTransitionRequiresReason("RASCUNHO", "EM_REVISAO")).toBe(false);
	});

	it("uses ACCEPT as the wire value for the accepted status", () => {
		expect(toGovernanceApiStatus("ACEITO")).toBe("ACCEPT");
		expect(toGovernanceApiStatus("TRAVADO")).toBe("TRAVADO");
	});
});
