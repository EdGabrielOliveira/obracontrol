import { beforeEach, describe, expect, it, mock } from "bun:test";
import Decimal from "decimal.js";
import { assertJsonResponse, TEST_OWNER, TEST_WORK_ID } from "./setup";

const getSessionUser = mock(async () => ({
	id: TEST_OWNER,
	email: "teste@obra.bi",
	name: "Usuario Teste",
	role: "GERENTE",
}));

mock.module("../../../src/lib/auth-middleware", () => ({ getSessionUser }));
mock.module("../../../src/modules/governance/approval.service", () => ({
	submitApproval: mock(async () => ({
		status: "PENDING",
		approvalRequestId: "approval-1",
		data: null,
	})),
}));

const contractRequestCreate = mock(
	async (args: {
		data: Record<string, unknown>;
	}): Promise<Record<string, unknown>> => ({
		id: "request-1",
		status: "EM_ESPERA",
		...args.data,
	}),
);
const contractRequestFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const proposalFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const proposalFindFirst = mock(async () => ({ id: "proposal-1" }));
const supplierFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const workSupplierFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const budgetVersionFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => ({
		id: "version-1",
	}),
);
const budgetVersionItemFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const budgetItemFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const identityFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const contractCreate = mock(async (): Promise<Record<string, unknown>> => ({}));
const contractCount = mock(async () => 0);
const contractFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const contractServiceCreate = mock(
	async (): Promise<Record<string, unknown>> => ({}),
);
const requestUpdate = mock(async () => ({}));
const requestUpdateMany = mock(async () => ({ count: 1 }));
const transactionMock = mock(
	async (callback: (tx: Record<string, unknown>) => Promise<unknown>) =>
		callback({
			contractRequest: {
				create: contractRequestCreate,
				findFirst: contractRequestFindFirst,
				update: requestUpdate,
			},
			contractRequestProposal: {
				findFirst: mock(async () => ({
					id: "proposal-1",
					batchId: "batch-1",
					normalizedCnpj: "11222333000181",
					supplierName: "Construtora Modelo",
					proposalValue: new Decimal(50_000),
				})),
			},
			constructionSupplier: { findFirst: supplierFindFirst },
			constructionWorkSupplier: { findFirst: workSupplierFindFirst },
			contract: {
				create: contractCreate,
				count: contractCount,
				findFirst: contractFindFirst,
			},
			contractService: { create: contractServiceCreate },
			budgetVersionItem: { findMany: budgetVersionItemFindMany },
			constructionBudgetItem: { findMany: budgetItemFindMany },
			budgetItemIdentity: { findMany: identityFindMany },
			budgetVersion: { findFirst: budgetVersionFindFirst },
		}),
);

mock.module("../../../src/lib/prisma", () => ({
	prisma: {
		user: {
			findUnique: mock(async () => ({ role: "GERENTE" })),
		},
		constructionWork: {
			findUnique: mock(async () => ({
				id: TEST_WORK_ID,
				costCenterId: "cc-1",
			})),
			findFirst: mock(async () => ({
				id: TEST_WORK_ID,
				ownerId: TEST_OWNER,
			})),
		},
		costCenter: {
			findUnique: mock(async () => ({
				id: "cc-1",
				organizationId: "org-1",
			})),
		},
		organization: {
			findUnique: mock(async () => ({
				id: "org-1",
				ownerId: TEST_OWNER,
			})),
		},
		workMembership: {
			findUnique: mock(async () => null),
			findMany: mock(async () => []),
		},
		costCenterMembership: {
			findUnique: mock(async () => null),
			findMany: mock(async () => [{ costCenterId: "cc-1" }]),
		},
		organizationMembership: {
			findUnique: mock(async () => null),
			findMany: mock(async () => [{ organizationId: "org-1" }]),
		},
		contractRequest: {
			findFirst: contractRequestFindFirst,
			updateMany: requestUpdateMany,
		},
		contractRequestProposal: {
			findMany: proposalFindMany,
			findFirst: proposalFindFirst,
		},
		constructionSupplier: { findFirst: supplierFindFirst },
		constructionWorkSupplier: { findFirst: workSupplierFindFirst },
		budgetVersion: { findFirst: budgetVersionFindFirst },
		budgetVersionItem: { findMany: budgetVersionItemFindMany },
		constructionBudgetItem: { findMany: budgetItemFindMany },
		budgetItemIdentity: { findMany: identityFindMany },
		$transaction: transactionMock,
	},
}));

