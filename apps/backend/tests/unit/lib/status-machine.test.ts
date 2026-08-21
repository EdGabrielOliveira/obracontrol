import { describe, expect, it } from "bun:test";
import { ConstructionError } from "../../../src/lib/errors";
import {
	CONTRACT_TRANSITIONS,
	PAYMENT_TRANSITIONS,
	validateGovernanceTransition,
	validateStatusTransition,
} from "../../../src/lib/status-machine";

describe("CONTRACT_TRANSITIONS", () => {
	it("allows RASCUNHO -> A_INICIAR", () => {
		validateStatusTransition(
			"Contrato",
			CONTRACT_TRANSITIONS,
			"RASCUNHO",
			"A_INICIAR",
		);
	});

	it("allows A_INICIAR -> EM_ANDAMENTO", () => {
		validateStatusTransition(
			"Contrato",
			CONTRACT_TRANSITIONS,
			"A_INICIAR",
			"EM_ANDAMENTO",
		);
	});

	it("allows A_INICIAR -> PARALISADO", () => {
		validateStatusTransition(
			"Contrato",
			CONTRACT_TRANSITIONS,
			"A_INICIAR",
			"PARALISADO",
		);
	});

	it("allows EM_ANDAMENTO -> PARALISADO", () => {
		validateStatusTransition(
			"Contrato",
			CONTRACT_TRANSITIONS,
			"EM_ANDAMENTO",
			"PARALISADO",
		);
	});

	it("allows EM_ANDAMENTO -> FINALIZADO", () => {
		validateStatusTransition(
			"Contrato",
			CONTRACT_TRANSITIONS,
			"EM_ANDAMENTO",
			"FINALIZADO",
		);
	});

	it("allows PARALISADO -> EM_ANDAMENTO", () => {
		validateStatusTransition(
			"Contrato",
			CONTRACT_TRANSITIONS,
			"PARALISADO",
			"EM_ANDAMENTO",
		);
	});

	it("rejects RASCUNHO -> FINALIZADO", () => {
		expect(() =>
			validateStatusTransition(
				"Contrato",
				CONTRACT_TRANSITIONS,
				"RASCUNHO",
				"FINALIZADO",
			),
		).toThrow(ConstructionError);
	});

	it("rejects FINALIZADO -> EM_ANDAMENTO", () => {
		expect(() =>
			validateStatusTransition(
				"Contrato",
				CONTRACT_TRANSITIONS,
				"FINALIZADO",
				"EM_ANDAMENTO",
			),
		).toThrow(ConstructionError);
	});

	it("rejects EM_ANDAMENTO -> RASCUNHO", () => {
		expect(() =>
			validateStatusTransition(
				"Contrato",
				CONTRACT_TRANSITIONS,
				"EM_ANDAMENTO",
				"RASCUNHO",
			),
		).toThrow(ConstructionError);
	});
});

describe("PAYMENT_TRANSITIONS", () => {
	it("allows EM_ABERTO -> PAGO", () => {
		validateStatusTransition(
			"Pagamento",
			PAYMENT_TRANSITIONS,
			"EM_ABERTO",
			"PAGO",
		);
	});

	it("rejects PAGO -> EM_ABERTO", () => {
		expect(() =>
			validateStatusTransition(
				"Pagamento",
				PAYMENT_TRANSITIONS,
				"PAGO",
				"EM_ABERTO",
			),
		).toThrow(ConstructionError);
	});

	it("rejects PAGO -> PAGO (no-op)", () => {
		validateStatusTransition("Pagamento", PAYMENT_TRANSITIONS, "PAGO", "PAGO");
	});
});

describe("GOVERNANCE_TRANSITIONS", () => {
	it("allows the canonical draft to locked flow", () => {
		validateGovernanceTransition("RASCUNHO", "EM_REVISAO", {
			role: "GERENTE",
		});
		validateGovernanceTransition("EM_REVISAO", "ACEITO", {
			role: "GERENTE",
		});
		validateGovernanceTransition("ACEITO", "TRAVADO", {
			role: "GERENTE",
		});
	});

	it("requires a reason to reopen an accepted record", () => {
		expect(() =>
			validateGovernanceTransition("ACEITO", "EM_REVISAO", {
				role: "GERENTE",
			}),
		).toThrow("Motivo obrigatorio");
		validateGovernanceTransition("ACEITO", "EM_REVISAO", {
			role: "GERENTE",
			reason: "Corrigir medição aprovada",
		});
	});

	it("requires ADMIN to reopen a locked record", () => {
		expect(() =>
			validateGovernanceTransition("TRAVADO", "EM_REVISAO", {
				role: "GERENTE",
				reason: "Revisão necessária",
			}),
		).toThrow("override administrativo");
		validateGovernanceTransition("TRAVADO", "EM_REVISAO", {
			role: "ADMIN",
			reason: "Correção emergencial",
			override: true,
		});
	});

	it("rejects invalid transitions", () => {
		expect(() =>
			validateGovernanceTransition("TRAVADO", "ACEITO", {
				role: "ADMIN",
			}),
		).toThrow("Transicao de governanca invalida");
	});
});
