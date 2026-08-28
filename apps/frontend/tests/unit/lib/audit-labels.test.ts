import { expect, test } from "bun:test";
import {
	auditDescription,
	auditUserName,
	formatAuditValue,
	isTechnicalAuditField,
} from "@/lib/audit-labels";

test("audit descriptions hide internal request identifiers", () => {
	expect(
		auditDescription(
			"CONTRACT_UPDATE:133f1b2b-1c59-4b3a-98c2-f717da8d721f",
		),
	).toBe("Atualização de contrato solicitada");
});

test("audit values use readable labels and omit technical fields", () => {
	expect(formatAuditValue("IN_PROGRESS", "status")).toBe("Em andamento");
	expect(isTechnicalAuditField("artifactId")).toBe(true);
	expect(isTechnicalAuditField("valid")).toBe(false);
	expect(
		formatAuditValue({ artifactId: "artifact-1", name: "Contrato" }),
	).toBe("Nome: Contrato");
});

test("audit user fallback does not expose the user identifier", () => {
	expect(auditUserName({ user: null })).toBe("Usuário não identificado");
});