describe("Contract request routes E2E", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		contractRequestFindFirst.mockResolvedValue(null);
		proposalFindMany.mockResolvedValue([]);
		supplierFindFirst.mockResolvedValue(null);
		workSupplierFindFirst.mockResolvedValue(null);
		budgetVersionFindFirst.mockResolvedValue({ id: "version-1" });
		budgetVersionItemFindMany.mockResolvedValue([
			{
				id: "vitem-1",
				identityId: "identity-1",
				quantity: new Decimal(10),
				unitCost: new Decimal(100),
				totalCost: new Decimal(1000),
				description: "Servico",
				unit: "m2",
			},
		]);
		budgetItemFindMany.mockResolvedValue([{ id: "budget-1", index: "1.1" }]);
		identityFindMany.mockResolvedValue([{ id: "identity-1", index: "1.1" }]);
		contractRequestCreate.mockImplementation(
			async (args: { data: Record<string, unknown> }) => ({
				id: "request-1",
				status: "EM_ESPERA",
				...args.data,
				items: [],
			}),
		);
		contractCreate.mockResolvedValue({
			id: "contract-1",
			code: "CT-001",
		});
		contractCount.mockResolvedValue(0);
		contractFindFirst.mockResolvedValue(null);
	});

	it("POST /contract-requests cria solicitacao com itens cobertos", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contract-requests`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						title: "Fundacao",
						serviceType: "Execucao",
						description: "Execucao da fundacao da torre A",
						startDate: "2026-09-01",
						endDate: "2026-10-15",
						items: [{ budgetItemId: "budget-1", quantity: 10 }],
					}),
				},
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toMatchObject({
			id: "request-1",
			status: "EM_ESPERA",
			title: "Fundacao",
			serviceType: "Execucao",
		});
	});

	it("GET /contract-requests/:requestId/comparison devolve totais, propostas e canAccept", async () => {
		contractRequestFindFirst.mockResolvedValue({
			id: "request-1",
			ownerId: TEST_OWNER,
			workId: TEST_WORK_ID,
			title: "Fundacao",
			serviceType: "Execucao",
			description: "Execucao da fundacao da torre A",
			startDate: new Date("2026-09-01"),
			endDate: new Date("2026-10-15"),
			status: "EM_ESPERA",
			confirmedBatchId: "batch-1",
			acceptedProposalId: null,
			acceptedAt: null,
			acceptedBy: null,
			contractId: null,
			createdBy: null,
			items: [
				{
					id: "ri-1",
					ownerId: TEST_OWNER,
					workId: TEST_WORK_ID,
					requestId: "request-1",
					budgetItemId: "budget-1",
					quantity: new Decimal(10),
					sortOrder: 0,
				},
			],
		});
		proposalFindMany.mockResolvedValue([
			{
				id: "proposal-1",
				batchId: "batch-1",
				normalizedCnpj: "11222333000181",
				supplierName: "Construtora Modelo",
				proposalValue: new Decimal(50_000),
				notes: null,
				suggestedWinner: false,
			},
		]);
		supplierFindFirst.mockResolvedValue({ id: "supplier-1" });
		workSupplierFindFirst.mockResolvedValue({ id: "ws-1" });

		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contract-requests/request-1/comparison`,
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body.budget.total).toBe(1000);
		expect(body.selectedItems).toHaveLength(1);
		expect(body.proposals[0].supplier).toMatchObject({
			cnpj: "11222333000181",
			registered: true,
			linked: true,
		});
		expect(body.permissions.canAccept).toBe(true);
	});

	it("POST /contract-requests/:requestId/accept/:proposalId abre aprovacao com Idempotency-Key", async () => {
		contractRequestFindFirst.mockResolvedValue({
			id: "request-1",
			ownerId: TEST_OWNER,
			workId: TEST_WORK_ID,
			title: "Fundacao",
			serviceType: "Execucao",
			description: "Execucao da fundacao da torre A",
			startDate: new Date("2026-09-01"),
			endDate: new Date("2026-10-15"),
			status: "EM_ESPERA",
			confirmedBatchId: "batch-1",
			acceptedProposalId: null,
			acceptedAt: null,
			acceptedBy: null,
			contractId: null,
			createdBy: null,
			items: [
				{
					id: "ri-1",
					ownerId: TEST_OWNER,
					workId: TEST_WORK_ID,
					requestId: "request-1",
					budgetItemId: "budget-1",
					quantity: new Decimal(10),
					sortOrder: 0,
				},
			],
		});
		supplierFindFirst.mockResolvedValue({ id: "supplier-1" });
		workSupplierFindFirst.mockResolvedValue({ id: "ws-1" });

		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contract-requests/request-1/accept/proposal-1`,
				{
					method: "POST",
					headers: {
						"content-type": "application/json",
						"idempotency-key": "accept-1",
					},
				},
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toMatchObject({
			requestId: "request-1",
			status: "PENDING",
			approvalRequestId: "approval-1",
		});
	});
});
