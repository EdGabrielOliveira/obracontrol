import { describe, expect, it, mock } from "bun:test";
import {
	assertJsonResponse,
	assertNoContentResponse,
	makeTestWork,
	TEST_CC_ID,
	TEST_ORG_ID,
	TEST_OWNER,
	TEST_WORK_ID,
} from "./setup";

const getSessionUser = mock(async () => ({
	id: TEST_OWNER,
	email: "teste@obra.bi",
	name: "Usuario Teste",
	role: "GERENTE",
}));

mock.module("../../../src/lib/auth-middleware", () => ({ getSessionUser }));

mock.module("../../../src/lib/prisma", () => ({
	prisma: {
		user: {
			findUnique: mock(async () => ({ role: "GERENTE" })),
		},
		constructionWork: {
			findUnique: mock(async () => ({
				id: TEST_WORK_ID,
				costCenterId: TEST_CC_ID,
			})),
		},
		costCenter: {
			findUnique: mock(async () => ({
				id: TEST_CC_ID,
				organizationId: TEST_ORG_ID,
			})),
		},
		organization: {
			findUnique: mock(async () => ({
				id: TEST_ORG_ID,
				ownerId: TEST_OWNER,
			})),
		},
		workMembership: {
			findUnique: mock(async () => null),
			findMany: mock(async () => []),
		},
		costCenterMembership: {
			findUnique: mock(async () => null),
			findMany: mock(async () => [{ costCenterId: TEST_CC_ID }]),
		},
		organizationMembership: {
			findUnique: mock(async () => null),
			findMany: mock(async () => [{ organizationId: TEST_ORG_ID }]),
		},
		constructionBudgetItem: { findMany: mock(async () => []) },
		constructionBudgetImpact: {
			findMany: mock(async () => []),
			findFirst: mock(async () => null),
			findUnique: mock(async () => null),
			create: mock(async (args: { data: Record<string, unknown> }) => ({
				id: "impact-1",
				createdAt: new Date(),
				...args.data,
			})),
			update: mock(async (args: { data: Record<string, unknown> }) => ({
				...args.data,
			})),
		},
		$transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
			callback({
				auditLog: {
					create: mock(async (args: { data: Record<string, unknown> }) => ({
						id: "audit-e2e",
						createdAt: new Date(),
						...args.data,
					})),
				},
			}),
	},
}));

mock.module("../../../src/modules/construction-planning/repository", () => ({
	getWorkById: mock(async () => makeTestWork()),
	getWorkOrThrow: mock(async () => makeTestWork()),
	getWorkMeasurementsForBI: mock(async () => []),
}));

mock.module("./governance-guard", () => ({
	constructionGovernanceGuard: { assertWritable: mock(async () => undefined) },
	assertNoPendingEffect: mock(async () => undefined),
}));

mock.module(
	"../../../src/modules/construction-planning/governance-guard",
	() => ({
		budgetGovernanceGuard: { assertWritable: mock(async () => undefined) },
		constructionGovernanceGuard: {
			assertWritable: mock(async () => undefined),
		},
		assertNoPendingEffect: mock(async () => undefined),
	}),
);

