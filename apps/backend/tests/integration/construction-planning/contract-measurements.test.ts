import { describe, expect, it, mock } from "bun:test";
import type { BudgetMutationResult } from "../../../src/modules/construction-planning/budget-control/budget-control.types";
import {
	assertJsonResponse,
	assertNoContentResponse,
	TEST_BUDGET_ITEM_ID,
	TEST_CC_ID,
	TEST_ORG_ID,
	TEST_OWNER,
	TEST_WORK_ID,
} from "./setup";

const SERVICE_ID = "e2e-cs-1";

const getSessionUser = mock(async () => ({
	id: TEST_OWNER,
	email: "teste@obra.bi",
	name: "Usuario Teste",
	role: "GERENTE",
}));

const auditLogCreate = mock(async () => ({ id: "audit-1" }));

const getServiceTotals = mock(async () => ({
	[SERVICE_ID]: 50000,
}));

const getContractPeriod = mock(async () => ({
	startDate: new Date("2026-01-01"),
	endDate: new Date("2026-12-31"),
}));

const getServiceBudgetItems = mock(
	async () =>
		new Map([
			[SERVICE_ID, { budgetItemId: TEST_BUDGET_ITEM_ID, totalCost: 50000 }],
		]),
);

const cmBudgetApply = mock(
	async (): Promise<BudgetMutationResult> => ({
		status: "APPROVED",
		requiresApproval: false,
		availableBalance: 0,
		projectedBalance: 0,
		allocations: [],
	}),
);
const cmBudgetReverse = mock(
	async (): Promise<BudgetMutationResult> => ({
		status: "APPROVED",
		requiresApproval: false,
		availableBalance: 0,
		projectedBalance: 0,
		allocations: [],
	}),
);
const cmBudgetReject = mock(async () => undefined);
const cmBudgetApprove = mock(async () => undefined);
const approvalRequestFindFirst = mock(
	async (): Promise<{ id: string } | null> => null,
);

mock.module("../../../src/lib/auth-middleware", () => ({ getSessionUser }));

mock.module("../../../src/lib/prisma", () => ({
	prisma: {
		auditLog: { create: auditLogCreate },
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
		contractMeasurementItem: { findMany: mock(async () => []) },
		constructionBudgetImpact: { findMany: mock(async () => []) },
		approvalRequest: { findFirst: approvalRequestFindFirst },
		$transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
			callback({
				auditLog: { create: auditLogCreate },
				constructionBudgetImpact: { findMany: mock(async () => []) },
			}),
	},
}));

mock.module(
	"../../../src/modules/construction-planning/contract-governance-scope",
	() => ({
		contractGovernanceScope: {
			getWorkId: mock(async () => TEST_WORK_ID),
		},
	}),
);

mock.module("../../../src/modules/governance/approval.service", () => ({
	submitApproval: mock(async () => ({
		status: "PENDING",
		approvalRequestId: "req-submit",
	})),
}));

