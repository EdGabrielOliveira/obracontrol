import { beforeEach, describe, expect, it, mock } from "bun:test";
import Decimal from "decimal.js";

const budgetItemFindMany = mock<() => Promise<Array<Record<string, unknown>>>>(
	async () => [],
);
const identityFindMany = mock<() => Promise<Array<Record<string, unknown>>>>(
	async () => [],
);
const identityFindFirst = mock<() => Promise<Record<string, unknown> | null>>(
	async () => ({ id: "identity-1" }),
);
const versionFindFirst = mock<() => Promise<Record<string, unknown> | null>>(
	async () => ({ id: "version-1" }),
);
const versionItemFindMany = mock<() => Promise<Array<Record<string, unknown>>>>(
	async () => [],
);
const versionItemFindFirst = mock<
	() => Promise<Record<string, unknown> | null>
>(async () => ({ id: "vi-1" }));
const ledgerGroupBy = mock<() => Promise<Array<Record<string, unknown>>>>(
	async () => [],
);
const ledgerFindUnique = mock<() => Promise<Record<string, unknown> | null>>(
	async () => null,
);
const ledgerCreate = mock<
	(args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>
>(async (args) => ({ id: "ledger-1", createdAt: new Date(), ...args.data }));
const approvalDecisionFindFirst = mock<
	() => Promise<Record<string, unknown> | null>
>(async () => ({ id: "decision-1" }));

const impactFindMany = mock<() => Promise<Array<Record<string, unknown>>>>(
	async () => [],
);
const impactFindUnique = mock<() => Promise<Record<string, unknown> | null>>(
	async () => null,
);
const impactFindFirst = mock<() => Promise<Record<string, unknown> | null>>(
	async () => null,
);
let impactCreateCallCount = 0;
const impactCreate = mock<
	(args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>
>(async (args) => {
	impactCreateCallCount += 1;
	return {
		id: `impact-${impactCreateCallCount}`,
		createdAt: new Date(),
		...args.data,
	};
});
const impactUpdate = mock<
	(args: {
		where: { id: string };
		data: Record<string, unknown>;
	}) => Promise<Record<string, unknown>>
>(async (args) => ({ id: args.where.id, ...args.data }));

const workFindFirst = mock<() => Promise<Record<string, unknown> | null>>(
	async () => ({ id: "work-1", activeImportId: null }),
);

function txOf() {
	return {
		constructionWork: { findFirst: workFindFirst },
		constructionBudgetItem: { findMany: budgetItemFindMany },
		budgetItemIdentity: {
			findMany: identityFindMany,
			findFirst: identityFindFirst,
		},
		budgetVersion: { findFirst: versionFindFirst },
		budgetVersionItem: {
			findMany: versionItemFindMany,
			findFirst: versionItemFindFirst,
		},
		constructionLedgerEvent: {
			groupBy: ledgerGroupBy,
			findUnique: ledgerFindUnique,
			create: ledgerCreate,
		},
		constructionBudgetImpact: {
			findMany: impactFindMany,
			findUnique: impactFindUnique,
			findFirst: impactFindFirst,
			create: impactCreate,
			update: impactUpdate,
		},
		approvalDecision: { findFirst: approvalDecisionFindFirst },
	};
}

const transactionMock = mock<
	(
		callback: (tx: Record<string, unknown>) => Promise<unknown>,
	) => Promise<unknown>
>(async (callback) => callback(txOf()));

mock.module("../../../../../src/lib/prisma", () => ({
	prisma: {
		constructionWork: { findFirst: workFindFirst },
		constructionBudgetItem: { findMany: budgetItemFindMany },
		budgetItemIdentity: {
			findMany: identityFindMany,
			findFirst: identityFindFirst,
		},
		budgetVersion: { findFirst: versionFindFirst },
		budgetVersionItem: {
			findMany: versionItemFindMany,
			findFirst: versionItemFindFirst,
		},
		constructionLedgerEvent: {
			groupBy: ledgerGroupBy,
			findUnique: ledgerFindUnique,
			create: ledgerCreate,
		},
		constructionBudgetImpact: {
			findMany: impactFindMany,
			findUnique: impactFindUnique,
			findFirst: impactFindFirst,
			create: impactCreate,
			update: impactUpdate,
		},
		approvalDecision: { findFirst: approvalDecisionFindFirst },
		$transaction: transactionMock,
	},
}));

function fullImpactRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "impact-1",
		ownerId: "owner-1",
		workId: "work-1",
		budgetItemIdentityId: "identity-1",
		budgetVersionItemId: "vi-1",
		sourceType: "GENERAL_COST",
		sourceId: "cost-1",
		componentId: "item-1",
		impactType: "CONSUMPTION",
		status: "PENDING",
		quantity: null,
		budgetUnitCostSnapshot: new Decimal(100),
		operationUnitCost: null,
		amount: new Decimal(1300),
		approvalRequestId: null,
		parentImpactId: null,
		effectiveAt: null,
		reversedAt: null,
		createdAt: new Date(),
		...overrides,
	};
}