mock.module(
	"../../../src/modules/construction-planning/contract.repository",
	() => ({
		listContractSnapshotRows: mock(async () => []),
		listContractServices: mock(async () => [
			{
				id: "e2e-cs-1",
				contractId: "e2e-contract-1",
				type: "ITEM",
				description: "Servico E2E",
				unit: "un",
				quantity: 10,
				unitCost: 5000,
				totalCost: 50000,
				budgetItemId: null,
				sortOrder: 1,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		]),
		createContractService: mock(async () => ({
			id: "e2e-cs-1",
			contractId: "e2e-contract-1",
			type: "ITEM",
			description: "Servico de Fundacao",
			unit: "m3",
			quantity: 50,
			unitCost: 300,
			totalCost: 15000,
			createdAt: new Date(),
			updatedAt: new Date(),
		})),
		updateContractService: mock(async () => ({
			id: "e2e-cs-1",
			contractId: "e2e-contract-1",
			type: "ITEM",
			description: "Servico Atualizado",
			quantity: 60,
			totalCost: 18000,
			createdAt: new Date(),
			updatedAt: new Date(),
		})),
		deleteContractService: mock(async () => ({ id: "e2e-cs-1" })),
		linkServicesToBudget: mock(async () => [
			{ id: "e2e-cs-1", budgetItemId: "e2e-budget-item-1" },
		]),
		getContractServiceBudgetItem: mock(async () => ({
			id: "e2e-budget-item-1",
			description: "Servico de Fundacao",
			index: "1.1",
		})),
		deriveServiceTotalCost: (input: {
			quantity?: number | null;
			unitCost?: number | null;
		}) => {
			const quantity = Number(input.quantity ?? 0);
			const unitCost = Number(input.unitCost ?? 0);
			return quantity > 0 && unitCost > 0
				? Math.round(quantity * unitCost * 100) / 100
				: null;
		},
		getContractServiceById: mock(async () => ({
			id: "e2e-cs-1",
			contractId: "e2e-contract-1",
			type: "ITEM",
			description: "Servico E2E",
			unit: "un",
			quantity: 10,
			unitCost: 5000,
			totalCost: 50000,
			budgetItemId: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		})),
	}),
);

mock.module(
	"../../../src/modules/construction-planning/ledger/ledger.service",
	() => ({
		appendLedgerEvent: mock(async () => undefined),
		appendLedgerEvents: mock(async () => []),
		summarizeLedger: mock(async () => null),
	}),
);

mock.module(
	"../../../src/modules/construction-planning/budget-control/budget-control.service",
	() => ({
		budgetControlService: {
			apply: mock(async () => ({
				status: "APPROVED",
				requiresApproval: false,
				availableBalance: 0,
				projectedBalance: 0,
				allocations: [],
			})),
			reverse: mock(async () => ({
				status: "APPROVED",
				requiresApproval: false,
				availableBalance: 0,
				projectedBalance: 0,
				allocations: [],
			})),
			reject: mock(async () => undefined),
			preview: mock(async () => ({
				items: [
					{
						budgetItemId: "e2e-budget-item-1",
						limit: 20000,
						approvedCommitted: 0,
						approvedConsumed: 0,
						pendingImpact: 0,
						availableBalance: 20000,
						projectedBalance: 5000,
					},
				],
				totalImpact: 15000,
				requiresApproval: false,
			})),
		},
	}),
);

mock.module(
	"../../../src/modules/construction-planning/ledger/ledger.repository",
	() => ({
		findLedgerEventsBySourcePrefix: mock(async () => []),
		countLedgerEventsBySource: mock(async () => 0),
		findLedgerEventsBySource: mock(async () => []),
	}),
);

mock.module(
	"../../../src/modules/construction-planning/ledger/ledger.integration",
	() => ({
		resolveLedgerItemRef: mock(async () => ({
			identityId: "e2e-identity",
			versionItemId: "e2e-version-item",
		})),
		competenceOf: mock(
			(date: Date) =>
				`${String(date.getUTCFullYear()).padStart(4, "0")}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
		),
		splitMeasurementValue: mock(
			(
				items: Array<{
					accumulatedValue?: number | null;
					measuredValue?: number | null;
				}>,
				input: {
					discountValue?: number | null;
					retentionValue?: number | null;
					taxValue?: number | null;
				},
			) => {
				const grossValue = items.reduce(
					(sum, item) =>
						sum + Number(item.accumulatedValue ?? item.measuredValue ?? 0),
					0,
				);
				const commercialDiscount = Number(input.discountValue ?? 0);
				const retention = Number(input.retentionValue ?? 0);
				const tax = Number(input.taxValue ?? 0);
				const incurredNet = grossValue - commercialDiscount;
				return {
					grossValue,
					commercialDiscount,
					retention,
					tax,
					incurredNet,
					dueSupplier: incurredNet - retention - tax,
				};
			},
		),
		assertDuePartsDoNotExceedIncurred: mock(() => undefined),
		buildMeasurementEvents: mock(() => []),
		buildCommitmentEvent: mock(
			(
				base: Record<string, unknown>,
				eventType: string,
				componentId: string,
				amount: unknown,
			) => ({
				...base,
				eventType,
				componentId,
				amount,
			}),
		),
		reverseLedgerEvents: mock((events: unknown[]) => events),
		SERVICE_SOURCE_TYPE: "CONTRACT_SERVICE",
		AMENDMENT_SOURCE_TYPE: "CONTRACT_AMENDMENT",
		MEASUREMENT_SOURCE_TYPE: "CONTRACT_MEASUREMENT",
		PAYMENT_SOURCE_TYPE: "CONTRACT_PAYMENT",
		GENERAL_COST_SOURCE_TYPE: "GENERAL_COST",
		COMPONENT_BASE: "BASE",
		COMPONENT_AMENDMENT: "AMENDMENT",
		COMPONENT_SUPPLIER: "fornecedor",
		COMPONENT_RETENTION: "retencao",
		COMPONENT_TAX: "tributo",
		buildPaymentCreateEvent: mock(
			(base: Record<string, unknown>, amount: unknown) => ({
				...base,
				eventType: "PAYMENT_CREATE",
				componentId: "fornecedor",
				amount,
			}),
		),
		buildGeneralCostEvents: mock(
			(base: Record<string, unknown>, amount: unknown, paidInCash: boolean) => {
				const events = [
					{
						...base,
						eventType: "INCURRED_CREATE",
						componentId: "fornecedor",
						amount,
					},
					{
						...base,
						eventType: "DUE_CREATE",
						componentId: "fornecedor",
						amount,
					},
				];
				if (paidInCash) {
					events.push({
						...base,
						eventType: "PAYMENT_CREATE",
						componentId: "fornecedor",
						amount,
					});
				}
				return events;
			},
		),
	}),
);

describe("Contract Services E2E", () => {
	it("GET /construction/works/:workId/contracts/:cId/services - lista servicos", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/services`,
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(Array.isArray(body)).toBe(true);
	});

	it("POST /construction/works/:workId/contracts/:contractId/services - cria servico", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/services`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						type: "ITEM",
						description: "Servico de Fundacao",
						unit: "m3",
						quantity: 50,
						unitCost: 300,
						totalCost: 15000,
					}),
				},
			),
		);

		expect(response.status).toBeLessThan(500);
	});

	it("PATCH /construction/works/:workId/contracts/:contractId/services/:sId - atualiza servico", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/services/e2e-cs-1`,
				{
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						description: "Servico Atualizado",
						quantity: 60,
						totalCost: 18000,
					}),
				},
			),
		);

		expect(response.status).toBeLessThan(500);
	});

	it("DELETE /construction/works/:workId/contracts/:contractId/services/:sId - exclui servico", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/services/e2e-cs-1`,
				{
					method: "DELETE",
				},
			),
		);

		assertNoContentResponse(response);
	});

	it("POST /construction/works/:workId/contracts/:contractId/services/preview - previa sem persistir", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/services/preview`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						budgetItemId: "e2e-budget-item-1",
						quantity: 50,
						unitCost: 300,
					}),
				},
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toMatchObject({
			budgetItem: {
				id: "e2e-budget-item-1",
				description: "Servico de Fundacao",
				index: "1.1",
			},
			availableBefore: 20000,
			projectedValue: 15000,
			availableAfter: 5000,
			warnings: [],
		});
	});

	it("POST .../services/preview - payload sem budgetItemId retorna 400", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/services/preview`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ quantity: 50 }),
				},
			),
		);

		expect(response.status).toBe(400);
	});

	it("POST /construction/works/:workId/contracts/:contractId/services/link-budget - vincula orcamento", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/services/link-budget`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						links: [
							{ serviceId: "e2e-cs-1", budgetItemId: "e2e-budget-item-1" },
						],
					}),
				},
			),
		);

		expect(response.status).toBeLessThan(500);
	});
});
