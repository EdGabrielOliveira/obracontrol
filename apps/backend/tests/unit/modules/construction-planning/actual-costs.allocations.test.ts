import { beforeEach, describe, expect, it, mock } from "bun:test";
import Decimal from "decimal.js";

const getSessionUser = mock(async () => ({ id: "owner-1", role: "GERENTE" }));
const userFindUnique = mock(async () => ({ role: "GERENTE" }));
const auditLogCreate = mock(async () => ({ id: "audit-1" }));
const workFindFirst = mock(async () => ({
	id: "work-1",
	ownerId: "owner-1",
}));
const budgetItemFindMany = mock(async () => [
	{ id: "item-1", index: "1.1" },
	{ id: "item-2", index: "1.2" },
]);
const costCreate = mock(async () => ({
	id: "cost-1",
	workId: "work-1",
	amount: 100,
	allocations: [
		{
			id: "alloc-1",
			actualCostId: "cost-1",
			budgetItemId: "item-1",
			percentage: 50,
			value: 50,
			ownerId: "owner-1",
		},
	],
}));
const costFindMany = mock(async () => []);
const costCount = mock(async () => 0);
const costFindUnique = mock(async () => ({
	id: "cost-1",
	workId: "work-1",
	category: "MATERIAL",
	description: "Custo Teste",
}));
const costFindFirst = mock(async () => ({
	id: "cost-1",
	ownerId: "owner-1",
	workId: "work-1",
	amount: 100,
}));
const costUpdate = mock(async () => ({
	id: "cost-1",
	workId: "work-1",
	amount: 100,
	allocations: [
		{
			id: "alloc-1",
			actualCostId: "cost-1",
			budgetItemId: "item-1",
			percentage: 50,
			value: 50,
			ownerId: "owner-1",
		},
	],
}));
const approvalRequestFindUnique = mock(async () => null);
const approvalRequestCreate = mock(
	async ({ data }: { data: Record<string, unknown> }) => ({
		id: "approval-1",
		...data,
	}),
);
const approvalRequestUpdate = mock(async () => ({}));
const approvalDecisionCreate = mock(async () => ({ id: "decision-1" }));

const identityFindMany = mock(async () => [
	{ id: "identity-1", index: "1.1" },
	{ id: "identity-2", index: "1.2" },
]);
const identityFindFirst = mock(async () => ({
	id: "identity-1",
	index: "1.1",
}));
const versionFindFirst = mock(async () => ({ id: "version-1" }));
const versionItemFindMany = mock(async () => [
	{
		id: "vi-1",
		identityId: "identity-1",
		quantity: new Decimal(20),
		unitCost: new Decimal(100),
	},
	{
		id: "vi-2",
		identityId: "identity-2",
		quantity: new Decimal(20),
		unitCost: new Decimal(100),
	},
]);
const versionItemFindFirst = mock(async () => ({
	id: "vi-1",
	identityId: "identity-1",
	unitCost: new Decimal(100),
}));
const ledgerGroupBy = mock(
	async (): Promise<
		Array<{
			budgetItemIdentityId?: string;
			budgetVersionItemId: string;
			eventType: string;
			sourceType: string;
			_sum: { amount: Decimal };
		}>
	> => [],
);
const ledgerFindUnique = mock(async () => null);
const ledgerCreate = mock(async (args: { data: Record<string, unknown> }) => ({
	id: "ledger-1",
	createdAt: new Date(),
	...args.data,
}));
const impactFindMany = mock(async () => []);
const impactFindFirst = mock(async () => null);
let impactCreateCallCount = 0;
const impactCreate = mock(async (args: { data: Record<string, unknown> }) => {
	impactCreateCallCount += 1;
	return {
		id: `impact-${impactCreateCallCount}`,
		createdAt: new Date(),
		...args.data,
	};
});
const impactUpdate = mock(
	async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
		id: args.where.id,
		...args.data,
	}),
);

