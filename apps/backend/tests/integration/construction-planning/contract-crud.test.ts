import { beforeEach, describe, expect, it, mock } from "bun:test";
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

const auditLogCreate = mock(async () => ({ id: "audit-1" }));

const countAmendments = mock(async () => 0);

const listContractServicesMock = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);

const getSupplierById = mock(
	async (): Promise<Record<string, unknown> | null> => ({
		id: "e2e-supplier-1",
		ownerId: TEST_OWNER,
		name: "Fornecedor Cadastrado",
		document: null,
		contact: null,
		notes: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	}),
);
const findWorkSupplier = mock(
	async (): Promise<{ id: string } | null> => ({ id: "work-supplier-1" }),
);
const orgMembershipFindMany = mock(
	async (): Promise<{ organizationId: string }[]> => [],
);
const ccMembershipFindMany = mock(
	async (): Promise<{ costCenterId: string }[]> => [],
);

beforeEach(() => {
	findWorkSupplier.mockImplementation(async () => ({ id: "work-supplier-1" }));
	orgMembershipFindMany.mockResolvedValue([{ organizationId: TEST_ORG_ID }]);
	ccMembershipFindMany.mockResolvedValue([{ costCenterId: TEST_CC_ID }]);
});

const createContract = mock(async () => ({
	id: "e2e-contract-1",
	ownerId: TEST_OWNER,
	workId: TEST_WORK_ID,
	code: "CT-001",
	supplierName: "Fornecedor Teste",
	supplierId: null,
	contractValue: 100000,
	status: "RASCUNHO",
	createdAt: new Date(),
	updatedAt: new Date(),
}));

const updateContract = mock(async () => ({
	id: "e2e-contract-1",
	ownerId: TEST_OWNER,
	workId: TEST_WORK_ID,
	code: "CT-E2E-001",
	supplierName: "Fornecedor E2E",
	supplierId: null,
	contractValue: 100000,
	title: "Contrato Atualizado",
	status: "FINALIZADO",
	createdAt: new Date(),
	updatedAt: new Date(),
}));

mock.module("../../../src/lib/auth-middleware", () => ({ getSessionUser }));

const submitApprovalMock = mock(async () => ({
	status: "APPROVED",
	approvalRequestId: "req-mock",
	data: {
		id: "e2e-contract-1",
		ownerId: TEST_OWNER,
		workId: TEST_WORK_ID,
		code: "CT-001",
		supplierName: "Fornecedor Cadastrado",
		contractValue: 50000,
		status: "RASCUNHO",
		createdAt: new Date(),
		updatedAt: new Date(),
	},
}));

mock.module("../../../src/modules/governance/approval.service", () => ({
	submitApproval: submitApprovalMock,
}));

mock.module("../../../src/lib/prisma", () => ({
	prisma: {
		auditLog: { create: auditLogCreate },
		governanceRecord: { findUnique: mock(async () => null) },
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
			findMany: ccMembershipFindMany,
		},
		organizationMembership: {
			findUnique: mock(async () => null),
			findMany: orgMembershipFindMany,
		},
		$transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
			callback({ auditLog: { create: auditLogCreate } }),
	},
}));

mock.module(
	"../../../src/modules/construction-planning/suppliers/supplier.repository",
	() => ({
		getSupplierById,
		findSupplierByDocument: mock(async () => null),
		findSupplierByDocumentOrName: mock(async () => null),
		findWorkSupplier,
	}),
);

mock.module("../../../src/modules/construction-planning/repository", () => ({
	getWorkById: mock(async () => makeTestWork()),
	getWorkOrThrow: mock(async () => makeTestWork()),
	findWorkByOwnerAndCode: mock(async () => null),
	getWorkMeasurementsForBI: mock(async () => []),
}));

const getContractById = mock(
	async (): Promise<Record<string, unknown>> => ({
		id: "e2e-contract-1",
		ownerId: TEST_OWNER,
		workId: TEST_WORK_ID,
		code: "CT-E2E-001",
		supplierName: "Fornecedor E2E",
		supplierId: "e2e-supplier-1",
		serviceType: "Obra Civil",
		title: "Contrato E2E",
		contractValue: 100000,
		startDate: new Date("2026-01-01"),
		endDate: new Date("2026-12-31"),
		status: "EM_ANDAMENTO",
		createdBy: null,
		notes: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		services: [],
		folders: [],
		amendments: [],
		totalValue: 100000,
		amendmentTotal: 0,
	}),
);

