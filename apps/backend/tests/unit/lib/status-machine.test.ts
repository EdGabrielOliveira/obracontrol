import { describe, expect, it } from "bun:test";
import { ConstructionError } from "../../../src/lib/errors";
import {
	CONTRACT_TRANSITIONS,
	MEASUREMENT_TRANSITIONS,
	PAYMENT_TRANSITIONS,
	validateGovernanceTransition,
	validateStatusTransition,
	WORK_OPERATIONAL_TRANSITIONS,
} from "../../../src/lib/status-machine";
import { normalizeWorkOperationalStatus } from "../../../src/modules/construction-planning/works/work-operational-status";

describe("normalizeWorkOperationalStatus", () => {
	it("preserves legacy operational status values", () => {
		expect(normalizeWorkOperationalStatus("EM_EXECUCAO")).toBe("IN_PROGRESS");
		expect(normalizeWorkOperationalStatus("PLANEJADA")).toBe("NOT_STARTED");
	});
});

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

	it("allows a direct correction from RASCUNHO -> FINALIZADO", () => {
		validateStatusTransition(
			"Contrato",
			CONTRACT_TRANSITIONS,
			"RASCUNHO",
			"FINALIZADO",
		);
	});

	it("allows reopening FINALIZADO -> EM_ANDAMENTO", () => {
		validateStatusTransition(
			"Contrato",
			CONTRACT_TRANSITIONS,
			"FINALIZADO",
			"EM_ANDAMENTO",
		);
	});

	it("allows reverting EM_ANDAMENTO -> RASCUNHO", () => {
		validateStatusTransition(
			"Contrato",
			CONTRACT_TRANSITIONS,
			"EM_ANDAMENTO",
			"RASCUNHO",
		);
	});
});

describe("WORK_OPERATIONAL_TRANSITIONS", () => {
	it("starts a work in draft and promotes it to not started", () => {
		validateStatusTransition(
			"Obra",
			WORK_OPERATIONAL_TRANSITIONS,
			"DRAFT",
			"NOT_STARTED",
		);
	});

	it("allows direct correction between operational statuses", () => {
		expect(WORK_OPERATIONAL_TRANSITIONS.IN_PROGRESS).toContain("DRAFT");
		expect(WORK_OPERATIONAL_TRANSITIONS.DONE).toContain("NOT_STARTED");
	});
});

describe("MEASUREMENT_TRANSITIONS", () => {
	it("supports draft, accepted, rejected and archived lifecycle", () => {
		validateStatusTransition(
			"Medicao",
			MEASUREMENT_TRANSITIONS,
			"RASCUNHO",
			"ACEITO",
		);
		validateStatusTransition(
			"Medicao",
			MEASUREMENT_TRANSITIONS,
			"RASCUNHO",
			"RECUSADO",
		);
		validateStatusTransition(
			"Medicao",
			MEASUREMENT_TRANSITIONS,
			"RECUSADO",
			"RASCUNHO",
		);
		validateStatusTransition(
			"Medicao",
			MEASUREMENT_TRANSITIONS,
			"RECUSADO",
			"ARQUIVADO",
		);
		validateStatusTransition(
			"Medicao",
			MEASUREMENT_TRANSITIONS,
			"ACEITO",
			"RASCUNHO",
		);
		validateStatusTransition(
			"Medicao",
			MEASUREMENT_TRANSITIONS,
			"ACEITO",
			"RECUSADO",
		);
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
	it("allows elevated roles to jump directly between any governance statuses", () => {
		for (const role of ["ADMIN", "GERENTE", "GESTOR"] as const) {
			validateGovernanceTransition("RASCUNHO", "ACEITO", {
				role,
				reason: "Publicar medição importada",
			});
			validateGovernanceTransition("RASCUNHO", "TRAVADO", {
				role,
				reason: "Travar medição importada",
			});
			validateGovernanceTransition("TRAVADO", "RASCUNHO", {
				role,
				reason: "Corrigir medição",
			});
		}
	});

	it("requires a reason for every non-canonical elevated transition", () => {
		for (const role of ["ADMIN", "GERENTE", "GESTOR"] as const) {
			expect(() =>
				validateGovernanceTransition("RASCUNHO", "ACEITO", { role }),
			).toThrow("Motivo obrigatorio");
		}
	});

	it("keeps supervisors from using direct governance transitions", () => {
		expect(() =>
			validateGovernanceTransition("RASCUNHO", "ACEITO", {
				role: "SUPERVISOR",
				reason: "Tentativa de alteração",
			}),
		).toThrow("Supervisor nao tem permissao");
		expect(() =>
			validateGovernanceTransition("RASCUNHO", "EM_REVISAO", {
				role: "SUPERVISOR",
			}),
		).toThrow("Supervisor nao tem permissao");
	});

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

	it("allows elevated roles to reopen a locked record with a reason", () => {
		expect(() =>
			validateGovernanceTransition("TRAVADO", "EM_REVISAO", {
				role: "GERENTE",
				reason: "Revisão necessária",
			}),
		).not.toThrow();
		validateGovernanceTransition("TRAVADO", "EM_REVISAO", {
			role: "ADMIN",
			reason: "Correção emergencial",
		});
		validateGovernanceTransition("TRAVADO", "EM_REVISAO", {
			role: "GESTOR",
			reason: "Correção operacional",
		});
	});
});
