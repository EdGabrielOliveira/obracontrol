import { describe, expect, it } from "bun:test";
import {
	AMENDMENT_APPROVAL_STATUS_MAP,
	APPROVAL_STATUS_MAP,
	BUDGET_VERSION_STATUS_MAP,
	CONTRACT_STATUS_MAP,
	GOVERNANCE_STATUS_MAP,
	IMPORT_BATCH_STATUS_MAP,
	IMPORT_PREVIEW_STATUS_MAP,
	PAYMENT_STATUS_MAP,
	SNAPSHOT_STATUS_MAP,
	SUPPLIER_STATUS_MAP,
	WORK_STATUS_MAP,
	WORK_SUPPLIER_STATUS_MAP,
	getFallbackStatusTone,
} from "@/components/atoms/status-badge";

describe("status badge semantics", () => {
	it("uses green for positive statuses", () => {
		expect(WORK_STATUS_MAP.DONE.tone).toBe("success");
		expect(CONTRACT_STATUS_MAP.FINALIZADO.tone).toBe("success");
		expect(PAYMENT_STATUS_MAP.PAGO.tone).toBe("success");
		expect(SUPPLIER_STATUS_MAP.APPROVED.tone).toBe("success");
		expect(WORK_SUPPLIER_STATUS_MAP.ACTIVE.tone).toBe("success");
		expect(BUDGET_VERSION_STATUS_MAP.ACTIVE.tone).toBe("success");
		expect(SNAPSHOT_STATUS_MAP.ACEITO.tone).toBe("success");
		expect(GOVERNANCE_STATUS_MAP.ACEITO.tone).toBe("success");
		expect(APPROVAL_STATUS_MAP.APPROVED.tone).toBe("success");
		expect(AMENDMENT_APPROVAL_STATUS_MAP.APPROVED.tone).toBe("success");
		expect(IMPORT_BATCH_STATUS_MAP.CONFIRMED.tone).toBe("success");
		expect(IMPORT_PREVIEW_STATUS_MAP.VALID.tone).toBe("success");
	});

	it("uses yellow for waiting and attention statuses", () => {
		expect(CONTRACT_STATUS_MAP.PENDENTE.tone).toBe("warning");
		expect(PAYMENT_STATUS_MAP.OPEN.tone).toBe("warning");
		expect(SUPPLIER_STATUS_MAP.PENDING_APPROVAL.tone).toBe("warning");
		expect(SNAPSHOT_STATUS_MAP.EM_REVISAO.tone).toBe("warning");
		expect(APPROVAL_STATUS_MAP.PENDING.tone).toBe("warning");
		expect(AMENDMENT_APPROVAL_STATUS_MAP.PENDING_GESTOR.tone).toBe(
			"warning",
		);
		expect(IMPORT_BATCH_STATUS_MAP.READY.tone).toBe("warning");
		expect(IMPORT_PREVIEW_STATUS_MAP.WARNING.tone).toBe("warning");
	});

	it("uses red for negative statuses", () => {
		expect(WORK_STATUS_MAP.SUSPENDED.tone).toBe("danger");
		expect(CONTRACT_STATUS_MAP.PARALISADO.tone).toBe("danger");
		expect(SUPPLIER_STATUS_MAP.BLOCKED.tone).toBe("danger");
		expect(WORK_SUPPLIER_STATUS_MAP.REVOKED.tone).toBe("danger");
		expect(BUDGET_VERSION_STATUS_MAP.REJECTED.tone).toBe("danger");
		expect(SNAPSHOT_STATUS_MAP.TRAVADO.tone).toBe("danger");
		expect(APPROVAL_STATUS_MAP.REJECTED.tone).toBe("danger");
		expect(IMPORT_BATCH_STATUS_MAP.FAILED.tone).toBe("danger");
		expect(IMPORT_PREVIEW_STATUS_MAP.INVALID.tone).toBe("danger");
	});

	it("falls back to neutral and recognizes generic error states", () => {
		expect(getFallbackStatusTone("RASCUNHO")).toBe("neutral");
		expect(getFallbackStatusTone("Em andamento")).toBe("info");
		expect(getFallbackStatusTone("unknown-status")).toBe("neutral");
		expect(getFallbackStatusTone("erro")).toBe("danger");
		expect(getFallbackStatusTone("excluído")).toBe("danger");
		expect(getFallbackStatusTone("FAILED")).toBe("danger");
		expect(getFallbackStatusTone(undefined)).toBe("neutral");
		expect(getFallbackStatusTone(null)).toBe("neutral");
	});
});