describe("BudgetControlService", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		impactCreateCallCount = 0;
		budgetItemFindMany.mockResolvedValue([{ id: "item-1", index: "1.1" }]);
		identityFindMany.mockResolvedValue([{ id: "identity-1", index: "1.1" }]);
		versionFindFirst.mockResolvedValue({ id: "version-1" });
		versionItemFindMany.mockResolvedValue([
			{
				id: "vi-1",
				identityId: "identity-1",
				quantity: new Decimal(20),
				unitCost: new Decimal(100),
			},
		]);
		ledgerGroupBy.mockResolvedValue([
			{
				budgetItemIdentityId: "identity-1",
				budgetVersionItemId: "vi-1",
				eventType: "COMMITMENT_INCREASE",
				sourceType: "CONTRACT_SERVICE",
				_sum: { amount: new Decimal(500) },
			},
			{
				budgetItemIdentityId: "identity-1",
				budgetVersionItemId: "vi-1",
				eventType: "INCURRED_CREATE",
				sourceType: "GENERAL_COST",
				_sum: { amount: new Decimal(300) },
			},
		]);
		impactFindMany.mockResolvedValue([]);
		impactFindUnique.mockResolvedValue(null);
		impactFindMany.mockReset();
		impactFindMany.mockResolvedValue([]);
		impactFindFirst.mockReset();
		impactFindFirst.mockResolvedValue(null);
		ledgerFindUnique.mockResolvedValue(null);
	});

	it("rejeita item de orcamento de outra obra e nao grava nada", async () => {
		budgetItemFindMany.mockResolvedValue([]);
		const { budgetControlService } = await import(
			"../../../../../src/modules/construction-planning/budget-control/budget-control.service"
		);

		await expect(
			budgetControlService.apply(
				"owner-1",
				"work-1",
				{
					workId: "work-1",
					allocations: [{ budgetItemId: "item-outra", value: 100 }],
					impactType: "CONSUMPTION",
					sourceType: "GENERAL_COST",
					sourceId: "cost-1",
				},
				{ userId: "user-1" },
			),
		).rejects.toMatchObject({
			code: "BUDGET_ITEM_WRONG_WORK",
		});
		expect(impactCreate).not.toHaveBeenCalled();
		expect(ledgerCreate).not.toHaveBeenCalled();
	});

	it("rejeita ausencia de versao ativa com BUDGET_VERSION_NOT_AVAILABLE", async () => {
		versionFindFirst.mockResolvedValue(null);
		const { budgetControlService } = await import(
			"../../../../../src/modules/construction-planning/budget-control/budget-control.service"
		);

		await expect(
			budgetControlService.apply(
				"owner-1",
				"work-1",
				{
					workId: "work-1",
					allocations: [{ budgetItemId: "item-1", value: 100 }],
					impactType: "CONSUMPTION",
					sourceType: "GENERAL_COST",
					sourceId: "cost-1",
				},
				{ userId: "user-1" },
			),
		).rejects.toMatchObject({
			code: "BUDGET_VERSION_NOT_AVAILABLE",
		});
		expect(impactCreate).not.toHaveBeenCalled();
	});

	it("aprova impacto dentro do saldo e grava evento no ledger", async () => {
		const { budgetControlService } = await import(
			"../../../../../src/modules/construction-planning/budget-control/budget-control.service"
		);

		const result = await budgetControlService.apply(
			"owner-1",
			"work-1",
			{
				workId: "work-1",
				allocations: [{ budgetItemId: "item-1", value: 1200 }],
				impactType: "CONSUMPTION",
				sourceType: "GENERAL_COST",
				sourceId: "cost-1",
			},
			{ userId: "user-1" },
		);

		expect(result.status).toBe("APPROVED");
		expect(result.requiresApproval).toBe(false);
		expect(result.availableBalance).toBe(1200);
		expect(result.projectedBalance).toBe(0);
		expect(result.allocations[0]).toMatchObject({
			budgetItemId: "item-1",
			status: "APPROVED",
			amount: 1200,
		});
		expect(impactCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					budgetItemIdentityId: "identity-1",
					budgetVersionItemId: "vi-1",
					sourceType: "GENERAL_COST",
					sourceId: "cost-1",
					impactType: "CONSUMPTION",
					status: "APPROVED",
					amount: new Decimal(1200),
					budgetUnitCostSnapshot: new Decimal(100),
					componentId: "item-1",
				}),
			}),
		);
		expect(ledgerCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					eventType: "INCURRED_CREATE",
					sourceType: "GENERAL_COST",
					sourceId: "cost-1",
					componentId: "item-1",
					amount: new Decimal(1200),
					budgetImpactId: "impact-1",
				}),
			}),
		);
	});

	it("deixa pendente impacto acima do saldo sem gravar ledger", async () => {
		const { budgetControlService } = await import(
			"../../../../../src/modules/construction-planning/budget-control/budget-control.service"
		);

		const result = await budgetControlService.apply(
			"owner-1",
			"work-1",
			{
				workId: "work-1",
				allocations: [{ budgetItemId: "item-1", value: 1300 }],
				impactType: "CONSUMPTION",
				sourceType: "GENERAL_COST",
				sourceId: "cost-1",
			},
			{ userId: "user-1" },
		);

		expect(result.status).toBe("PENDING_APPROVAL");
		expect(result.requiresApproval).toBe(true);
		expect(result.availableBalance).toBe(1200);
		expect(result.projectedBalance).toBeLessThan(1200);
		expect(impactCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					status: "PENDING",
					amount: new Decimal(1300),
					effectiveAt: null,
				}),
			}),
		);
		expect(ledgerCreate).not.toHaveBeenCalled();
	});

	it("rejects an over-budget impact when pending is not allowed", async () => {
		const { budgetControlService } = await import(
			"../../../../../src/modules/construction-planning/budget-control/budget-control.service"
		);

		await expect(
			budgetControlService.apply(
				"owner-1",
				"work-1",
				{
					workId: "work-1",
					allocations: [{ budgetItemId: "item-1", quantity: 13 }],
					impactType: "CONSUMPTION",
					sourceType: "WORK_MEASUREMENT",
					sourceId: "measurement-1",
					allowPending: false,
				},
				{ userId: "user-1" },
			),
		).rejects.toMatchObject({ code: "BUDGET_BALANCE_EXCEEDED" });
		expect(impactCreate).not.toHaveBeenCalled();
		expect(ledgerCreate).not.toHaveBeenCalled();
	});

	it("aplica impacto negativo de COMMITMENT como COMMITMENT_REDUCTION no ledger", async () => {
		const { budgetControlService } = await import(
			"../../../../../src/modules/construction-planning/budget-control/budget-control.service"
		);

		const result = await budgetControlService.apply(
			"owner-1",
			"work-1",
			{
				workId: "work-1",
				allocations: [{ budgetItemId: "item-1", value: -500 }],
				amount: -500,
				impactType: "COMMITMENT",
				sourceType: "CONTRACT_AMENDMENT",
				sourceId: "amendment-1",
				componentId: "AMENDMENT",
			},
			{ userId: "user-1" },
		);

		expect(result.status).toBe("APPROVED");
		expect(impactCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					status: "APPROVED",
					amount: new Decimal(-500),
					impactType: "COMMITMENT",
				}),
			}),
		);
		const created = ledgerCreate.mock.calls[0]?.[0] as {
			data: { eventType: string; amount: unknown };
		};
		expect(created.data.eventType).toBe("COMMITMENT_REDUCTION");
		expect(Number(created.data.amount)).toBe(500);
	});

	it("reverses the prior source impact before applying the replacement", async () => {
		impactFindMany.mockResolvedValue([
			fullImpactRow({
				sourceType: "WORK_MEASUREMENT",
				sourceId: "measurement-1",
				status: "APPROVED",
				amount: new Decimal(500),
			}),
		]);
		impactFindFirst
			.mockResolvedValueOnce(
				fullImpactRow({
					sourceType: "WORK_MEASUREMENT",
					sourceId: "measurement-1",
					status: "APPROVED",
					amount: new Decimal(500),
				}),
			)
			.mockResolvedValueOnce(null);
		const { budgetControlService } = await import(
			"../../../../../src/modules/construction-planning/budget-control/budget-control.service"
		);

		const result = await budgetControlService.replaceSourceImpact(
			"owner-1",
			"work-1",
			{
				workId: "work-1",
				allocations: [{ budgetItemId: "item-1", quantity: 5 }],
				impactType: "CONSUMPTION",
				sourceType: "WORK_MEASUREMENT",
				sourceId: "measurement-1",
			},
			{ userId: "user-1" },
		);

		expect(result.allocations).toHaveLength(1);
		expect(ledgerCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ eventType: "INCURRED_REVERSAL" }),
			}),
		);
		expect(impactCreate).toHaveBeenCalledTimes(2);
	});

	it("rejects a prior pending source impact without creating a reversal event", async () => {
		impactFindMany.mockResolvedValue([
			fullImpactRow({
				sourceType: "WORK_MEASUREMENT",
				sourceId: "measurement-1",
				status: "PENDING",
			}),
		]);
		impactFindFirst
			.mockResolvedValueOnce(
				fullImpactRow({
					sourceType: "WORK_MEASUREMENT",
					sourceId: "measurement-1",
					status: "PENDING",
				}),
			)
			.mockResolvedValueOnce(null);
		const { budgetControlService } = await import(
			"../../../../../src/modules/construction-planning/budget-control/budget-control.service"
		);

		await budgetControlService.replaceSourceImpact(
			"owner-1",
			"work-1",
			{
				workId: "work-1",
				allocations: [{ budgetItemId: "item-1", quantity: 5 }],
				impactType: "CONSUMPTION",
				sourceType: "WORK_MEASUREMENT",
				sourceId: "measurement-1",
			},
			{ userId: "user-1" },
		);

		expect(impactUpdate).toHaveBeenCalledWith(
			expect.objectContaining({ data: { status: "REJECTED" } }),
		);
		expect(
			ledgerCreate.mock.calls.some(
				([call]) => call.data.eventType === "INCURRED_REVERSAL",
			),
		).toBe(false);
	});

	it("does not reverse a prior reversal impact when replacing a source again", async () => {
		impactFindMany.mockResolvedValue([
			fullImpactRow({
				id: "reversal-1",
				sourceType: "WORK_MEASUREMENT",
				sourceId: "measurement-1",
				impactType: "REVERSAL",
				status: "APPROVED",
			}),
			fullImpactRow({
				id: "consumption-2",
				sourceType: "WORK_MEASUREMENT",
				sourceId: "measurement-1",
				impactType: "CONSUMPTION",
				status: "APPROVED",
			}),
		]);
		impactFindFirst
			.mockResolvedValueOnce(
				fullImpactRow({
					id: "consumption-2",
					sourceType: "WORK_MEASUREMENT",
					sourceId: "measurement-1",
					impactType: "CONSUMPTION",
					status: "APPROVED",
				}),
			)
			.mockResolvedValueOnce(null);
		const { budgetControlService } = await import(
			"../../../../../src/modules/construction-planning/budget-control/budget-control.service"
		);

		await budgetControlService.replaceSourceImpact(
			"owner-1",
			"work-1",
			{
				workId: "work-1",
				allocations: [{ budgetItemId: "item-1", quantity: 5 }],
				impactType: "CONSUMPTION",
				sourceType: "WORK_MEASUREMENT",
				sourceId: "measurement-1",
			},
			{ userId: "user-1" },
		);

		expect(impactFindFirst).toHaveBeenCalledTimes(2);
	});

	it("alocacao por quantidade usa o custo unitario da versao vigente", async () => {
		const { budgetControlService } = await import(
			"../../../../../src/modules/construction-planning/budget-control/budget-control.service"
		);

		const result = await budgetControlService.apply(
			"owner-1",
			"work-1",
			{
				workId: "work-1",
				allocations: [{ budgetItemId: "item-1", quantity: 5 }],
				impactType: "CONSUMPTION",
				sourceType: "WORK_MEASUREMENT",
				sourceId: "wm-item-1",
			},
			{ userId: "user-1" },
		);

		expect(result.status).toBe("APPROVED");
		expect(result.allocations[0].amount).toBe(500);
		expect(impactCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					quantity: new Decimal(5),
					operationUnitCost: new Decimal(100),
				}),
			}),
		);
	});

	it("chamada repetida retorna o impacto existente sem duplicar ledger", async () => {
		impactFindFirst.mockResolvedValue(
			fullImpactRow({
				id: "impact-1",
				status: "APPROVED",
				amount: new Decimal(1200),
			}),
		);
		const { budgetControlService } = await import(
			"../../../../../src/modules/construction-planning/budget-control/budget-control.service"
		);

		const result = await budgetControlService.apply(
			"owner-1",
			"work-1",
			{
				workId: "work-1",
				allocations: [{ budgetItemId: "item-1", value: 1200 }],
				impactType: "CONSUMPTION",
				sourceType: "GENERAL_COST",
				sourceId: "cost-1",
			},
			{ userId: "user-1" },
		);

		expect(result.allocations[0].impactId).toBe("impact-1");
		expect(impactCreate).not.toHaveBeenCalled();
		expect(ledgerCreate).not.toHaveBeenCalled();
	});

	it("aprovacao efetiva o impacto pendente e grava ledger", async () => {
		impactFindFirst.mockResolvedValue(fullImpactRow());
		const { budgetControlService } = await import(
			"../../../../../src/modules/construction-planning/budget-control/budget-control.service"
		);

		const result = await budgetControlService.approve("owner-1", "impact-1", {
			userId: "user-1",
		});

		expect(result.status).toBe("APPROVED");
		expect(impactUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: "impact-1" },
				data: expect.objectContaining({
					status: "APPROVED",
					effectiveAt: expect.any(Date),
				}),
			}),
		);
		expect(ledgerCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					eventType: "INCURRED_CREATE",
					amount: new Decimal(1300),
					budgetImpactId: "impact-1",
				}),
			}),
		);
	});

	it("rejeicao nao grava ledger", async () => {
		impactFindFirst.mockResolvedValue(fullImpactRow());
		const { budgetControlService } = await import(
			"../../../../../src/modules/construction-planning/budget-control/budget-control.service"
		);

		await budgetControlService.reject("owner-1", "impact-1", {
			userId: "user-1",
		});

		expect(impactUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ status: "REJECTED" }),
			}),
		);
		expect(ledgerCreate).not.toHaveBeenCalled();
	});

	it("reversao cria impacto reverso e evento de reversao", async () => {
		impactFindFirst.mockResolvedValue(
			fullImpactRow({
				status: "APPROVED",
				reversedAt: null,
			}),
		);
		const { budgetControlService } = await import(
			"../../../../../src/modules/construction-planning/budget-control/budget-control.service"
		);

		const result = await budgetControlService.reverse("owner-1", "impact-1", {
			userId: "user-1",
		});

		expect(result.allocations[0]).toMatchObject({
			impactType: "REVERSAL",
			status: "APPROVED",
			amount: 1300,
		});
		const reversalCreate = impactCreate.mock.calls[0][0].data;
		expect(reversalCreate).toMatchObject({
			impactType: "REVERSAL",
			parentImpactId: "impact-1",
			status: "APPROVED",
		});
		expect(ledgerCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					eventType: "INCURRED_REVERSAL",
					amount: new Decimal(1300),
					budgetImpactId: "impact-1",
				}),
			}),
		);
		expect(impactUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					reversedAt: expect.any(Date),
				}),
			}),
		);
	});

	it("preview calcula saldo por item sem gravar nada", async () => {
		const { budgetControlService } = await import(
			"../../../../../src/modules/construction-planning/budget-control/budget-control.service"
		);

		const preview = await budgetControlService.preview("owner-1", "work-1", {
			allocations: [{ budgetItemId: "item-1", value: 700 }],
		});

		expect(preview.items[0]).toMatchObject({
			budgetItemId: "item-1",
			limit: 2000,
			approvedCommitted: 500,
			approvedConsumed: 300,
			availableBalance: 1200,
		});
		expect(preview.requiresApproval).toBe(false);
		expect(impactCreate).not.toHaveBeenCalled();
		expect(ledgerCreate).not.toHaveBeenCalled();
	});

	it("getAvailability retorna saldos dos itens consultados", async () => {
		const { budgetControlService } = await import(
			"../../../../../src/modules/construction-planning/budget-control/budget-control.service"
		);

		const balances = await budgetControlService.getAvailability(
			"owner-1",
			"work-1",
			["item-1"],
		);

		expect(balances).toHaveLength(1);
		expect(balances[0]).toMatchObject({
			budgetItemId: "item-1",
			limit: 2000,
			availableBalance: 1200,
			projectedBalance: 1200,
		});
	});
});
