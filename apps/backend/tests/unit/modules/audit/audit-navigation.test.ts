import { describe, expect, it } from "bun:test";
import { resolveAuditNavigationTarget } from "../../../../src/modules/audit/audit-navigation";

describe("resolveAuditNavigationTarget", () => {
	it("resolve recursos globais conhecidos", () => {
		expect(
			resolveAuditNavigationTarget({
				entityType: "WORK",
				entityId: "work-1",
			}),
		).toEqual({ path: "/app/obras/work-1", label: "Abrir obra" });
		expect(
			resolveAuditNavigationTarget({
				entityType: "ORGANIZATION",
				entityId: "org-1",
			}),
		).toEqual({
			path: "/app/organizacoes/org-1",
			label: "Abrir organização",
		});
	});

	it("resolve recursos filhos dentro da obra", () => {
		expect(
			resolveAuditNavigationTarget({
				entityType: "BUDGET_ITEM",
				entityId: "item-1",
				workId: "work-1",
			}),
		).toEqual({
			path: "/app/obras/work-1/orcamento",
			label: "Abrir orçamento",
		});
		expect(
			resolveAuditNavigationTarget({
				entityType: "CONTRACT",
				entityId: "contract-1",
				workId: "work-1",
			}),
		).toEqual({
			path: "/app/obras/work-1/contratos/contract-1",
			label: "Abrir contrato",
		});
	});

	it("omite entidades sem rota ou sem contexto seguro", () => {
		expect(
			resolveAuditNavigationTarget({
				entityType: "BI_SNAPSHOT",
				entityId: "snapshot-1",
				workId: "work-1",
			}),
		).toBeNull();
		expect(
			resolveAuditNavigationTarget({
				entityType: "BUDGET_ITEM",
				entityId: "item-1",
			}),
		).toBeNull();
	});

	it("codifica ids antes de formar o destino", () => {
		expect(
			resolveAuditNavigationTarget({
				entityType: "WORK",
				entityId: "work/with space",
			}),
		).toEqual({
			path: "/app/obras/work%2Fwith%20space",
			label: "Abrir obra",
		});
	});
});
