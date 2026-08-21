import { describe, expect, it, mock } from "bun:test";
import Decimal from "decimal.js";
import { ConstructionError } from "../../../src/lib/errors";
import {
	assertJsonResponse,
	assertNoContentResponse,
	makeTestWork,
	TEST_BUDGET_ITEM_ID,
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

const auditLogCreate = mock(async () => ({ id: "audit-1" }));

const getBudgetItemTotals = mock(async () => ({
	[TEST_BUDGET_ITEM_ID]: 50000,
}));

const getBudgetItemConsumption = mock(async () => ({}));

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
		constructionMeasurementCoverage: { count: mock(async () => 0) },
		workMeasurement: {
			findUnique: mock(async () => ({
				id: "e2e-wm-1",
				number: 1,
				title: "Medicao E2E",
			})),
		},
		constructionBudgetItem: {
			findMany: mock(async () => [{ id: TEST_BUDGET_ITEM_ID }]),
			findFirst: mock(async () => ({ index: "1" })),
		},
		budgetVersion: {
			findFirst: mock(async () => ({ id: "v-1", isActive: true })),
		},
		budgetVersionItem: {
			findFirst: mock(async () => ({ id: "vi-1", identityId: "i-1" })),
		},
		governanceRecord: {
			findUnique: mock(async () => null),
			create: mock(async (args: { data: Record<string, unknown> }) => ({
				id: "gov-1",
				...args.data,
			})),
			update: mock(
				async (args: {
					where: { id: string };
					data: Record<string, unknown>;
				}) => ({ id: args.where.id, ...args.data }),
			),
		},
		$transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
			callback({ auditLog: { create: auditLogCreate } }),
	},
}));

mock.module("../../../src/modules/governance/approval.service", () => ({
	submitApproval: mock(async () => ({
		status: "APPROVED",
		approvalRequestId: "req-mock",
	})),
}));

mock.module(
	"../../../src/modules/construction-planning/budget-control/budget-control.repository",
	() => ({
		getBudgetItemReferences: mock(async () => ({
			found: [
				{
					budgetItemId: TEST_BUDGET_ITEM_ID,
					operationalBudgetItemId: TEST_BUDGET_ITEM_ID,
					index: "1.1",
					identityId: "identity-1",
					versionItemId: "version-item-1",
					quantity: new Decimal(100),
					unitCost: new Decimal(500),
				},
			],
			missing: [],
		})),
		findActiveImpactsBySource: mock(async () => []),
		createImpact: mock(async (_tx: unknown, data: Record<string, unknown>) => ({
			id: "impact-1",
			...data,
		})),
		findImpactById: mock(async () => null),
		findImpactByKey: mock(async () => null),
		getBalanceRows: mock(async () => []),
		setImpactStatus: mock(async () => null),
	}),
);

mock.module(
	"../../../src/modules/construction-planning/budget-control/budget-control.service",
	() => ({
		budgetControlService: {
			apply: mock(
				async (
					_ownerId: string,
					_workId: string,
					input: {
						allocations: Array<{ budgetItemId: string; quantity?: number }>;
						allowPending?: boolean;
					},
				) => {
					const quantity = input.allocations[0]?.quantity ?? 0;
					if (quantity > 10 && input.allowPending === false) {
						throw new ConstructionError(
							"BUDGET_BALANCE_EXCEEDED",
							"Saldo orcamentario insuficiente",
							422,
						);
					}
					const pending = quantity > 10;
					return {
						status: pending ? "PENDING_APPROVAL" : "APPROVED",
						requiresApproval: pending,
						availableBalance: 50000,
						projectedBalance: 50000 - quantity * 500,
						allocations: [
							{
								budgetItemId: TEST_BUDGET_ITEM_ID,
								impactId: "impact-1",
								status: pending ? "PENDING_APPROVAL" : "APPROVED",
								amount: quantity * 500,
								availableBalance: 50000,
								projectedBalance: 50000 - quantity * 500,
							},
						],
					};
				},
			),
			replaceSourceImpact: mock(async () => ({
				status: "APPROVED",
				requiresApproval: false,
				availableBalance: 50000,
				projectedBalance: 47500,
				allocations: [
					{
						budgetItemId: TEST_BUDGET_ITEM_ID,
						impactId: "impact-2",
						status: "APPROVED",
						amount: 2500,
						availableBalance: 50000,
						projectedBalance: 47500,
					},
				],
			})),
		},
	}),
);