mock.module(
	"../../../src/modules/construction-planning/contract.repository",
	() => ({
		listContracts: mock(async () => ({
			data: [],
			total: 0,
			page: 1,
			limit: 10,
		})),
		listContractSnapshotRows: mock(async () => []),
		getContractById,
		createContract,
		updateContract,
		deleteContract: mock(async () => ({ id: "e2e-contract-1" })),
		getContractsSummary: mock(async () => ({
			totalContracts: 0,
			totalContractValue: 0,
			approvedMeasurements: 0,
			totalMeasuredValue: 0,
			measuredPercentage: 0,
			totalPaidValue: 0,
			totalOutstandingValue: 0,
			paidPercentage: 0,
		})),
		listCrossContractMeasurements: mock(async () => []),
		listContractServices: listContractServicesMock,
		listAmendments: mock(async () => [
			{
				id: "e2e-ca-1",
				ownerId: TEST_OWNER,
				contractId: "e2e-contract-1",
				kind: "ADITIVO",
				value: 15000,
				reason: "Escopo extra",
				date: new Date("2026-07-01"),
				createdBy: TEST_OWNER,
				createdAt: new Date(),
			},
		]),
		createAmendment: mock(async () => ({
			id: "e2e-ca-1",
			ownerId: TEST_OWNER,
			contractId: "e2e-contract-1",
			kind: "ADITIVO",
			value: 15000,
			reason: "Escopo extra",
			date: new Date("2026-07-01"),
			createdBy: TEST_OWNER,
			createdAt: new Date(),
		})),
		updateAmendment: mock(async () => ({
			previous: {
				id: "e2e-ca-1",
				ownerId: TEST_OWNER,
				contractId: "e2e-contract-1",
				kind: "ADITIVO",
				value: 15000,
				reason: "Escopo extra",
				date: new Date("2026-07-01"),
				createdBy: TEST_OWNER,
				createdAt: new Date(),
			},
			updated: {
				id: "e2e-ca-1",
				ownerId: TEST_OWNER,
				contractId: "e2e-contract-1",
				kind: "ADITIVO",
				value: 5000,
				reason: "Escopo extra",
				date: new Date("2026-07-01"),
				createdBy: TEST_OWNER,
				createdAt: new Date(),
			},
		})),
		deleteAmendment: mock(async () => ({ id: "e2e-ca-1" })),
		countAmendments,
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

describe("Contract CRUD E2E", () => {
	it("GET /construction/works/:workId/contracts - lista contratos", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts`,
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toMatchObject({ data: [], total: 0 });
	});

	it("POST /construction/works/:workId/contracts - cria contrato", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						code: "CT-001",
						supplierName: "Fornecedor Teste",
						contractValue: 100000,
						serviceType: "Obra Civil",
						title: "Contrato Teste",
						startDate: "2026-01-01",
						endDate: "2026-12-31",
					}),
				},
			),
		);

		expect(response.status).toBeLessThan(500);
	});

	it("POST /construction/works/:workId/contracts - valida campos obrigatorios", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({}),
				},
			),
		);

		expect(response.status).toBe(400);
	});

	it("GET /construction/works/:workId/contracts/:contractId - detalhe contrato", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1`,
			),
		);

		expect(response.status).toBeLessThan(500);
	});

	it("PATCH /construction/works/:workId/contracts/:contractId - atualiza contrato", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1`,
				{
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						title: "Contrato Atualizado",
						status: "FINALIZADO",
					}),
				},
			),
		);

		expect(response.status).toBeLessThan(500);
	});

	it("DELETE /construction/works/:workId/contracts/:contractId - exclui contrato", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1`,
				{
					method: "DELETE",
				},
			),
		);

		assertNoContentResponse(response);
	});

	it("GET /construction/works/:workId/contracts/summary - resumo contratos", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/summary`,
			),
		);

		assertJsonResponse(response, 200);
	});

	it("GET /construction/works/:workId/contracts/measurements - medicoes cross-contrato", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/measurements`,
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(Array.isArray(body)).toBe(true);
	});

	it("requer autenticacao nos endpoints de contratos", async () => {
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
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts`,
			),
		);

		expect(response.status).toBe(401);
	});
});

describe("Contract Supplier Link E2E", () => {
	it("POST cria contrato com supplierId e denormaliza supplierName", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "GERENTE",
		}));
		getSupplierById.mockImplementation(async () => ({
			id: "e2e-supplier-1",
			ownerId: TEST_OWNER,
			name: "Fornecedor Cadastrado",
			document: null,
			contact: null,
			notes: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		}));
		createContract.mockClear();
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						code: "CT-SUP-001",
						supplierId: "e2e-supplier-1",
						contractValue: 50000,
						objectDescription: "Servicos de fundacao",
					}),
				},
			),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.status).toBe("EXECUTED");
		expect(submitApprovalMock).toHaveBeenCalledWith(
			expect.objectContaining({
				actorId: TEST_OWNER,
				effectAction: "CONTRACT_CREATE",
				payload: expect.objectContaining({
					contract: expect.objectContaining({
						supplierId: "e2e-supplier-1",
						supplierName: "Fornecedor Cadastrado",
					}),
				}),
			}),
		);
		expect(createContract).not.toHaveBeenCalled();
	});

	it("POST com supplierId de outro proprietario -> 422 INVALID_SUPPLIER", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "GERENTE",
		}));
		getSupplierById.mockImplementation(async () => null);
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						code: "CT-SUP-002",
						supplierId: "sup-outro-owner",
						contractValue: 50000,
						objectDescription: "Servicos de fundacao",
					}),
				},
			),
		);

		expect(response.status).toBe(422);
		const body = await response.json();
		expect(body.message).toBe("Fornecedor nao pertence ao proprietario");
	});

	it("POST com supplierId fora do escopo da obra -> 422 SUPPLIER_OUTSIDE_WORK", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "GERENTE",
		}));
		getSupplierById.mockImplementation(async () => ({
			id: "e2e-supplier-2",
			ownerId: TEST_OWNER,
			name: "Fornecedor de Outra Obra",
		}));
		findWorkSupplier.mockImplementation(async () => null);
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						code: "CT-SUP-OUTSIDE",
						supplierId: "e2e-supplier-2",
						contractValue: 50000,
						objectDescription: "Servicos de fundacao",
					}),
				},
			),
		);

		expect(response.status).toBe(422);
		const body = await response.json();
		expect(body.message).toBe("Fornecedor nao esta vinculado a esta obra");
	});

	it("POST com supplierId e supplierName mantem o nome do payload", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "GERENTE",
		}));
		getSupplierById.mockImplementation(async () => ({
			id: "e2e-supplier-1",
			ownerId: TEST_OWNER,
			name: "Fornecedor Cadastrado",
			document: null,
			contact: null,
			notes: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		}));
		createContract.mockClear();
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						code: "CT-SUP-003",
						supplierId: "e2e-supplier-1",
						supplierName: "Nome Manual",
						contractValue: 50000,
						objectDescription: "Servicos de fundacao",
					}),
				},
			),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.status).toBe("EXECUTED");
		expect(submitApprovalMock).toHaveBeenCalledWith(
			expect.objectContaining({
				effectAction: "CONTRACT_CREATE",
				payload: expect.objectContaining({
					contract: expect.objectContaining({
						supplierId: "e2e-supplier-1",
						supplierName: "Nome Manual",
					}),
				}),
			}),
		);
		expect(createContract).not.toHaveBeenCalled();
	});

	it("POST sem supplierId nem supplierName -> 400 INVALID_INPUT", async () => {
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
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						code: "CT-SUP-004",
						contractValue: 50000,
					}),
				},
			),
		);

		expect(response.status).toBe(400);
	});

	it("POST com supplierId null sem supplierName -> 400, nunca 500", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "GERENTE",
		}));
		createContract.mockClear();
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						code: "CT-SUP-005",
						supplierId: null,
						contractValue: 50000,
						objectDescription: "Servicos de fundacao",
					}),
				},
			),
		);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(
			body.errors?.some(
				(error: { field: string; message: string }) =>
					error.field === "supplierName" &&
					error.message === "Informe supplierId ou supplierName.",
			),
		).toBe(true);
		expect(createContract).not.toHaveBeenCalled();
	});

	it("PATCH define supplierId no contrato", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "GERENTE",
		}));
		getSupplierById.mockImplementation(async () => ({
			id: "e2e-supplier-1",
			ownerId: TEST_OWNER,
			name: "Fornecedor Cadastrado",
			document: null,
			contact: null,
			notes: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		}));
		updateContract.mockClear();
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1`,
				{
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ supplierId: "e2e-supplier-1" }),
				},
			),
		);

		expect(response.status).toBe(200);
		expect(updateContract).toHaveBeenCalledWith(
			TEST_OWNER,
			TEST_WORK_ID,
			"e2e-contract-1",
			expect.objectContaining({ supplierId: "e2e-supplier-1" }),
		);
	});

	it("PATCH com supplierId null sem supplierName -> 400, nunca 500", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "GERENTE",
		}));
		updateContract.mockClear();
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1`,
				{
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ supplierId: null }),
				},
			),
		);

		expect(response.status).toBe(400);
		expect(updateContract).not.toHaveBeenCalled();
	});

	it("PATCH com supplierId null e supplierName explicito desvincula mantendo o nome", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "GERENTE",
		}));
		updateContract.mockClear();
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1`,
				{
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						supplierId: null,
						supplierName: "Fornecedor E2E",
					}),
				},
			),
		);

		expect(response.status).toBe(200);
		expect(updateContract).toHaveBeenCalledWith(
			TEST_OWNER,
			TEST_WORK_ID,
			"e2e-contract-1",
			expect.objectContaining({
				supplierId: null,
				supplierName: "Fornecedor E2E",
			}),
		);
	});

	it("PATCH com supplierId de outro proprietario -> 422 INVALID_SUPPLIER", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "GERENTE",
		}));
		getSupplierById.mockImplementation(async () => null);
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1`,
				{
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ supplierId: "sup-outro-owner" }),
				},
			),
		);

		expect(response.status).toBe(422);
		const body = await response.json();
		expect(body.message).toBe("Fornecedor nao pertence ao proprietario");
	});

	it("PATCH com apenas supplierId denormaliza supplierName do fornecedor", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "GERENTE",
		}));
		getSupplierById.mockImplementation(async () => ({
			id: "e2e-supplier-1",
			ownerId: TEST_OWNER,
			name: "Fornecedor Cadastrado",
			document: null,
			contact: null,
			notes: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		}));
		updateContract.mockClear();
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1`,
				{
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ supplierId: "e2e-supplier-1" }),
				},
			),
		);

		expect(response.status).toBe(200);
		expect(updateContract).toHaveBeenCalledWith(
			TEST_OWNER,
			TEST_WORK_ID,
			"e2e-contract-1",
			expect.objectContaining({
				supplierId: "e2e-supplier-1",
				supplierName: "Fornecedor Cadastrado",
			}),
		);
	});

	it("GET detalhe retorna totalValue e amendmentTotal derivados", async () => {
		getContractById.mockImplementation(async () => ({
			id: "e2e-contract-1",
			ownerId: TEST_OWNER,
			workId: TEST_WORK_ID,
			code: "CT-E2E-001",
			supplierName: "Fornecedor E2E",
			supplierId: "e2e-supplier-1",
			serviceType: "Obra Civil",
			title: "Contrato E2E",
			contractValue: 100000,
			startDate: new Date("2026-01-01"),
			endDate: new Date("2026-12-31"),
			status: "EM_ANDAMENTO",
			createdBy: null,
			notes: null,
			createdAt: new Date(),
			updatedAt: new Date(),
			services: [],
			folders: [],
			amendments: [
				{
					id: "e2e-ca-1",
					ownerId: TEST_OWNER,
					contractId: "e2e-contract-1",
					kind: "ADITIVO",
					value: 15000,
					reason: "Escopo extra",
					date: new Date("2026-07-01"),
					createdBy: TEST_OWNER,
					createdAt: new Date(),
				},
			],
			totalValue: 115000,
			amendmentTotal: 15000,
		}));
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1`,
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body.totalValue).toBe(115000);
		expect(body.amendmentTotal).toBe(15000);
		expect(body.supplierId).toBe("e2e-supplier-1");
	});
});

describe("Contract Amendments E2E", () => {
	it("POST /construction/works/:workId/contracts/:contractId/amendments - cria aditivo e audita CONTRACT_AMENDMENT", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "GERENTE",
		}));
		listContractServicesMock.mockImplementation(async () => [
			{
				id: "e2e-cs-1",
				contractId: "e2e-contract-1",
				type: "ITEM",
				description: "Servico com cobertura",
				unit: "m2",
				quantity: 10,
				unitCost: 5000,
				totalCost: 50000,
				budgetItemId: "e2e-budget-item-1",
				sortOrder: 1,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		]);
		auditLogCreate.mockClear();
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/amendments`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						kind: "ADITIVO",
						value: 15000,
						reason: "Escopo extra",
						date: "2026-07-01",
						measurementIds: ["e2e-measurement-1"],
					}),
				},
			),
		);

		expect(response.status).toBe(200);
		expect(auditLogCreate).toHaveBeenCalledTimes(1);
		expect(auditLogCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({
				action: "CREATE",
				entityType: "CONTRACT_AMENDMENT",
				entityId: "e2e-ca-1",
			}),
		});
	});

	it("POST - valor de aditivo invalido -> 422 INVALID_AMENDMENT_VALUE", async () => {
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
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/amendments`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						kind: "ADITIVO",
						value: 0,
						reason: "Escopo extra",
						date: "2026-07-01",
						measurementIds: ["e2e-measurement-1"],
					}),
				},
			),
		);

		expect(response.status).toBe(422);
		const body = await response.json();
		expect(body.message).toBe("Valor do aditivo deve ser maior que zero");
		expect(body.message).toBe("Valor do aditivo deve ser maior que zero");
	});

	it("GET /construction/works/:workId/contracts/:contractId/amendments - lista aditivos", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/amendments`,
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(Array.isArray(body)).toBe(true);
		expect(body[0]).toMatchObject({
			kind: "ADITIVO",
			value: 15000,
			reason: "Escopo extra",
		});
	});

	it("PATCH /construction/works/:workId/contracts/:contractId/amendments/:amendmentId - PATCH parcial audita previousState real", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "GERENTE",
		}));
		auditLogCreate.mockClear();
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/amendments/e2e-ca-1`,
				{
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						value: 5000,
					}),
				},
			),
		);

		expect(response.status).toBe(200);
		expect(auditLogCreate).toHaveBeenCalledTimes(1);
		expect(auditLogCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({
				action: "UPDATE",
				entityType: "CONTRACT_AMENDMENT",
				previousState: {
					kind: "ADITIVO",
					value: 15000,
					reason: "Escopo extra",
					date: "2026-07-01T00:00:00.000Z",
				},
				newState: expect.objectContaining({
					kind: "ADITIVO",
					value: 5000,
					reason: "Escopo extra",
				}),
			}),
		});
	});

	it("DELETE /construction/works/:workId/contracts/:contractId/amendments/:amendmentId - exclui e audita", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "GERENTE",
		}));
		auditLogCreate.mockClear();
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1/amendments/e2e-ca-1`,
				{
					method: "DELETE",
				},
			),
		);

		assertNoContentResponse(response);
		expect(auditLogCreate).toHaveBeenCalledTimes(1);
		expect(auditLogCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({
				action: "DELETE",
				entityType: "CONTRACT_AMENDMENT",
			}),
		});
	});

	it("PATCH contrato com aditivos alterando contractValue -> 422 CONTRACT_AMENDMENTS_EXIST", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "GERENTE",
		}));
		countAmendments.mockImplementation(async () => 1);
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1`,
				{
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						contractValue: 120000,
					}),
				},
			),
		);

		expect(response.status).toBe(422);
		const body = await response.json();
		expect(body.message).toBe("Contrato com aditivos: ajuste por aditivo");
		expect(body.message).toBe("Contrato com aditivos: ajuste por aditivo");
	});

	it("PATCH contrato com aditivos sem alterar contractValue atualiza normalmente", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "GERENTE",
		}));
		countAmendments.mockImplementation(async () => 1);
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1`,
				{
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						title: "Contrato com aditivo",
					}),
				},
			),
		);

		expect(response.status).toBe(200);
	});
});

