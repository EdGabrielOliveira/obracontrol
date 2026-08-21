import { describe, expect, it } from "bun:test";
import {
	assertContractRequestTransition,
	normalizeContractRequestPhase,
} from "../../../../src/modules/construction-planning/contract-request-state";

describe("contract request state machine (CON-03)", () => {
	it("maps legacy statuses without losing their meaning", () => {
		expect(normalizeContractRequestPhase("EM_ESPERA")).toBe(
			"AGUARDANDO_APROVACAO_FINAL",
		);
		expect(normalizeContractRequestPhase("ACEITA")).toBe("CONTRATADA");
	});

	it("accepts the final approval path", () => {
		expect(() =>
			assertContractRequestTransition(
				"AGUARDANDO_APROVACAO_FINAL",
				"CONTRATADA",
			),
		).not.toThrow();
	});

	it("rejects transitions out of a terminal phase", () => {
		expect(() =>
			assertContractRequestTransition("CONTRATADA", "EM_NEGOCIACAO"),
		).toThrow("Transição inválida");
	});
});