mock.module("../../../src/modules/construction-planning/repository", () => ({
	getWorkById: mock(async () => makeTestWork()),
	getWorkOrThrow: mock(async () => makeTestWork()),
	findWorkByOwnerAndCode: mock(async () => null),
	getWorkMeasurementsForBI: mock(async () => []),
	createWorkManual: mock(async () => ({ id: TEST_WORK_ID })),
	listWorks: mock(async () => ({ data: [], total: 0, page: 1, limit: 10 })),
	updateWork: mock(async () => ({ id: TEST_WORK_ID })),
	deleteWork: mock(async () => ({ id: TEST_WORK_ID })),
	createMeasurement: mock(async () => ({ id: "m-1" })),
	listMeasurements: mock(async () => []),
	deleteMeasurement: mock(async () => ({ id: "m-1" })),
	createActualCost: mock(async () => ({ id: "ac-1" })),
	listActualCosts: mock(async () => []),
	deleteActualCost: mock(async () => ({ id: "ac-1" })),
	getWorkWithItems: mock(async () => ({ id: TEST_WORK_ID, items: [] })),
	getAllWorksWithItems: mock(async () => []),
	getWorksByCostCenter: mock(async () => []),
	getWorksByOrganization: mock(async () => []),
}));

mock.module(
	"../../../src/modules/construction-planning/work-measurement.repository",
	() => ({
		getWorkMeasurementsForBI: mock(async () => []),
		listWorkMeasurements: mock(async () => ({
			data: [],
			total: 0,
			page: 1,
			limit: 10,
		})),
		getBudgetItemTotals,
		getBudgetItemConsumption,
		getLatestWorkMeasurementQuantities: mock(async () => ({
			[TEST_BUDGET_ITEM_ID]: new Decimal(0),
		})),
		getWorkMeasurementById: mock(async () => ({
			id: "e2e-wm-1",
			ownerId: TEST_OWNER,
			workId: TEST_WORK_ID,
			number: 1,
			date: new Date("2026-06-15"),
			title: "Medicao E2E",
			discountValue: null,
			retentionValue: null,
			createdBy: null,
			notes: null,
			createdAt: new Date(),
			updatedAt: new Date(),
			items: [],
		})),
		getWorkMeasurementDetail: mock(async () => ({
			work: { id: TEST_WORK_ID, code: "E2E-001" },
			measurement: { id: "e2e-wm-1", number: 1 },
			budgetSummary: {
				totalBudgeted: 50000,
				totalMeasured: 12500,
				balanceToMeasure: 37500,
			},
			items: [
				{
					id: "item-1",
					index: "1.1",
					description: "Escavacao",
					quantity: 100,
					totalBudget: 50000,
					measuredCurrent: { quantity: 25, value: 12500, percentage: 25 },
					measuredAccumulated: { quantity: 25, value: 12500, percentage: 25 },
					balanceToMeasure: { quantity: 75, value: 37500, percentage: 75 },
				},
			],
			totals: {
				current: { quantity: 25, value: 12500, percentage: 25 },
				accumulated: { quantity: 25, value: 12500, percentage: 25 },
				balance: { quantity: 75, value: 37500, percentage: 75 },
			},
		})),
		createWorkMeasurement: mock(
			async (
				_ownerId: string,
				_workId: string,
				input: { items: Array<Record<string, unknown>> },
			) => ({
				id: "e2e-wm-1",
				ownerId: TEST_OWNER,
				workId: TEST_WORK_ID,
				number: 1,
				date: new Date("2026-06-15"),
				title: "Medicao Criada",
				discountValue: null,
				retentionValue: null,
				createdBy: null,
				notes: null,
				createdAt: new Date(),
				updatedAt: new Date(),
				items: input.items.map((item) => ({ id: "e2e-wmi-1", ...item })),
			}),
		),
		rollbackWorkMeasurementCreation: mock(async () => undefined),
		updateWorkMeasurement: mock(async () => ({
			id: "e2e-wm-1",
			ownerId: TEST_OWNER,
			workId: TEST_WORK_ID,
			number: 1,
			date: new Date("2026-06-15"),
			title: "Atualizado",
			discountValue: null,
			retentionValue: null,
			createdBy: null,
			notes: null,
			createdAt: new Date(),
			updatedAt: new Date(),
			items: [],
		})),
		deleteWorkMeasurement: mock(async () => ({ id: "e2e-wm-1" })),
		getWorkMeasurementMap: mock(async () => ({
			totalBudgeted: 50000,
			totalMeasured: 0,
			totalMeasuredPercentage: 0,
			balanceToMeasure: 50000,
			balancePercentage: 1,
			stages: [],
		})),
		getWorkMeasurementMapDetail: mock(async () => ({
			work: { id: TEST_WORK_ID, code: "E2E-001" },
			budgetSummary: {
				totalBudgeted: 50000,
				totalMeasured: 12500,
				balanceToMeasure: 37500,
			},
			workMeasurements: [{ id: "e2e-wm-1", totalMeasured: 12500 }],
			contracts: [
				{
					id: "contract-1",
					totalValue: 100000,
					measuredValue: 25000,
					paidValue: 15000,
				},
			],
			contractMeasurements: [
				{ contractId: "contract-1", measurements: [{ id: "cm-1" }] },
			],
			items: [{ id: "item-1", index: "1.1" }],
			totals: { budgeted: 50000, measured: 12500, balance: 37500 },
		})),
		getWorkMeasurementReports: mock(async () => ({
			measurementByStage: [],
			plannedVsMeasured: [],
		})),
		getWorkMeasurementReportById: mock(async () => ({
			work: { id: TEST_WORK_ID, code: "E2E-001" },
			measurement: { id: "e2e-wm-1", number: 1 },
			items: [],
			totals: { measured: 12500, budgeted: 50000 },
		})),
		getWorkMeasurementSummary: mock(async () => ({
			totalMeasured: 0,
			totalMeasuredPercentage: 0,
			totalBudgeted: 50000,
			balanceToMeasure: 50000,
			measurementCount: 0,
			lastMeasurementDate: null,
		})),
	}),
);