mock.module("./contract-governance-scope", () => ({
	contractGovernanceScope: {
		getWorkId: mock(async () => TEST_WORK_ID),
	},
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
	"../../../src/modules/construction-planning/contract-measurement.repository",
	() => ({
		getContractPeriod,
		getServiceTotals,
		getContractAggregate: mock(async () => ({
			contractId: "e2e-contract-1",
			services: [],
			measurements: [],
			payments: [],
		})),
		listMeasurements: mock(async () => ({
			data: [],
			total: 0,
			page: 1,
			limit: 10,
		})),
		getMeasurementById: mock(async () => ({
			id: "e2e-cm-1",
			ownerId: TEST_OWNER,
			contractId: "e2e-contract-1",
			number: 1,
			date: new Date("2026-06-15"),
			title: "Medicao Contrato E2E",
			discountValue: null,
			retentionValue: null,
			createdBy: null,
			notes: null,
			createdAt: new Date(),
			updatedAt: new Date(),
			items: [],
		})),
		getMeasurementDetail: mock(async () => ({
			contract: {
				id: "e2e-contract-1",
				code: "CT-001",
				supplierName: "Fornecedor",
			},
			measurement: { id: "e2e-cm-1", number: 1 },
			serviceTree: [
				{ id: "service-1", description: "Servico A", children: [] },
			],
			items: [
				{
					id: "item-1",
					serviceId: "service-1",
					measuredCurrent: { quantity: 5, value: 25000, percentage: 25 },
					measuredAccumulated: { quantity: 5, value: 25000, percentage: 25 },
					balance: { quantity: 15, value: 75000, percentage: 75 },
				},
			],
			totals: {
				contractValue: 100000,
				measuredCurrent: 25000,
				measuredAccumulated: 25000,
				balance: 75000,
			},
		})),
		createMeasurement: mock(async () => ({
			id: "e2e-cm-1",
			ownerId: TEST_OWNER,
			contractId: "e2e-contract-1",
			number: 1,
			date: new Date("2026-06-15"),
			title: "Medicao Contrato Teste",
			createdAt: new Date(),
			updatedAt: new Date(),
			items: [],
		})),
		updateMeasurement: mock(async () => ({
			id: "e2e-cm-1",
			ownerId: TEST_OWNER,
			contractId: "e2e-contract-1",
			number: 1,
			date: new Date("2026-06-15"),
			title: "Medicao Atualizada",
			createdAt: new Date(),
			updatedAt: new Date(),
			items: [],
		})),
		deleteMeasurement: mock(async () => ({ id: "e2e-cm-1" })),
		getMeasurementMap: mock(async () => ({
			totalContractValue: 100000,
			totalMeasured: 0,
			totalMeasuredPercentage: 0,
			balanceToMeasure: 100000,
			balancePercentage: 1,
			services: [],
		})),
		getContractLedgerContext: mock(async () => ({
			workId: TEST_WORK_ID,
			startDate: null,
			endDate: null,
		})),
		getServiceBudgetItems,
		getContractServicesById: mock(
			async () =>
				new Map([
					[
						SERVICE_ID,
						{
							id: SERVICE_ID,
							quantity: 10,
							unitCost: 5000,
							totalCost: 50000,
						},
					],
				]),
		),
		countPaidPaymentsForMeasurement: mock(async () => 0),
		buildMeasurementItemData: mock(
			(item: Record<string, unknown>, _service?: unknown) => ({
				serviceId: item.serviceId,
				measuredQuantity: item.measuredQuantity ?? null,
				measuredValue: item.measuredValue ?? null,
				measuredPercentage: item.measuredPercentage ?? null,
				accumulatedQuantity: item.accumulatedQuantity ?? null,
				accumulatedValue: item.accumulatedValue ?? null,
				accumulatedPercentage: item.accumulatedPercentage ?? null,
			}),
		),
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
			apply: cmBudgetApply,
			reverse: cmBudgetReverse,
			reject: cmBudgetReject,
			approve: cmBudgetApprove,
		},
	}),
);

mock.module(
	"../../../src/modules/construction-planning/ledger/ledger.repository",
	() => ({
		countLedgerEventsBySource: mock(async () => 0),
		findLedgerEventsBySource: mock(async () => []),
		findLedgerEventsBySourcePrefix: mock(async () => []),
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
		buildMeasurementEvents: mock(() => [
			{
				eventType: "INCURRED_CREATE",
				amount: 15000,
			},
		]),
		reverseLedgerEvents: mock((events: unknown[]) => events),
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
		MEASUREMENT_SOURCE_TYPE: "CONTRACT_MEASUREMENT",
		SERVICE_SOURCE_TYPE: "CONTRACT_SERVICE",
		AMENDMENT_SOURCE_TYPE: "CONTRACT_AMENDMENT",
		PAYMENT_SOURCE_TYPE: "CONTRACT_PAYMENT",
		GENERAL_COST_SOURCE_TYPE: "GENERAL_COST",
		COMPONENT_SUPPLIER: "fornecedor",
		COMPONENT_RETENTION: "retencao",
		COMPONENT_TAX: "tributo",
		COMPONENT_BASE: "BASE",
		COMPONENT_AMENDMENT: "AMENDMENT",
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

describe("Contract Measurements E2E", () => {
	it("GET /construction/works/:workId/contracts/:contractId/measurements - lista medicoes", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/measurements`,
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toMatchObject({ data: [], total: 0 });
	});

	it("POST /construction/works/:workId/contracts/:contractId/measurements - cria medicao", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/measurements`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						number: 1,
						date: "2026-06-15",
						title: "Medicao Contrato Teste",
						items: [
							{
								serviceId: "e2e-cs-1",
								measuredQuantity: 5,
								measuredValue: 25000,
								measuredPercentage: 50,
							},
						],
					}),
				},
			),
		);

		expect(response.status).toBeLessThan(500);
	});

	it("GET /construction/works/:workId/contracts/:contractId/measurements/:mId - detalhe", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/measurements/e2e-cm-1`,
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toHaveProperty("contract");
		expect(body).toHaveProperty("serviceTree");
		expect(body).toHaveProperty("items");
		expect(body).toHaveProperty("totals");
	});

	it("PATCH /construction/works/:workId/contracts/:contractId/measurements/:mId - atualiza", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/measurements/e2e-cm-1`,
				{
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						title: "Medicao Atualizada",
					}),
				},
			),
		);

		expect(response.status).toBeLessThan(500);
	});

	it("DELETE /construction/works/:workId/contracts/:contractId/measurements/:mId - exclui", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/measurements/e2e-cm-1`,
				{
					method: "DELETE",
				},
			),
		);

		assertNoContentResponse(response);
	});

	it("POST - item acima do saldo (GERENTE) bloqueia", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "GERENTE",
		}));
		getServiceTotals.mockImplementation(async () => ({
			[SERVICE_ID]: 10000,
		}));
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/measurements`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						number: 1,
						date: "2026-06-15",
						title: "Medicao Teste",
						items: [
							{
								serviceId: SERVICE_ID,
								measuredValue: 12500,
								accumulatedValue: 15000,
							},
						],
					}),
				},
			),
		);

		expect(response.status).toBe(422);
		const body = await response.json();
		expect(body.message).toContain("saldo");
		expect(cmBudgetApprove).not.toHaveBeenCalled();
	});

	it("POST - item acima do saldo (SUPERVISOR) bloqueia", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "SUPERVISOR",
		}));
		getServiceTotals.mockImplementation(async () => ({
			[SERVICE_ID]: 10000,
		}));
		cmBudgetApply.mockResolvedValueOnce({
			status: "PENDING_APPROVAL",
			requiresApproval: true,
			availableBalance: 0,
			projectedBalance: -5000,
			allocations: [
				{
					budgetItemId: TEST_BUDGET_ITEM_ID,
					impactId: "impact-cm-1",
					impactType: "CONSUMPTION",
					status: "PENDING_APPROVAL",
					amount: 15000,
					availableBalance: 0,
					projectedBalance: -5000,
				},
			],
		});
		approvalRequestFindFirst.mockResolvedValueOnce({ id: "req-cm-1" });
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/measurements`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						number: 1,
						date: "2026-06-15",
						title: "Medicao Teste",
						items: [
							{
								serviceId: SERVICE_ID,
								measuredValue: 12500,
								accumulatedValue: 15000,
							},
						],
					}),
				},
			),
		);

		expect(response.status).toBe(422);
		const body = await response.json();
		expect(body.message).toContain("saldo");
		expect(cmBudgetApprove).not.toHaveBeenCalled();
	});

	it("POST - item acima do saldo (ADMIN) bloqueia", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "ADMIN",
		}));
		getServiceTotals.mockImplementation(async () => ({
			[SERVICE_ID]: 10000,
		}));
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/measurements`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						number: 1,
						date: "2026-06-15",
						title: "Medicao Teste",
						items: [
							{
								serviceId: SERVICE_ID,
								measuredValue: 12500,
								accumulatedValue: 15000,
							},
						],
					}),
				},
			),
		);

		expect(response.status).toBe(422);
		const body = await response.json();
		expect(body.message).toContain("saldo");
		expect(cmBudgetApprove).not.toHaveBeenCalled();
	});

	it("POST - item acima do saldo (ADMIN) nao grava medicao", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "ADMIN",
		}));
		getServiceTotals.mockImplementation(async () => ({
			[SERVICE_ID]: 10000,
		}));
		cmBudgetApply.mockResolvedValueOnce({
			status: "PENDING_APPROVAL",
			requiresApproval: true,
			availableBalance: 0,
			projectedBalance: -5000,
			allocations: [
				{
					budgetItemId: TEST_BUDGET_ITEM_ID,
					impactId: "impact-cm-1",
					impactType: "CONSUMPTION",
					status: "PENDING_APPROVAL",
					amount: 15000,
					availableBalance: 0,
					projectedBalance: -5000,
				},
			],
		});
		auditLogCreate.mockClear();
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/measurements`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						number: 1,
						date: "2026-06-15",
						title: "Medicao Teste",
						items: [
							{
								serviceId: SERVICE_ID,
								measuredValue: 12500,
								accumulatedValue: 15000,
							},
						],
					}),
				},
			),
		);

		expect(response.status).toBe(422);
		const body = await response.json();
		expect(body.message).toContain("saldo");
		expect(auditLogCreate).not.toHaveBeenCalled();
		expect(cmBudgetApprove).not.toHaveBeenCalled();
	});

	it("POST - item dentro do saldo cria medicao", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "GERENTE",
		}));
		getServiceTotals.mockImplementation(async () => ({
			[SERVICE_ID]: 50000,
		}));
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/measurements`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						number: 1,
						date: "2026-06-15",
						title: "Medicao Teste",
						items: [
							{
								serviceId: SERVICE_ID,
								measuredValue: 12500,
								accumulatedValue: 12500,
							},
						],
					}),
				},
			),
		);

		expect(response.status).toBe(200);
	});

	it("POST - item sem cobertura orcamentaria ao lado de item coberto -> 422 CONTRACT_BUDGET_COVERAGE_MISSING", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "GERENTE",
		}));
		getServiceTotals.mockImplementation(async () => ({
			[SERVICE_ID]: 50000,
			"e2e-cs-2": 30000,
		}));
		getServiceBudgetItems.mockImplementation(
			async () =>
				new Map([
					[SERVICE_ID, { budgetItemId: TEST_BUDGET_ITEM_ID, totalCost: 50000 }],
				]),
		);
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/measurements`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						number: 1,
						date: "2026-06-15",
						title: "Medicao Teste",
						items: [
							{
								serviceId: SERVICE_ID,
								measuredValue: 12500,
								accumulatedValue: 12500,
							},
							{
								serviceId: "e2e-cs-2",
								measuredValue: 30000,
								accumulatedValue: 30000,
							},
						],
					}),
				},
			),
		);

		expect(response.status).toBe(422);
		const body = await response.json();
		expect(body.message).toContain("Sem cobertura orcamentaria vigente");
		expect(body.message).toContain("e2e-cs-2");
	});

	it("POST - item sem nenhum valor medido -> 422 INVALID_MEASUREMENT_ITEM", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "GERENTE",
		}));
		getServiceTotals.mockImplementation(async () => ({
			[SERVICE_ID]: 50000,
		}));
		getServiceBudgetItems.mockImplementation(
			async () =>
				new Map([
					[SERVICE_ID, { budgetItemId: TEST_BUDGET_ITEM_ID, totalCost: 50000 }],
				]),
		);
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/measurements`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						number: 1,
						date: "2026-06-15",
						title: "Medicao Teste",
						items: [{ serviceId: SERVICE_ID }],
					}),
				},
			),
		);

		expect(response.status).toBe(422);
		const body = await response.json();
		expect(body.message).toContain("Item de medicao sem valor");
	});

	it("POST - valor acima do saldo (GERENTE) bloqueia", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "GERENTE",
		}));
		getServiceTotals.mockImplementation(async () => ({
			[SERVICE_ID]: 10000,
		}));
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/measurements`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						number: 1,
						date: "2026-06-15",
						title: "Medicao Teste",
						items: [
							{
								serviceId: SERVICE_ID,
								measuredValue: 15000,
							},
						],
					}),
				},
			),
		);

		expect(response.status).toBe(422);
		const body = await response.json();
		expect(body.message).toContain("saldo");
	});

	it("POST - percentual fora da escala (150) -> 400 INVALID_INPUT", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "GERENTE",
		}));
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/measurements`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						number: 1,
						date: "2026-06-15",
						title: "Medicao Teste",
						items: [
							{
								serviceId: SERVICE_ID,
								measuredQuantity: 5,
								measuredValue: 25000,
								measuredPercentage: 150,
							},
						],
					}),
				},
			),
		);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.message).toBe("Dados invalidos");
	});

	it("POST - data fora do periodo do contrato retorna warning", async () => {
		getServiceTotals.mockImplementation(async () => ({
			[SERVICE_ID]: 50000,
		}));
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/measurements`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						number: 1,
						date: "2027-06-15",
						title: "Medicao Teste",
						items: [
							{
								serviceId: SERVICE_ID,
								measuredValue: 12500,
								accumulatedValue: 12500,
							},
						],
					}),
				},
			),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.warnings).toEqual([
			expect.objectContaining({ code: "MEASUREMENT_DATE_OUT_OF_PERIOD" }),
		]);
	});

	it("PATCH - balanceOverride e ignorado como campo publico", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "ADMIN",
		}));
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/measurements/e2e-cm-1`,
				{
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						title: "Atualizada",
						balanceOverride: true,
					}),
				},
			),
		);

		expect(response.status).toBe(200);
	});

	it("PATCH - evidenceNote e ignorado como campo publico", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/measurements/e2e-cm-1`,
				{
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						title: "Atualizada",
						evidenceNote: "Nota publica ignorada",
					}),
				},
			),
		);

		expect(response.status).toBe(200);
	});

	it("PATCH - update com items audita exatamente uma vez via service", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "GERENTE",
		}));
		getServiceTotals.mockImplementation(async () => ({
			[SERVICE_ID]: 50000,
		}));
		auditLogCreate.mockClear();
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/measurements/e2e-cm-1`,
				{
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						title: "Atualizada",
						items: [
							{
								serviceId: SERVICE_ID,
								measuredValue: 12500,
							},
						],
					}),
				},
			),
		);

		expect(response.status).toBe(200);
		expect(auditLogCreate).toHaveBeenCalledTimes(1);
		expect(auditLogCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({
				action: "UPDATE",
				entityType: "CONTRACT_MEASUREMENT",
				previousState: expect.objectContaining({
					items: expect.any(Array),
				}),
				newState: expect.objectContaining({
					items: expect.any(Array),
				}),
			}),
		});
	});

	it("GET /construction/works/:workId/contracts/:contractId/measurements/map - mapa hierarquico", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/measurements/map`,
			),
		);

		expect(response.status).toBeLessThan(500);
	});
});