const repoCreateActualCost = mock(
	async (
		_ownerId: string,
		_workId: string,
		_importId: string | null,
		_input: Record<string, unknown>,
	) => ({
		id: "cost-1",
		workId: "work-1",
		amount: 100,
		allocations: [
			{
				id: "alloc-1",
				actualCostId: "cost-1",
				budgetItemId: "item-1",
				percentage: 50,
				value: 50,
				ownerId: "owner-1",
			},
		],
	}),
);
const repoUpdateActualCost = mock(async () => ({
	id: "cost-1",
	workId: "work-1",
	amount: 100,
	allocations: [
		{
			id: "alloc-1",
			actualCostId: "cost-1",
			budgetItemId: "item-1",
			percentage: 50,
			value: 50,
			ownerId: "owner-1",
		},
	],
}));

const repoGetActualCostById = mock(
	async (): Promise<Record<string, unknown> | null> => ({
		id: "cost-1",
		ownerId: "owner-1",
		workId: "work-1",
		amount: 100,
		costDate: "2026-01-20T00:00:00.000Z",
		allocations: [
			{
				id: "alloc-1",
				budgetItemId: "item-1",
				percentage: 50,
				value: 50,
			},
		],
	}),
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
			findUnique: mock(async () => null),
			findFirst: impactFindFirst,
			create: impactCreate,
			update: impactUpdate,
		},
		constructionActualCost: {
			findFirst: mock(async () => null),
		},
		approvalRequest: {
			findUnique: approvalRequestFindUnique,
			create: approvalRequestCreate,
			update: approvalRequestUpdate,
		},
		approvalDecision: { create: approvalDecisionCreate },
		contractPayment: { findFirst: mock(async () => null) },
	};
}

mock.module("../../../../src/lib/auth-middleware", () => ({
	getSessionUser,
}));

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		user: { findUnique: userFindUnique },
		auditLog: { create: auditLogCreate },
		constructionWork: {
			findFirst: workFindFirst,
			findUnique: mock(async () => ({
				id: "work-1",
				costCenterId: "cc-1",
			})),
		},
		constructionBudgetItem: {
			findMany: budgetItemFindMany,
			findFirst: mock(async () => ({ id: "item-1" })),
		},
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
			findUnique: mock(async () => null),
			findFirst: impactFindFirst,
			create: impactCreate,
			update: impactUpdate,
		},
		constructionActualCost: {
			create: costCreate,
			findUnique: costFindUnique,
			findFirst: costFindFirst,
			findMany: costFindMany,
			count: costCount,
			update: costUpdate,
		},
		approvalRequest: {
			findUnique: approvalRequestFindUnique,
			create: approvalRequestCreate,
			update: approvalRequestUpdate,
		},
		approvalDecision: { create: approvalDecisionCreate },
		costCenter: {
			findUnique: mock(async () => ({
				id: "cc-1",
				organizationId: "org-1",
			})),
		},
		organization: {
			findUnique: mock(async () => ({
				id: "org-1",
				ownerId: "owner-1",
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
			callback(txOf()),
	},
}));

mock.module("../../../../src/modules/construction-planning/repository", () => ({
	getWorkById: mock(async () => ({ id: "work-1", ownerId: "owner-1" })),
	createMeasurement: mock(async () => ({})),
	listMeasurements: mock(async () => []),
	deleteMeasurement: mock(async () => ({})),
	createActualCost: repoCreateActualCost,
	listActualCosts: mock(async () => []),
	getActualCostById: repoGetActualCostById,
	updateActualCost: repoUpdateActualCost,
	deleteActualCost: mock(async () => ({})),
	getWorkMeasurementsForBI: mock(async () => []),
	getWorkOrThrow: mock(async () => ({ id: "work-1", ownerId: "owner-1" })),
}));

const validCostBody = {
	costDate: "2026-01-20",
	category: "MATERIAL",
	description: "Custo Teste",
	amount: 100,
	costType: "ATUAL",
};

const canonicalCostBody = {
	...validCostBody,
	costType: "CURRENT" as const,
};

const validAllocations = [
	{ budgetItemId: "item-1", percentage: 50 },
	{ budgetItemId: "item-2", percentage: 50 },
];

