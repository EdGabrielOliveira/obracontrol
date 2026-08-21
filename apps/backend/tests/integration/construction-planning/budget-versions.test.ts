import { beforeEach, describe, expect, it, mock } from "bun:test";
import { assertJsonResponse, TEST_OWNER, TEST_WORK_ID } from "./setup";

const getSessionUser = mock(async () => ({
	id: TEST_OWNER,
	email: "teste@obra.bi",
	name: "Usuario Teste",
	role: "SUPERVISOR",
}));

mock.module("../../../src/lib/auth-middleware", () => ({ getSessionUser }));

const budgetVersionFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => ({
		id: "version-1",
		ownerId: TEST_OWNER,
		workId: TEST_WORK_ID,
		versionNumber: 1,
		label: "Baseline",
		status: "VIGENTE",
		isActive: true,
	}),
);
const budgetVersionItemFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => ({
		id: "vitem-1",
		identityId: "identity-1",
	}),
);
const budgetVersionFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const budgetVersionFindUnique = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const budgetVersionCount = mock(async () => 0);
const budgetVersionCreate = mock(
	async (_args: { data: Record<string, unknown> }) => ({}),
);
const budgetVersionUpdate = mock(
	async (_args: { data: Record<string, unknown> }) => ({}),
);
const importBatchFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const budgetVersionItemFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const approvalRequestFindUnique = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const approvalRequestCreate = mock(async () => ({
	id: "approval-1",
	status: "PENDING",
}));
const approvalPolicyFindMany = mock(async () => []);
const notificationCreate = mock(async () => ({
	id: "notif-1",
	createdAt: new Date(),
}));
const notificationFindUnique = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const budgetProjectionStateUpsert = mock(async () => ({}));
const budgetProjectionOutboxUpsert = mock(async () => ({}));

