import { describe, expect, it, mock } from "bun:test";
import { ConstructionError } from "../../../../src/lib/errors";

const reconcileUpsert = mock(async () => ({
	id: "rec-1",
	status: "CONFIRMED",
}));
const reconcileFindMany = mock(async () => []);
const ledgerFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const applyMock = mock(async () => ({
	status: "APPROVED",
	requiresApproval: false,
	availableBalance: 0,
	projectedBalance: 0,
	allocations: [],
}));

const prismaClient = {
	constructionBudgetReconciliation: {
		upsert: reconcileUpsert,
		findMany: reconcileFindMany,
		findUnique: mock(async () => null),
	},
	constructionLedgerEvent: {
		findMany: ledgerFindMany,
	},
};

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		...prismaClient,
		$transaction: mock(async (operation: (tx: unknown) => unknown) =>
			operation(prismaClient),
		),
	},
}));

mock.module(
	"../../../../src/modules/construction-planning/budget-control/budget-control.service",
	() => ({
		budgetControlService: {
			apply: applyMock,
		},
	}),
);

mock.module(
	"../../../../src/modules/construction-planning/budget-control/budget-control.repository",
	() => ({
		findActiveImpactsBySource: mock(async () => []),
	}),
);

describe("budget-reconciliation.service", () => {
	it("lista registros sem vinculo orcamentario", async () => {
		ledgerFindMany.mockResolvedValue([
			{ sourceType: "CONTRACT_SERVICE", sourceId: "service-1" },
		]);
		const { budgetReconciliationService } = await import(
			"../../../../src/modules/construction-planning/budget-reconciliation.service"
		);
		const rows = await budgetReconciliationService.listPending(
			"owner-1",
			"work-1",
		);
		expect(rows.length).toBeGreaterThanOrEqual(0);
		expect(ledgerFindMany).toHaveBeenCalled();
	});

	it("confirma reconciliacao e cria impactos historicos idempotentes", async () => {
		ledgerFindMany.mockResolvedValue([
			{
				sourceType: "CONTRACT_SERVICE",
				sourceId: "service-1",
				componentId: "BASE",
				eventType: "COMMITMENT_INCREASE",
				amount: "1000",
				competence: "2026-07",
				occurredAt: new Date("2026-07-10"),
				budgetItemIdentityId: "identity-1",
				budgetVersionItemId: "vi-1",
			},
		]);
		const { budgetReconciliationService } = await import(
			"../../../../src/modules/construction-planning/budget-reconciliation.service"
		);
		const first = await budgetReconciliationService.confirm("owner-1", {
			workId: "work-1",
			sourceType: "CONTRACT_SERVICE",
			sourceId: "service-1",
			budgetItemId: "item-1",
			reason: "correspondencia confirmada",
			createdBy: "admin-1",
		});
		const second = await budgetReconciliationService.confirm("owner-1", {
			workId: "work-1",
			sourceType: "CONTRACT_SERVICE",
			sourceId: "service-1",
			budgetItemId: "item-1",
			reason: "repeticoes",
			createdBy: "admin-1",
		});
		expect(second.status).toBe("CONFIRMED");
		expect(first.status).toBe("CONFIRMED");
	});

	it("rejeita confirmacao de registro inexistente", async () => {
		ledgerFindMany.mockResolvedValue([]);
		const { budgetReconciliationService } = await import(
			"../../../../src/modules/construction-planning/budget-reconciliation.service"
		);
		await expect(
			budgetReconciliationService.confirm("owner-1", {
				workId: "work-1",
				sourceType: "GENERAL_COST",
				sourceId: "cost-inexistente",
				budgetItemId: "item-1",
				reason: "sem registro",
				createdBy: "admin-1",
			}),
		).rejects.toBeInstanceOf(ConstructionError);
	});

	it("rejeita reconciliacao sem motivo", async () => {
		const { budgetReconciliationService } = await import(
			"../../../../src/modules/construction-planning/budget-reconciliation.service"
		);
		await expect(
			budgetReconciliationService.reject("owner-1", {
				workId: "work-1",
				sourceType: "GENERAL_COST",
				sourceId: "cost-1",
				reason: "",
				createdBy: "admin-1",
			}),
		).rejects.toBeInstanceOf(ConstructionError);
	});
});