describe("actual-costs allocations route contract", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		impactCreateCallCount = 0;
		getSessionUser.mockResolvedValue({ id: "owner-1", role: "GERENTE" });
		userFindUnique.mockResolvedValue({ role: "GERENTE" });
		budgetItemFindMany.mockResolvedValue([
			{ id: "item-1", index: "1.1" },
			{ id: "item-2", index: "1.2" },
		]);
		identityFindMany.mockResolvedValue([
			{ id: "identity-1", index: "1.1" },
			{ id: "identity-2", index: "1.2" },
		]);
		versionFindFirst.mockResolvedValue({ id: "version-1" });
		versionItemFindMany.mockResolvedValue([
			{
				id: "vi-1",
				identityId: "identity-1",
				quantity: new Decimal(20),
				unitCost: new Decimal(100),
			},
			{
				id: "vi-2",
				identityId: "identity-2",
				quantity: new Decimal(20),
				unitCost: new Decimal(100),
			},
		]);
		ledgerGroupBy.mockResolvedValue([]);
		ledgerFindUnique.mockResolvedValue(null);
		ledgerCreate.mockReset();
		impactFindMany.mockResolvedValue([]);
		impactFindFirst.mockResolvedValue(null);
		costFindUnique.mockResolvedValue({
			id: "cost-1",
			workId: "work-1",
			category: "MATERIAL",
			description: "Custo Teste",
		});
		repoCreateActualCost.mockResolvedValue({
			id: "cost-1",
			workId: "work-1",
			amount: 100,
			allocations: [
				{
					id: "alloc-1",
					actualCostId: "cost-1",
					budgetItemId: "item-1",
					percentage: 50,
					value: 50,
					ownerId: "owner-1",
				},
			],
		});
		repoUpdateActualCost.mockResolvedValue({
			id: "cost-1",
			workId: "work-1",
			amount: 100,
			allocations: [
				{
					id: "alloc-1",
					actualCostId: "cost-1",
					budgetItemId: "item-1",
					percentage: 50,
					value: 50,
					ownerId: "owner-1",
				},
			],
		});
	});

	it("accepts allocations on POST and forwards them to the service", async () => {
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works/work-1/actual-costs", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					...validCostBody,
					paymentStatus: "PAID",
					allocations: validAllocations,
				}),
			}),
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			id: "cost-1",
			allocations: expect.any(Array),
		});
		expect(repoCreateActualCost).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			null,
			expect.objectContaining({
				paymentStatus: "PAID",
				costType: "CURRENT",
				allocations: validAllocations,
			}),
			expect.anything(),
			expect.arrayContaining([
				expect.objectContaining({
					budgetItemId: "item-1",
					basis: "PERCENTAGE",
					percentage: 50,
				}),
			]),
		);
	});

	it("normalizes ATUAL alias to CURRENT when creating", async () => {
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works/work-1/actual-costs", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					...validCostBody,
					costType: "ATUAL",
					allocations: validAllocations,
				}),
			}),
		);
		expect(response.status).toBe(200);
		expect(repoCreateActualCost).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			null,
			expect.objectContaining({ costType: "CURRENT" }),
			expect.anything(),
			expect.any(Array),
		);
	});

	it("normalizes FUTURO alias to FUTURE when creating", async () => {
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works/work-1/actual-costs", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					...validCostBody,
					costType: "FUTURO",
					allocations: validAllocations,
				}),
			}),
		);

		expect(response.status).toBe(200);
		expect(repoCreateActualCost).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			null,
			expect.objectContaining({ costType: "FUTURE" }),
			expect.anything(),
			expect.any(Array),
		);
	});

	it("rejects an unknown costType with a PT-BR error message", async () => {
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works/work-1/actual-costs", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					...validCostBody,
					costType: "ATIVO",
					allocations: validAllocations,
				}),
			}),
		);

		expect(response.status).toBe(400);
		expect(repoCreateActualCost).not.toHaveBeenCalled();
		const payload = await response.json();
		expect(payload.message).toMatch(/tipo de custo/i);
	});

	it("rejects allocations outside the 0..100 percentage range at the body boundary", async () => {
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works/work-1/actual-costs", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					...validCostBody,
					allocations: [
						{ budgetItemId: "item-1", percentage: 150 },
						{ budgetItemId: "item-2", percentage: 50 },
					],
				}),
			}),
		);

		expect(response.status).toBe(400);
		expect(repoCreateActualCost).not.toHaveBeenCalled();
	});

	it("rejects costs without allocations", async () => {
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works/work-1/actual-costs", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(validCostBody),
			}),
		);

		expect(response.status).toBe(400);
		expect(repoCreateActualCost).not.toHaveBeenCalled();
		expect(impactCreate).not.toHaveBeenCalled();
	});

	it("rejects empty allocations on create", async () => {
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works/work-1/actual-costs", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ ...validCostBody, allocations: [] }),
			}),
		);

		expect(response.status).toBe(400);
		expect(repoCreateActualCost).not.toHaveBeenCalled();
	});

	it("rejects an allocation without a basis", async () => {
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works/work-1/actual-costs", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					...validCostBody,
					allocations: [{ budgetItemId: "item-1" }],
				}),
			}),
		);

		expect(response.status).toBe(400);
		expect(repoCreateActualCost).not.toHaveBeenCalled();
	});

	it("rejects a percentage sum that does not match 100", async () => {
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works/work-1/actual-costs", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					...validCostBody,
					allocations: [
						{ budgetItemId: "item-1", percentage: 40 },
						{ budgetItemId: "item-2", percentage: 40 },
					],
				}),
			}),
		);

		expect(response.status).toBe(422);
		expect(repoCreateActualCost).not.toHaveBeenCalled();
		expect(await response.json()).toMatchObject({
			message: expect.stringContaining("soma das alocações"),
		});
	});

	it("rejects an item that belongs to another work", async () => {
		budgetItemFindMany.mockResolvedValue([{ id: "item-1", index: "1.1" }]);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works/work-1/actual-costs", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					...validCostBody,
					allocations: [{ budgetItemId: "item-9", percentage: 100 }],
				}),
			}),
		);

		expect(response.status).toBe(422);
		expect(await response.json()).toMatchObject({
			message: expect.stringContaining("não pertence à obra"),
		});
	});

	it("creates a single-item cost and applies its impact", async () => {
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works/work-1/actual-costs", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					...validCostBody,
					amount: 100,
					allocations: [{ budgetItemId: "item-1", percentage: 100 }],
				}),
			}),
		);

		expect(response.status).toBe(200);
		expect(impactCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					sourceType: "GENERAL_COST",
					sourceId: "cost-1",
					impactType: "CONSUMPTION",
					status: "APPROVED",
					amount: new Decimal(100),
					budgetVersionItemId: "vi-1",
				}),
			}),
		);
		expect(ledgerCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					eventType: "INCURRED_CREATE",
					sourceType: "GENERAL_COST",
					sourceId: "cost-1",
					amount: new Decimal(100),
					budgetImpactId: "impact-1",
				}),
			}),
		);
	});

	it("accepts the new single version-item contract without allocations", async () => {
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);
		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works/work-1/actual-costs", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					...validCostBody,
					amount: 100,
					budgetVersionItemId: "vi-1",
				}),
			}),
		);
		expect(response.status).toBe(200);
		expect(impactCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ budgetVersionItemId: "vi-1" }),
			}),
		);
	});

	it("splits a cost between two items by value", async () => {
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works/work-1/actual-costs", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					...validCostBody,
					amount: 100,
					allocations: [
						{ budgetItemId: "item-1", value: 40 },
						{ budgetItemId: "item-2", value: 60 },
					],
				}),
			}),
		);

		expect(response.status).toBe(200);
		expect(impactCreate).toHaveBeenCalledTimes(2);
		expect(impactCreate.mock.calls[0][0].data.amount).toEqual(new Decimal(40));
		expect(impactCreate.mock.calls[1][0].data.amount).toEqual(new Decimal(60));
	});

	it("keeps the impact pending when the cost exceeds the available balance", async () => {
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
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works/work-1/actual-costs", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					...validCostBody,
					amount: 1300,
					allocations: [{ budgetItemId: "item-1", percentage: 100 }],
				}),
			}),
		);
		expect(response.status).toBe(200);
		expect(impactCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					status: "PENDING",
					amount: new Decimal(1300),
				}),
			}),
		);
		expect(ledgerCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ eventType: "DUE_CREATE" }),
			}),
		);
		expect(
			ledgerCreate.mock.calls.filter(
				([call]) => call.data.eventType !== "DUE_CREATE",
			),
		).toHaveLength(0);
	});

	it("returns allocations in the PATCH update response", async () => {
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/actual-costs/cost-1",
				{
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						costType: "FUTURO",
						paymentStatus: "OPEN",
						allocations: validAllocations,
					}),
				},
			),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			id: "cost-1",
			allocations: expect.arrayContaining([
				expect.objectContaining({ budgetItemId: "item-1", percentage: 50 }),
			]),
		});
		expect(repoUpdateActualCost).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			"cost-1",
			expect.objectContaining({
				costType: "FUTURE",
				paymentStatus: "OPEN",
				allocations: validAllocations,
			}),
			expect.anything(),
			expect.arrayContaining([
				expect.objectContaining({
					budgetItemId: "item-1",
					basis: "PERCENTAGE",
					percentage: 50,
				}),
			]),
		);
	});

	it("accepts value-based allocations on PATCH", async () => {
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const valueAllocations = [
			{ budgetItemId: "item-1", value: 40 },
			{ budgetItemId: "item-2", value: 60 },
		];
		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/actual-costs/cost-1",
				{
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ allocations: valueAllocations }),
				},
			),
		);

		expect(response.status).toBe(200);
		expect(repoUpdateActualCost).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			"cost-1",
			expect.objectContaining({ allocations: valueAllocations }),
			expect.anything(),
			expect.arrayContaining([
				expect.objectContaining({
					budgetItemId: "item-1",
					basis: "VALUE",
					percentage: 40,
				}),
			]),
		);
	});

	it("rejects zero value allocations on PATCH at the Elysia boundary", async () => {
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);
		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/actual-costs/cost-1",
				{
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						allocations: [{ budgetItemId: "item-1", value: 0 }],
					}),
				},
			),
		);

		expect(response.status).toBe(400);
		expect(repoUpdateActualCost).not.toHaveBeenCalled();
	});
});

