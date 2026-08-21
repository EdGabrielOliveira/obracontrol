import { describe, expect, it, mock } from "bun:test";
import { assertJsonResponse, TEST_OWNER, TEST_WORK_ID } from "./setup";

const getSessionUser = mock(async () => ({
	id: TEST_OWNER,
	email: "teste@obra.bi",
	name: "Usuario Teste",
	role: "GERENTE",
}));

mock.module("../../../src/lib/auth-middleware", () => ({ getSessionUser }));
mock.module("../../../src/lib/prisma", () => ({
	prisma: {
		auditLog: { create: mock(async () => ({ id: "audit-1" })) },
		user: {
			findUnique: mock(async () => ({ role: "GERENTE" })),
		},
		constructionWork: {
			findUnique: mock(async () => ({
				id: TEST_WORK_ID,
				costCenterId: "cc-1",
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
		organizationMembership: {
			findMany: mock(async () => [{ organizationId: "org-1" }]),
		},
		costCenterMembership: {
			findMany: mock(async () => [{ costCenterId: "cc-1" }]),
		},
		workMembership: {
			findMany: mock(async () => []),
		},
		constructionBudgetItem: {
			findUnique: mock(async () => ({
				id: "item-1",
				index: "1.1",
				description: "Item Teste",
			})),
		},
	},
}));

const importBudget = mock(async () => ({
	workId: TEST_WORK_ID,
	importId: "import-1",
	processedSheets: ["Orcamento"],
	importedCount: 5,
	rejectedCount: 0,
	rowCount: 5,
	imported: 5,
	warningCount: 0,
	warnings: [],
	errors: [],
	importedSections: ["Orcamento"],
}));

mock.module(
	"../../../src/modules/construction-planning/budget.service",
	() => ({
		budgetService: {
			getBudget: mock(async () => ({
				work: { id: TEST_WORK_ID, code: "E2E-001" },
				items: [{ id: "item-1", index: "1.1" }],
				summary: { totalBudgeted: 1000 },
				schedule: { months: [] },
				physicalFinancial: { stages: [] },
			})),
			getBudgetItem: mock(async () => ({
				item: { id: "item-1", index: "1.1" },
				parent: null,
				children: [],
				totals: {
					budgeted: 1000,
					measuredCurrent: 100,
					measuredAccumulated: 250,
				},
			})),
			createItem: mock(async () => ({ id: "item-new" })),
			updateItem: mock(async () => ({ id: "item-1" })),
			deleteItem: mock(async () => ({ id: "item-1" })),
			reorderItems: mock(async () => ({ count: 2 })),
			importBudget,
		},
	}),
);

describe("Budget routes E2E", () => {
	it("GET /construction/works/:workId/budget - visao completa do orcamento", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(`http://localhost/construction/works/${TEST_WORK_ID}/budget`),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toHaveProperty("work");
		expect(body).toHaveProperty("items");
		expect(body).toHaveProperty("summary");
	});

	it("GET /construction/works/:workId/budget/items/:itemId - detalhe do item", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/budget/items/item-1`,
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toHaveProperty("item");
		expect(body).toHaveProperty("children");
		expect(body).toHaveProperty("totals");
	});

	it("POST /construction/works/:workId/budget/items - cria item manual", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/budget/items`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						index: "1.1",
						type: "ITEM",
						description: "Escavacao",
					}),
				},
			),
		);

		assertJsonResponse(response, 201);
	});

	it("PUT /construction/works/:workId/budget/import - substitui orcamento ativo com resposta consolidada", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const form = new FormData();
		form.append(
			"file",
			new File([new Uint8Array([1])], "orcamento.xlsx", {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
		);
		form.append("sheetName", "Orcamento");
		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/budget/import`,
				{
					method: "PUT",
					body: form,
				},
			),
		);

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body).toMatchObject({
			workId: TEST_WORK_ID,
			importId: "import-1",
			processedSheets: ["Orcamento"],
			importedCount: 5,
			rejectedCount: 0,
			warnings: [],
			errors: [],
		});
	});

	it("PATCH /construction/works/:workId/budget/items/reorder - reordena itens", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/budget/items/reorder`,
				{
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						items: [{ id: "item-1", sortOrder: 3 }],
					}),
				},
			),
		);

		assertJsonResponse(response, 200);
	});

	it("PUT /construction/works/:workId/budget/import - retorna 200 com sucesso parcial quando ha erros por linha", async () => {
		importBudget.mockResolvedValueOnce({
			workId: TEST_WORK_ID,
			importId: "import-1",
			processedSheets: ["Orcamento"],
			importedCount: 4,
			rejectedCount: 1,
			rowCount: 4,
			imported: 4,
			warningCount: 0,
			warnings: [],
			errors: [
				{
					row: 3,
					sheet: "Orcamento",
					field: "Tipo",
					code: "MISSING_REQUIRED_FIELD",
					message: "Tipo obrigatorio",
				},
			],
			importedSections: ["Orcamento"],
		} as never);
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const form = new FormData();
		form.append(
			"file",
			new File([new Uint8Array([1])], "orcamento.xlsx", {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
		);
		form.append("sheetName", "Orcamento");
		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/budget/import`,
				{
					method: "PUT",
					body: form,
				},
			),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toMatchObject({
			workId: TEST_WORK_ID,
			importedCount: 4,
			rejectedCount: 1,
			errors: [
				expect.objectContaining({
					row: 3,
					field: "Tipo",
					code: "MISSING_REQUIRED_FIELD",
				}),
			],
		});
	});
});