describe("WorkMeasurement E2E", () => {
	it("GET /construction/works/:workId/work-measurements - lista medicoes", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/work-measurements`,
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toMatchObject({ data: [], total: 0 });
	});

	it("POST /construction/works/:workId/work-measurements - cria medicao", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/work-measurements`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						date: "2026-06-15",
						title: "Medicao Teste",
						items: [
							{
								budgetItemId: TEST_BUDGET_ITEM_ID,
								measuredQuantity: 25,
							},
						],
					}),
				},
			),
		);

		expect(response.status).toBeLessThan(500);
	});

	it("POST /construction/works/:workId/work-measurements - valida items obrigatorios", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/work-measurements`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						date: "2026-06-15",
						title: "Medicao Teste",
						items: [],
					}),
				},
			),
		);

		expect(response.status).toBe(400);
	});

	it("POST - item acima do saldo sem override -> 422 MEASUREMENT_EXCEEDS_BALANCE", async () => {
		getBudgetItemTotals.mockImplementation(async () => ({
			[TEST_BUDGET_ITEM_ID]: 10000,
		}));
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/work-measurements`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						date: "2026-06-15",
						title: "Medicao Teste",
						items: [
							{
								budgetItemId: TEST_BUDGET_ITEM_ID,
								measuredQuantity: 25,
							},
						],
					}),
				},
			),
		);

		expect(response.status).toBe(422);
		const body = await response.json();
		expect(body.message).toBe("Medicao acima do saldo do item de orcamento");
	});

	it("POST - item acima do saldo restante (consumo existente) -> 422 MEASUREMENT_EXCEEDS_BALANCE", async () => {
		getBudgetItemTotals.mockImplementation(async () => ({
			[TEST_BUDGET_ITEM_ID]: 10000,
		}));
		getBudgetItemConsumption.mockImplementation(async () => ({
			[TEST_BUDGET_ITEM_ID]: 4000,
		}));
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/work-measurements`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						date: "2026-06-15",
						title: "Medicao Teste",
						items: [
							{
								budgetItemId: TEST_BUDGET_ITEM_ID,
								measuredQuantity: 20,
							},
						],
					}),
				},
			),
		);

		expect(response.status).toBe(422);
		const body = await response.json();
		expect(body.message).toBe("Medicao acima do saldo do item de orcamento");
	});

	it("POST - frontend sem accumulatedValue acima do saldo restante -> 422 (gate nao inerte)", async () => {
		getBudgetItemTotals.mockImplementation(async () => ({
			[TEST_BUDGET_ITEM_ID]: 10000,
		}));
		getBudgetItemConsumption.mockImplementation(async () => ({
			[TEST_BUDGET_ITEM_ID]: 4000,
		}));
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/work-measurements`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						date: "2026-06-15",
						title: "Medicao Teste",
						items: [
							{
								budgetItemId: TEST_BUDGET_ITEM_ID,
								measuredQuantity: 20,
							},
						],
					}),
				},
			),
		);

		expect(response.status).toBe(422);
		const body = await response.json();
		expect(body.message).toBe("Medicao acima do saldo do item de orcamento");
	});

	it("POST - accumulatedValue dentro do total (sem consumo) cria medicao", async () => {
		getBudgetItemTotals.mockImplementation(async () => ({
			[TEST_BUDGET_ITEM_ID]: 10000,
		}));
		getBudgetItemConsumption.mockImplementation(async () => ({}));
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/work-measurements`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						date: "2026-06-15",
						title: "Medicao Teste",
						items: [
							{
								budgetItemId: TEST_BUDGET_ITEM_ID,
								measuredQuantity: 10,
							},
						],
					}),
				},
			),
		);

		expect(response.status).toBe(200);
	});

	it("POST - accumulatedValue acima do total -> 422 MEASUREMENT_EXCEEDS_BALANCE", async () => {
		getBudgetItemTotals.mockImplementation(async () => ({
			[TEST_BUDGET_ITEM_ID]: 10000,
		}));
		getBudgetItemConsumption.mockImplementation(async () => ({}));
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/work-measurements`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						date: "2026-06-15",
						title: "Medicao Teste",
						items: [
							{
								budgetItemId: TEST_BUDGET_ITEM_ID,
								measuredQuantity: 25,
							},
						],
					}),
				},
			),
		);

		expect(response.status).toBe(422);
		const body = await response.json();
		expect(body.message).toBe("Medicao acima do saldo do item de orcamento");
	});

	it("POST - override GERENTE acima do saldo -> 403 GOVERNANCE_OVERRIDE_REQUIRED", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "GERENTE",
		}));
		getBudgetItemTotals.mockImplementation(async () => ({
			[TEST_BUDGET_ITEM_ID]: 10000,
		}));
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/work-measurements`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						date: "2026-06-15",
						title: "Medicao Teste",
						balanceOverride: true,
						evidenceNote: "Aprovado pelo gerente",
						items: [
							{
								budgetItemId: TEST_BUDGET_ITEM_ID,
								measuredQuantity: 25,
							},
						],
					}),
				},
			),
		);

		expect(response.status).toBe(403);
		const body = await response.json();
		expect(body.message).toBe(
			"Somente ADMIN pode executar override administrativo",
		);
	});

	it("POST - override ADMIN sem evidenceNote -> 422 OVERRIDE_REASON_REQUIRED", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "ADMIN",
		}));
		getBudgetItemTotals.mockImplementation(async () => ({
			[TEST_BUDGET_ITEM_ID]: 10000,
		}));
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/work-measurements`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						date: "2026-06-15",
						title: "Medicao Teste",
						balanceOverride: true,
						items: [
							{
								budgetItemId: TEST_BUDGET_ITEM_ID,
								measuredQuantity: 25,
							},
						],
					}),
				},
			),
		);

		expect(response.status).toBe(422);
		const body = await response.json();
		expect(body.message).toBe("Nota de evidencia obrigatoria para override");
	});

	it("POST - override ADMIN com evidenceNote grava audit com itens excedentes", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "ADMIN",
		}));
		getBudgetItemTotals.mockImplementation(async () => ({
			[TEST_BUDGET_ITEM_ID]: 10000,
		}));
		auditLogCreate.mockClear();
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/work-measurements`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						date: "2026-06-15",
						title: "Medicao Teste",
						balanceOverride: true,
						evidenceNote: "Aprovado pela diretoria",
						items: [
							{
								budgetItemId: TEST_BUDGET_ITEM_ID,
								measuredQuantity: 25,
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
				entityType: "WORK_MEASUREMENT",
				newState: expect.objectContaining({
					balanceOverride: true,
					evidenceNote: "Aprovado pela diretoria",
				}),
			}),
		});
	});

	it("POST - item dentro do saldo cria medicao", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "GERENTE",
		}));
		getBudgetItemTotals.mockImplementation(async () => ({
			[TEST_BUDGET_ITEM_ID]: 50000,
		}));
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/work-measurements`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						date: "2026-06-15",
						title: "Medicao Teste",
						items: [
							{
								budgetItemId: TEST_BUDGET_ITEM_ID,
								measuredQuantity: 5,
							},
						],
					}),
				},
			),
		);

		expect(response.status).toBe(200);
	});

	it("POST - data fora do periodo da obra -> 422 MEASUREMENT_DATE_OUT_OF_PERIOD", async () => {
		getBudgetItemTotals.mockImplementation(async () => ({
			[TEST_BUDGET_ITEM_ID]: 50000,
		}));
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/work-measurements`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						date: "2027-06-15",
						title: "Medicao Teste",
						items: [
							{
								budgetItemId: TEST_BUDGET_ITEM_ID,
								measuredQuantity: 1,
							},
						],
					}),
				},
			),
		);

		expect(response.status).toBe(422);
		const body = await response.json();
		expect(body.message).toContain("Data da medicao fora do periodo da obra");
		expect(body.message).toContain("permitido:");
	});

	it("PATCH - balanceOverride sem items -> 422 INVALID_MEASUREMENT_OVERRIDE", async () => {
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
				`http://localhost/construction/works/${TEST_WORK_ID}/work-measurements/e2e-wm-1`,
				{
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						balanceOverride: true,
					}),
				},
			),
		);

		expect(response.status).toBe(422);
		const body = await response.json();
		expect(body.message).toBe("Override de medicao exige itens");
	});

	it("PATCH - evidenceNote sem items -> 422 INVALID_MEASUREMENT_OVERRIDE", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/work-measurements/e2e-wm-1`,
				{
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						evidenceNote: "Nota sem itens",
					}),
				},
			),
		);

		expect(response.status).toBe(422);
		const body = await response.json();
		expect(body.message).toBe("Override de medicao exige itens");
	});

	it("PATCH - update com items audita exatamente uma vez via service", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "GERENTE",
		}));
		getBudgetItemTotals.mockImplementation(async () => ({
			[TEST_BUDGET_ITEM_ID]: 50000,
		}));
		auditLogCreate.mockClear();
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/work-measurements/e2e-wm-1`,
				{
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						title: "Atualizada",
						items: [
							{
								budgetItemId: TEST_BUDGET_ITEM_ID,
								measuredQuantity: 5,
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
				entityType: "WORK_MEASUREMENT",
				previousState: expect.objectContaining({ measurementId: "e2e-wm-1" }),
				newState: expect.objectContaining({
					items: expect.any(Array),
				}),
			}),
		});
	});

	it("GET /construction/works/:workId/work-measurements/:id - detalhe medicao", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/work-measurements/e2e-wm-1`,
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toHaveProperty("measurement");
		expect(body).toHaveProperty("budgetSummary");
		expect(body).toHaveProperty("items");
		expect(body).toHaveProperty("totals");
	});

	it("GET /construction/works/:workId/work-measurements/:id/report - relatorio da medicao", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/work-measurements/e2e-wm-1/report`,
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toHaveProperty("measurement");
		expect(body).toHaveProperty("totals");
	});

	it("PATCH /construction/works/:workId/work-measurements/:id - atualiza medicao", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/work-measurements/e2e-wm-1`,
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

	it("DELETE /construction/works/:workId/work-measurements/:id - exclui medicao", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/work-measurements/e2e-wm-1`,
				{
					method: "DELETE",
				},
			),
		);

		assertNoContentResponse(response);
	});

	it("GET /construction/works/:workId/work-measurements/map - mapa hierarquico", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/work-measurements/map`,
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toHaveProperty("workMeasurements");
		expect(body).toHaveProperty("contracts");
		expect(body).toHaveProperty("contractMeasurements");
		expect(body).toHaveProperty("items");
	});

	it("GET /construction/works/:workId/work-measurements/reports - relatorios", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/work-measurements/reports`,
			),
		);

		expect(response.status).toBeLessThan(500);
	});

	it("GET /construction/works/:workId/work-measurements/summary - resumo", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/work-measurements/summary`,
			),
		);

		expect(response.status).toBeLessThan(500);
	});

	it("POST cria medicao somente com quantidade e retorna campos derivados", async () => {
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
				`http://localhost/construction/works/${TEST_WORK_ID}/work-measurements`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						date: "2026-08-04",
						title: "Medicao Quantity First",
						items: [
							{
								budgetItemId: TEST_BUDGET_ITEM_ID,
								measuredQuantity: 5,
							},
						],
					}),
				},
			),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.items[0]).toMatchObject({
			measuredQuantity: 5,
			measuredValue: 2500,
			measuredPercentage: 5,
			impactStatus: "APPROVED",
		});
	});

	it("POST rejeita valor derivado enviado pelo cliente", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/work-measurements`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						date: "2026-08-04",
						title: "Medicao Invalida",
						items: [
							{
								budgetItemId: TEST_BUDGET_ITEM_ID,
								measuredQuantity: 5,
								measuredValue: 1,
							},
						],
					}),
				},
			),
		);

		expect(response.status).toBe(400);
	});

	it("requer autenticacao em todos os endpoints de medicoes", async () => {
		getSessionUser.mockImplementation(async () => {
			throw new (await import("../../../src/lib/errors")).ConstructionError(
				"UNAUTHORIZED",
				"Login obrigatorio",
				401,
			);
		});

		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/work-measurements`,
			),
		);

		expect(response.status).toBe(401);
	});
});