describe("Contract Read Access E2E", () => {
	it("SUPERVISOR com membership do centro acessa GET /contracts/summary e /contracts/measurements (somente leitura)", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "leitura@obra.bi",
			name: "Leitura",
			role: "SUPERVISOR",
		}));
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const summaryResponse = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/summary`,
			),
		);
		expect(summaryResponse.status).toBe(200);

		const measurementsResponse = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/measurements`,
			),
		);
		expect(measurementsResponse.status).toBe(200);
	});

	it("SUPERVISOR acessa GET /contracts/:contractId (somente leitura)", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "leitura@obra.bi",
			name: "Leitura",
			role: "SUPERVISOR",
		}));
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1`,
			),
		);
		expect(response.status).toBe(200);
	});

	it("SUPERVISOR sem membership do centro nao enxerga a obra (404)", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: "supervisor-fora",
			email: "fora@obra.bi",
			name: "Fora",
			role: "SUPERVISOR",
		}));
		orgMembershipFindMany.mockResolvedValue([]);
		ccMembershipFindMany.mockResolvedValue([]);
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1`,
			),
		);
		expect(response.status).toBe(404);
	});

	it("PATCH com supplierName vazio -> 400 INVALID_INPUT, nunca persiste", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "GERENTE",
		}));
		updateContract.mockClear();
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/contracts/e2e-contract-1`,
				{
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ supplierName: "" }),
				},
			),
		);

		expect(response.status).toBe(400);
		expect(updateContract).not.toHaveBeenCalled();
	});
});