describe("actual-costs allocations repository validation", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		workFindFirst.mockResolvedValue({ id: "work-1", ownerId: "owner-1" });
		budgetItemFindMany.mockResolvedValue([
			{ id: "item-1", index: "1.1" },
			{ id: "item-2", index: "1.2" },
		]);
		costCreate.mockResolvedValue({
			id: "cost-1",
			workId: "work-1",
			amount: 100,
			allocations: [
				{
					id: "alloc-1",
					actualCostId: "cost-1",
					budgetItemId: "item-1",
					percentage: 50,
					value: 50,
					ownerId: "owner-1",
				},
			],
		});
		costFindFirst.mockResolvedValue({
			id: "cost-1",
			ownerId: "owner-1",
			workId: "work-1",
			amount: 100,
		});
		costUpdate.mockResolvedValue({
			id: "cost-1",
			workId: "work-1",
			amount: 100,
			allocations: [
				{
					id: "alloc-1",
					actualCostId: "cost-1",
					budgetItemId: "item-1",
					percentage: 50,
					value: 50,
					ownerId: "owner-1",
				},
			],
		});
	});

	it("persists valid allocations with derived values on create", async () => {
		const { createActualCost } = await import(
			"../../../../src/modules/construction-planning/entries/entries.repository"
		);

		const result = await createActualCost("owner-1", "work-1", null, {
			...canonicalCostBody,
			paymentStatus: "PAID",
			allocations: validAllocations,
		});

		expect(result).toMatchObject({
			id: "cost-1",
			allocations: expect.any(Array),
		});
		expect(costCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				include: { allocations: true },
				data: expect.objectContaining({
					paymentStatus: "PAID",
					allocations: expect.objectContaining({
						create: expect.arrayContaining([
							expect.objectContaining({
								budgetItemId: "item-1",
								percentage: 50,
								value: 50,
							}),
						]),
					}),
				}),
			}),
		);
	});

	it("preserves value allocation basis on create", async () => {
		const { createActualCost } = await import(
			"../../../../src/modules/construction-planning/entries/entries.repository"
		);

		await createActualCost("owner-1", "work-1", null, {
			...canonicalCostBody,
			paymentStatus: "OPEN",
			allocations: [
				{ budgetItemId: "item-1", value: 40 },
				{ budgetItemId: "item-2", value: 60 },
			],
		});

		expect(costCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					allocations: expect.objectContaining({
						create: expect.arrayContaining([
							expect.objectContaining({
								budgetItemId: "item-1",
								basis: "VALUE",
								value: 40,
							}),
						]),
					}),
				}),
			}),
		);
	});

	it("rejects a percentage sum outside the 99.9..100.1 tolerance", async () => {
		const { createActualCost } = await import(
			"../../../../src/modules/construction-planning/entries/entries.repository"
		);

		await expect(
			createActualCost("owner-1", "work-1", null, {
				...canonicalCostBody,
				paymentStatus: "OPEN",
				allocations: [
					{ budgetItemId: "item-1", percentage: 40 },
					{ budgetItemId: "item-2", percentage: 40 },
				],
			}),
		).rejects.toMatchObject({
			code: "INVALID_INPUT",
			status: 400,
			message: expect.stringContaining("soma dos percentuais"),
		});
		expect(costCreate).not.toHaveBeenCalled();
	});

	it("returns allocations in the update result", async () => {
		const { updateActualCost } = await import(
			"../../../../src/modules/construction-planning/entries/entries.repository"
		);

		const result = await updateActualCost("owner-1", "work-1", "cost-1", {
			paymentStatus: "PAID",
			allocations: validAllocations,
		});

		expect(result).toMatchObject({
			id: "cost-1",
			allocations: expect.arrayContaining([
				expect.objectContaining({ budgetItemId: "item-1", percentage: 50 }),
			]),
		});
		expect(costUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				include: { allocations: true },
				data: expect.objectContaining({
					allocations: expect.objectContaining({
						create: expect.arrayContaining([
							expect.objectContaining({
								budgetItemId: "item-1",
								percentage: 50,
								value: 50,
							}),
						]),
					}),
				}),
			}),
		);
	});

	it("preserves value allocation basis on update", async () => {
		const { updateActualCost } = await import(
			"../../../../src/modules/construction-planning/entries/entries.repository"
		);

		await updateActualCost("owner-1", "work-1", "cost-1", {
			allocations: [
				{ budgetItemId: "item-1", value: 40 },
				{ budgetItemId: "item-2", value: 60 },
			],
		});

		expect(costUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					allocations: expect.objectContaining({
						create: expect.arrayContaining([
							expect.objectContaining({
								budgetItemId: "item-1",
								basis: "VALUE",
								value: 40,
							}),
						]),
					}),
				}),
			}),
		);
	});

	it("rejects update with value rateio that does not close the cost total", async () => {
		const { updateActualCost } = await import(
			"../../../../src/modules/construction-planning/entries/entries.repository"
		);

		await expect(
			updateActualCost("owner-1", "work-1", "cost-1", {
				amount: 1000,
				allocations: [
					{ budgetItemId: "item-1", value: 600 },
					{ budgetItemId: "item-2", value: 300 },
				],
			}),
		).rejects.toMatchObject({ code: "INVALID_INPUT", status: 400 });
		expect(costUpdate).not.toHaveBeenCalled();
	});

	it("rejects mixed basis across allocations on update", async () => {
		const { updateActualCost } = await import(
			"../../../../src/modules/construction-planning/entries/entries.repository"
		);

		await expect(
			updateActualCost("owner-1", "work-1", "cost-1", {
				allocations: [
					{ budgetItemId: "item-1", percentage: 50 },
					{ budgetItemId: "item-2", value: 50 },
				],
			}),
		).rejects.toMatchObject({ code: "INVALID_INPUT", status: 400 });
		expect(costUpdate).not.toHaveBeenCalled();
	});

	it("persists normalized allocation values on update", async () => {
		const { updateActualCost } = await import(
			"../../../../src/modules/construction-planning/entries/entries.repository"
		);

		await updateActualCost(
			"owner-1",
			"work-1",
			"cost-1",
			{
				amount: 0.05,
				allocations: [
					{ budgetItemId: "item-1", percentage: 50 },
					{ budgetItemId: "item-2", percentage: 50 },
				],
			},
			undefined,
			[
				{
					budgetItemId: "item-1",
					basis: "PERCENTAGE" as const,
					percentage: 50,
					value: new Decimal("0.03"),
				},
				{
					budgetItemId: "item-2",
					basis: "PERCENTAGE" as const,
					percentage: 50,
					value: new Decimal("0.02"),
				},
			],
		);

		expect(costUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					allocations: expect.objectContaining({
						create: expect.arrayContaining([
							expect.objectContaining({
								budgetItemId: "item-1",
								value: 0.03,
							}),
							expect.objectContaining({
								budgetItemId: "item-2",
								value: 0.02,
							}),
						]),
					}),
				}),
			}),
		);
	});

	it("enriches listing with supplier and budget item", async () => {
		costFindMany.mockResolvedValue([]);
		costCount.mockResolvedValue(0);
		const { listActualCosts } = await import(
			"../../../../src/modules/construction-planning/entries/entries.repository"
		);

		await listActualCosts("owner-1", "work-1", {});

		expect(costFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				include: expect.objectContaining({
					supplier: { select: { id: true, name: true } },
					allocations: {
						include: {
							budgetItem: {
								select: {
									id: true,
									index: true,
									type: true,
									description: true,
									unit: true,
								},
							},
						},
					},
				}),
			}),
		);
	});

	it("enriches detail with supplier and budget item", async () => {
		costFindFirst.mockResolvedValue({
			id: "cost-1",
			allocations: [],
			supplier: null,
		} as never);
		const { getActualCostById } = await import(
			"../../../../src/modules/construction-planning/entries/entries.repository"
		);

		await getActualCostById("owner-1", "work-1", "cost-1");

		expect(costFindFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				include: expect.objectContaining({
					supplier: { select: { id: true, name: true } },
					allocations: expect.objectContaining({
						include: expect.objectContaining({
							budgetItem: expect.any(Object),
						}),
					}),
				}),
			}),
		);
	});
});

