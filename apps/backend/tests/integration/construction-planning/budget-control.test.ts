import { describe, expect, it, mock } from "bun:test";
import { ConstructionError } from "../../../src/lib/errors";
import {
	assertJsonResponse,
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

const constructionWorkFindUnique = mock(
	async (): Promise<{ id: string; costCenterId: string } | null> => ({
		id: TEST_WORK_ID,
		costCenterId: TEST_CC_ID,
	}),
);

const balanceFixture = (overrides: Record<string, unknown> = {}) => ({
	budgetItemId: TEST_BUDGET_ITEM_ID,
	limit: 50000,
	approvedCommitted: 10000,
	approvedConsumed: 5000,
	pendingImpact: 2500,
	availableBalance: 32500,
	projectedBalance: 30000,
	...overrides,
});

const getAvailability = mock(async () => [balanceFixture()]);

const preview = mock(async () => ({
	items: [balanceFixture()],
	totalImpact: 20000,
	requiresApproval: false,
}));

mock.module("../../../src/lib/auth-middleware", () => ({ getSessionUser }));

mock.module("../../../src/lib/prisma", () => ({
	prisma: {
		user: {
			findUnique: mock(async () => ({ role: "GERENTE" })),
		},
		constructionWork: { findUnique: constructionWorkFindUnique },
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
	},
}));

mock.module(
	"../../../src/modules/construction-planning/budget-control/budget-control.service",
	() => ({
		budgetControlService: { getAvailability, preview },
	}),
);

describe("Budget control routes E2E", () => {
	it("GET availability - campos exatos do saldo", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/budget/availability?budgetItemIds=${TEST_BUDGET_ITEM_ID},item-2`,
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toHaveLength(1);
		expect(body[0]).toEqual({
			budgetItemId: TEST_BUDGET_ITEM_ID,
			limit: 50000,
			approvedCommitted: 10000,
			approvedConsumed: 5000,
			pendingImpact: 2500,
			availableBalance: 32500,
			projectedBalance: 30000,
		});
		expect(getAvailability).toHaveBeenCalledWith(TEST_OWNER, TEST_WORK_ID, [
			TEST_BUDGET_ITEM_ID,
			"item-2",
		]);
	});

	it("GET availability - sem ids retorna lista vazia", async () => {
		getAvailability.mockResolvedValueOnce([]);
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/budget/availability`,
			),
		);

		assertJsonResponse(response, 200);
		expect(await response.json()).toEqual([]);
		expect(getAvailability).toHaveBeenCalledWith(TEST_OWNER, TEST_WORK_ID, []);
	});

	it("GET availability - obra inexistente retorna 404", async () => {
		constructionWorkFindUnique.mockResolvedValueOnce(null);
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/obra-desconhecida/budget/availability`,
			),
		);

		assertJsonResponse(response, 404);
	});

	it("GET availability - item de outra obra mapeia 422", async () => {
		getAvailability.mockRejectedValueOnce(
			new ConstructionError(
				"BUDGET_ITEM_WRONG_WORK",
				"Item de orçamento não pertence à obra informada",
				422,
			),
		);
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/budget/availability?budgetItemIds=item-9`,
			),
		);

		assertJsonResponse(response, 422);
		const body = await response.json();
		expect(body.message).toContain("Item de orçamento não pertence");
	});

	it("POST preview - campos exatos da previsao", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/budget/preview`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						allocations: [{ budgetItemId: TEST_BUDGET_ITEM_ID, value: 20000 }],
					}),
				},
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body.totalImpact).toBe(20000);
		expect(body.requiresApproval).toBe(false);
		expect(body.items[0]).toEqual({
			budgetItemId: TEST_BUDGET_ITEM_ID,
			limit: 50000,
			approvedCommitted: 10000,
			approvedConsumed: 5000,
			pendingImpact: 2500,
			availableBalance: 32500,
			projectedBalance: 30000,
		});
		expect(preview).toHaveBeenCalledWith(TEST_OWNER, TEST_WORK_ID, {
			allocations: [{ budgetItemId: TEST_BUDGET_ITEM_ID, value: 20000 }],
		});
	});

	it("POST preview - sem alocacoes retorna 400", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/budget/preview`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ allocations: [] }),
				},
			),
		);

		assertJsonResponse(response, 400);
	});

	it("POST preview - percentual sem valor total retorna 400", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/budget/preview`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						allocations: [
							{ budgetItemId: TEST_BUDGET_ITEM_ID, percentage: 50 },
						],
					}),
				},
			),
		);

		assertJsonResponse(response, 400);
	});

	it("POST preview - orcamento indisponivel mapeia 422", async () => {
		preview.mockRejectedValueOnce(
			new ConstructionError(
				"BUDGET_VERSION_NOT_AVAILABLE",
				"Nenhuma versão de orçamento ativa com itens para a obra",
				422,
			),
		);
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/budget/preview`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						allocations: [{ budgetItemId: TEST_BUDGET_ITEM_ID, value: 10 }],
					}),
				},
			),
		);

		assertJsonResponse(response, 422);
		const body = await response.json();
		expect(body.message).toContain("versão de orçamento");
	});
});