mock.module("../../../src/lib/prisma", () => ({
	prisma: {
		user: {
			findUnique: mock(async () => ({ role: "SUPERVISOR" })),
			findMany: mock(async () => []),
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
		budgetVersion: {
			findFirst: budgetVersionFindFirst,
			findMany: budgetVersionFindMany,
			findUnique: budgetVersionFindUnique,
			count: budgetVersionCount,
			create: budgetVersionCreate,
			update: budgetVersionUpdate,
		},
		budgetVersionItem: {
			findFirst: budgetVersionItemFindFirst,
			findMany: budgetVersionItemFindMany,
		},
		approvalRequest: {
			findUnique: approvalRequestFindUnique,
			create: approvalRequestCreate,
		},
		approvalPolicy: { findMany: approvalPolicyFindMany },
		notification: {
			create: notificationCreate,
			findUnique: notificationFindUnique,
		},
		importBatch: { findFirst: importBatchFindFirst },
		budgetProjectionState: { upsert: budgetProjectionStateUpsert },
		budgetProjectionOutbox: { upsert: budgetProjectionOutboxUpsert },
		$transaction: mock(async (callback: (tx: unknown) => Promise<unknown>) =>
			callback({
				budgetVersion: {
					count: budgetVersionCount,
					create: budgetVersionCreate,
					update: budgetVersionUpdate,
					findFirst: budgetVersionFindFirst,
				},
				budgetVersionItem: {
					findMany: budgetVersionItemFindMany,
					create: mock(async () => ({})),
					update: mock(async () => ({})),
				},
				constructionWork: {
					findFirst: mock(async () => ({
						ownerId: TEST_OWNER,
					})),
				},
				budgetProjectionState: { upsert: budgetProjectionStateUpsert },
				budgetProjectionOutbox: {
					updateMany: mock(async () => ({ count: 0 })),
				},
			}),
		),
	},
}));

describe("Budget version routes E2E", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		budgetVersionFindFirst.mockResolvedValue({
			id: "version-1",
			ownerId: TEST_OWNER,
			workId: TEST_WORK_ID,
			versionNumber: 1,
			label: "Baseline",
			status: "VIGENTE",
			isActive: true,
		});
		budgetVersionItemFindFirst.mockResolvedValue({
			id: "vitem-1",
			identityId: "identity-1",
		});
		budgetVersionFindUnique.mockResolvedValue(null);
		budgetVersionItemFindMany.mockResolvedValue([]);
		approvalRequestFindUnique.mockResolvedValue(null);
		approvalPolicyFindMany.mockResolvedValue([]);
		notificationFindUnique.mockResolvedValue(null);
		approvalRequestCreate.mockImplementation(async () => ({
			id: "approval-1",
			status: "PENDING",
		}));
		importBatchFindFirst.mockResolvedValue(null);
	});

	it("GET /budget-versions resolve a versao efetiva", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/budget-versions`,
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toMatchObject({
			budgetVersionId: "version-1",
			mode: "EFFECTIVE",
		});
	});

	it("GET /budget-versions/items/:index/reference devolve referencia canonica", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/budget-versions/items/1.1/reference`,
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toEqual({
			identityId: "identity-1",
			versionItemId: "vitem-1",
			versionId: "version-1",
		});
	});

	it("POST /budget-versions/draft cria aditivo em rascunho", async () => {
		budgetVersionFindFirst.mockResolvedValue({
			id: "version-1",
			ownerId: TEST_OWNER,
			workId: TEST_WORK_ID,
			versionNumber: 1,
			label: "Baseline",
			status: "VIGENTE",
			isActive: true,
		});
		budgetVersionItemFindMany.mockResolvedValue([
			{
				id: "vitem-1",
				identityId: "identity-1",
				parentVersionId: null,
				index: "1",
				type: "STAGE",
				description: "Etapa 1",
				unit: null,
				quantity: null,
				unitCost: null,
				totalCost: 1000,
				sortOrder: 1,
			},
		]);
		budgetVersionCount.mockResolvedValue(1);
		budgetVersionCreate.mockImplementation(
			async (args: { data: Record<string, unknown> }) => ({
				id: "version-2",
				...args.data,
			}),
		);

		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/budget-versions/draft`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						label: "Aditivo 1",
						itemOverrides: [{ index: "1", totalCost: 1200 }],
					}),
				},
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toEqual({
			id: "version-2",
			index: "2",
			label: "Aditivo 1",
			version: 2,
			status: "DRAFT",
			sourceVersionId: "version-1",
			kind: "ACRESCIMO",
			acrescimoBruto: 200,
			supressao: 0,
			impactoLiquido: 200,
			percentualImpacto: 20,
		});
	});

	it("POST /budget-versions/:versionId/submit submete rascunho para aprovacao", async () => {
		budgetVersionFindUnique.mockResolvedValue({
			id: "version-2",
			workId: TEST_WORK_ID,
			versionNumber: 2,
			label: "Aditivo 1",
			status: "RASCUNHO",
			isActive: false,
			approvalRequestId: null,
			reason: null,
			submittedAt: null,
		});
		budgetVersionUpdate.mockImplementation(
			async (args: { data: Record<string, unknown> }) => ({
				id: "version-2",
				...args.data,
			}),
		);

		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/budget-versions/version-2/submit`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ reason: "Aditivo de servicos" }),
				},
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toEqual({
			budgetVersionId: "version-2",
			status: "PENDING",
			approvalRequestId: "approval-1",
		});
		expect(approvalRequestCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					resourceType: "BUDGET_VERSION",
					resourceId: TEST_WORK_ID,
					effectAction: "BUDGET_VERSION_ACTIVATE",
					payloadJson: {
						workId: TEST_WORK_ID,
						budgetVersionId: "version-2",
					},
					expectedVersion: 2,
					idempotencyKey: "budget-version-submit:version-2",
					status: "PENDING",
				}),
			}),
		);
	});

	it("GET /budget-versions/history lista versoes com status mapeado", async () => {
		budgetVersionFindMany.mockResolvedValue([
			{
				id: "version-1",
				workId: TEST_WORK_ID,
				versionNumber: 1,
				label: "Baseline",
				status: "VIGENTE",
				isActive: true,
				sourceVersionId: null,
				approvalRequestId: null,
				submittedAt: null,
				reason: null,
			},
			{
				id: "version-2",
				workId: TEST_WORK_ID,
				versionNumber: 2,
				label: "Aditivo 1",
				status: "RASCUNHO",
				isActive: false,
				sourceVersionId: "version-1",
				approvalRequestId: "approval-1",
				submittedAt: null,
				reason: "Aditivo de servicos",
			},
		]);

		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/budget-versions/history`,
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toHaveLength(2);
		expect(body[0]).toMatchObject({
			id: "version-1",
			version: 1,
			label: "Baseline",
			status: "ACTIVE",
			isActive: true,
		});
		expect(body[1]).toMatchObject({
			id: "version-2",
			version: 2,
			label: "Aditivo 1",
			status: "PENDING_APPROVAL",
			isActive: false,
		});
	});

	it("GET /budget-versions/:versionId devolve detalhe com itens e totais", async () => {
		budgetVersionFindUnique.mockResolvedValue({
			id: "version-1",
			workId: TEST_WORK_ID,
			versionNumber: 1,
			label: "Baseline",
			status: "VIGENTE",
			isActive: true,
			sourceVersionId: null,
			approvalRequestId: null,
			submittedAt: null,
		});
		budgetVersionItemFindMany.mockResolvedValue([
			{
				id: "vitem-1",
				identityId: "identity-1",
				parentVersionId: null,
				index: "1",
				type: "STAGE",
				description: "Etapa 1",
				unit: null,
				quantity: null,
				unitCost: null,
				totalCost: 1000,
				sortOrder: 1,
			},
		]);

		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/budget-versions/version-1`,
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toMatchObject({
			id: "version-1",
			version: 1,
			label: "Baseline",
			status: "ACTIVE",
			totals: { totalCost: 1000 },
			items: [
				{
					id: "vitem-1",
					index: "1",
					parentIndex: null,
					totalCost: 1000,
				},
			],
		});
	});

	it("GET /budget-versions/imports/:importId devolve preview imutavel paginado e filtrado", async () => {
		importBatchFindFirst.mockResolvedValue({
			id: "batch-1",
			ownerId: TEST_OWNER,
			workId: TEST_WORK_ID,
			title: "Aditivo 1",
			status: "READY",
			preview: {
				role: "ADITIVO",
				sourceVersionId: "version-1",
				comparison: {
					sourceTotal: 500,
					candidateTotal: 600,
					grossIncrease: 100,
					suppression: 0,
					netImpact: 100,
					impactPercent: 20,
					countsByClassification: {
						UNCHANGED: 0,
						INCREASED: 1,
						DECREASED: 0,
						ADDED: 0,
						REMOVED: 1,
						STRUCTURE_CHANGED: 0,
						SCHEDULE_CHANGED: 0,
					},
					blockingIssues: [],
					rows: [
						{
							itemIndex: "1.1",
							parentIndex: "1",
							level: "ITEM",
							description: "Removido",
							classification: ["REMOVED"],
							previous: null,
							candidate: null,
							delta: {
								quantity: 0,
								unitCost: 0,
								totalCost: 0,
								plannedStartDays: 0,
								plannedEndDays: 0,
								plannedDurationDays: 0,
							},
							validation: { valid: true, violations: [] },
						},
						{
							itemIndex: "1.2",
							parentIndex: "1",
							level: "ITEM",
							description: "Aumentado",
							classification: ["INCREASED"],
							previous: null,
							candidate: null,
							delta: {
								quantity: 0,
								unitCost: 0,
								totalCost: 100,
								plannedStartDays: 0,
								plannedEndDays: 0,
								plannedDurationDays: 0,
							},
							validation: { valid: true, violations: [] },
						},
					],
				},
			},
		});

		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/budget-versions/imports/batch-1?classification=REMOVED&page=1&limit=1`,
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toMatchObject({
			importId: "batch-1",
			title: "Aditivo 1",
			role: "ADITIVO",
			sourceVersionId: "version-1",
			conflicts: [],
		});
		expect(body.changes).toMatchObject({
			page: 1,
			limit: 1,
			total: 1,
		});
		expect(body.changes.data).toHaveLength(1);
		expect(body.changes.data[0]).toMatchObject({
			itemIndex: "1.1",
			classification: ["REMOVED"],
		});
	});

	it("POST /imports/:importId/confirm aceita Idempotency-Key e reexecuta sem duplicar", async () => {
		importBatchFindFirst.mockResolvedValueOnce({
			id: "batch-1",
			ownerId: TEST_OWNER,
			workId: TEST_WORK_ID,
			title: "Aditivo 1",
			status: "CONFIRMED",
			confirmedImportId: "version-2",
			parsedWorkbook: {},
		});
		budgetVersionFindFirst.mockResolvedValueOnce({
			id: "version-2",
			ownerId: TEST_OWNER,
			workId: TEST_WORK_ID,
			versionNumber: 2,
			label: "Aditivo 1",
			status: "RASCUNHO",
			isActive: false,
			sourceVersionId: "version-1",
			kind: null,
			acrescimoBruto: null,
			supressao: null,
			impactoLiquido: null,
			percentualImpacto: null,
		});

		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/budget-versions/imports/batch-1/confirm`,
				{
					method: "POST",
					headers: {
						"content-type": "application/json",
						"idempotency-key": "key-1",
					},
					body: JSON.stringify({ expectedSourceVersionId: "version-1" }),
				},
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toMatchObject({
			id: "version-2",
			version: 2,
			label: "Aditivo 1",
		});
	});
});