describe("CUS-002 actual-cost detail route", () => {
	const detailWithSupplier = {
		id: "cost-1",
		ownerId: "owner-1",
		workId: "work-1",
		amount: 100,
		costDate: "2026-01-20T00:00:00.000Z",
		supplier: { id: "sup-1", name: "Fornecedor A" },
		allocations: [
			{
				id: "alloc-1",
				budgetItemId: "item-1",
				percentage: 50,
				value: 50,
				budgetItem: {
					id: "item-1",
					index: "1.1",
					type: "ITEM",
					description: "Servico A",
					unit: "m2",
				},
			},
		],
	};

	it("GET detalhe retorna custo com fornecedor, allocations e indice do item", async () => {
		repoGetActualCostById.mockResolvedValue(detailWithSupplier);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/actual-costs/cost-1",
			),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			supplier?: { name?: string };
			allocations?: Array<{
				budgetItem?: { index?: string; description?: string };
			}>;
		};
		expect(body.supplier?.name).toBe("Fornecedor A");
		expect(body.allocations?.[0]?.budgetItem?.index).toBe("1.1");
		expect(body.allocations?.[0]?.budgetItem?.description).toBe("Servico A");
	});

	it("GET detalhe retorna 404 quando o custo nao existe", async () => {
		repoGetActualCostById.mockResolvedValue(null);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/actual-costs/missing",
			),
		);

		expect(response.status).toBe(404);
	});
});
