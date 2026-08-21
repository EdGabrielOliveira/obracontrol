import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
	assertJsonResponse,
	assertNoContentResponse,
	TEST_BUDGET_ITEM_ID,
	TEST_CC_ID,
	TEST_ORG_ID,
	TEST_OWNER,
	TEST_WORK_ID,
} from "./setup";

const CONTRACT_ID = "e2e-contract-1";
const PAYMENT_ID = "e2e-pay-1";
const MEASUREMENT_ID = "e2e-cm-1";

const getSessionUser = mock(async () => ({
	id: TEST_OWNER,
	email: "teste@obra.bi",
	name: "Usuario Teste",
	role: "GERENTE",
}));

const auditLogCreate = mock(async () => ({ id: "audit-1" }));

const contractFindFirst = mock(
	async (): Promise<{
		id: string;
		workId: string;
		startDate: Date | null;
		endDate: Date | null;
		contractValue: number;
		amendments: Array<{ kind: string; value: number }>;
		measurements: Array<{ items: Array<{ accumulatedValue: number | null }> }>;
	}> => ({
		id: CONTRACT_ID,
		workId: TEST_WORK_ID,
		startDate: null,
		endDate: null,
		contractValue: 100000,
		amendments: [],
		measurements: [],
	}),
);

const defaultContract = {
	id: CONTRACT_ID,
	workId: TEST_WORK_ID,
	startDate: null,
	endDate: null,
	contractValue: 100000,
	amendments: [],
	measurements: [],
};

const contractMeasurementFindFirst = mock(
	async (): Promise<{ id: string } | null> => ({ id: MEASUREMENT_ID }),
);

const contractPaymentFindMany = mock(async () => []);

const contractPaymentCount = mock(async () => 0);

const contractPaymentCreate = mock(
	async ({ data }: { data: Record<string, unknown> }) => ({
		id: PAYMENT_ID,
		...data,
	}),
);

const contractPaymentUpdate = mock(
	async ({ data }: { data: Record<string, unknown> }) => ({
		id: PAYMENT_ID,
		...data,
	}),
);

const contractPaymentFindFirst = mock(async () => ({
	id: PAYMENT_ID,
	ownerId: TEST_OWNER,
	contractId: CONTRACT_ID,
	date: new Date("2026-06-20"),
	value: 25000,
	paidValue: 25000,
	description: "Pagamento parcial",
	measurementId: null,
	retentionValue: null,
	discountValue: null,
	status: "PAGO",
	balanceOverride: false,
	createdAt: new Date(),
	updatedAt: new Date(),
}));

const contractPaymentDelete = mock(async () => ({ id: PAYMENT_ID }));

const prismaModels = {
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
		findMany: mock(async () => [{ costCenterId: TEST_CC_ID }]),
	},
	organizationMembership: {
		findUnique: mock(async () => null),
		findMany: mock(async () => [{ organizationId: TEST_ORG_ID }]),
	},
	contract: { findFirst: contractFindFirst },
	contractMeasurement: { findFirst: contractMeasurementFindFirst },
	contractService: {
		findFirst: mock(async () => ({
			budgetItemId: TEST_BUDGET_ITEM_ID,
		})),
	},
	contractPayment: {
		findMany: contractPaymentFindMany,
		count: contractPaymentCount,
		create: contractPaymentCreate,
		update: contractPaymentUpdate,
		findFirst: contractPaymentFindFirst,
		delete: contractPaymentDelete,
	},
	contractMeasurementItem: { findMany: mock(async () => []) },
	constructionBudgetImpact: { findMany: mock(async () => []) },
	$transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
		callback({
			auditLog: { create: auditLogCreate },
			contract: { findFirst: contractFindFirst },
			contractMeasurement: { findFirst: contractMeasurementFindFirst },
			contractService: {
				findFirst: mock(async () => ({
					budgetItemId: TEST_BUDGET_ITEM_ID,
				})),
			},
			contractPayment: {
				findMany: contractPaymentFindMany,
				count: contractPaymentCount,
				create: contractPaymentCreate,
				update: contractPaymentUpdate,
				findFirst: contractPaymentFindFirst,
				delete: contractPaymentDelete,
			},
			contractMeasurementItem: { findMany: mock(async () => []) },
			constructionBudgetImpact: { findMany: mock(async () => []) },
		}),
};

mock.module("../../../src/lib/auth-middleware", () => ({ getSessionUser }));

mock.module("../../../src/lib/prisma", () => ({ prisma: prismaModels }));

mock.module(
	"../../../src/modules/construction-planning/contract-governance-scope",
	() => ({
		contractGovernanceScope: {
			getWorkId: mock(async () => TEST_WORK_ID),
		},
	}),
);

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
		buildMeasurementEvents: mock(() => []),
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
	}),
);

function paymentRequest(path: string, init?: RequestInit) {
	return new Request(`http://localhost/construction${path}`, init);
}

function postPayment(body: Record<string, unknown>) {
	return paymentRequest(
		`/works/${TEST_WORK_ID}/contracts/${CONTRACT_ID}/payments`,
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		},
	);
}

function patchPayment(body: Record<string, unknown>) {
	return paymentRequest(
		`/works/${TEST_WORK_ID}/contracts/${CONTRACT_ID}/payments/${PAYMENT_ID}`,
		{
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		},
	);
}

describe("Contract Payments E2E", () => {
	beforeEach(() => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "GERENTE",
		}));
		contractFindFirst.mockImplementation(async () => defaultContract);
		contractMeasurementFindFirst.mockImplementation(async () => ({
			id: MEASUREMENT_ID,
		}));
	});

	it("GET /construction/works/:workId/contracts/:contractId/payments - lista pagamentos", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			paymentRequest(
				`/works/${TEST_WORK_ID}/contracts/${CONTRACT_ID}/payments`,
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toMatchObject({ data: [], total: 0 });
	});

	it("POST /construction/works/:workId/contracts/:contractId/payments - cria pagamento", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			postPayment({
				date: "2026-06-20",
				value: 25000,
				paidValue: 25000,
				description: "Pagamento parcial",
				status: "PAGO",
			}),
		);

		expect(response.status).toBe(200);
	});

	it("PATCH /construction/works/:workId/contracts/:contractId/payments/:pId - atualiza pagamento", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			patchPayment({
				description: "Pagamento atualizado",
				paidValue: 30000,
			}),
		);

		expect(response.status).toBe(200);
	});

	it("DELETE /construction/works/:workId/contracts/:contractId/payments/:pId - exclui pagamento", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			paymentRequest(
				`/works/${TEST_WORK_ID}/contracts/${CONTRACT_ID}/payments/${PAYMENT_ID}`,
				{ method: "DELETE" },
			),
		);

		assertNoContentResponse(response);
	});

	it("GET /construction/works/:workId/contracts/:contractId/payments/summary - resumo pagamentos", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			paymentRequest(
				`/works/${TEST_WORK_ID}/contracts/${CONTRACT_ID}/payments/summary`,
			),
		);

		assertJsonResponse(response, 200);
	});

	it("POST - pagamento PAGO acima do saldo -> 422 PAYMENT_EXCEEDS_BALANCE", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			postPayment({
				date: "2026-06-20",
				value: 150000,
				paidValue: 150000,
				description: "Pagamento excedente",
				status: "PAGO",
			}),
		);

		expect(response.status).toBe(422);
		const body = await response.json();
		expect(body.message).toBe("Pagamento acima do saldo do contrato");
	});

	it("POST - pagamento dentro do saldo com aditivo (total derivado) cria pagamento", async () => {
		contractFindFirst.mockImplementation(async () => ({
			id: CONTRACT_ID,
			workId: TEST_WORK_ID,
			startDate: null,
			endDate: null,
			contractValue: 100000,
			amendments: [{ kind: "ADITIVO", value: 20000 }],
			measurements: [],
		}));
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			postPayment({
				date: "2026-06-20",
				value: 110000,
				paidValue: 110000,
				description: "Pagamento com aditivo",
				status: "PAGO",
			}),
		);

		expect(response.status).toBe(200);
	});

	it("POST - override GERENTE acima do saldo -> 403 GOVERNANCE_OVERRIDE_REQUIRED", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			postPayment({
				date: "2026-06-20",
				value: 150000,
				paidValue: 150000,
				description: "Pagamento excedente",
				status: "PAGO",
				balanceOverride: true,
				reason: "Aprovado pelo gerente",
			}),
		);

		expect(response.status).toBe(403);
		const body = await response.json();
		expect(body.message).toBe(
			"Somente ADMIN pode executar override administrativo",
		);
	});

	it("POST - override ADMIN sem motivo -> 422 OVERRIDE_REASON_REQUIRED", async () => {
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
			postPayment({
				date: "2026-06-20",
				value: 150000,
				paidValue: 150000,
				description: "Pagamento excedente",
				status: "PAGO",
				balanceOverride: true,
			}),
		);

		expect(response.status).toBe(422);
		const body = await response.json();
		expect(body.message).toBe("Motivo do override e obrigatorio");
	});

	it("POST - override ADMIN com motivo cria pagamento e audita CONTRACT_PAYMENT com motivo", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "teste@obra.bi",
			name: "Usuario Teste",
			role: "ADMIN",
		}));
		auditLogCreate.mockClear();
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			postPayment({
				date: "2026-06-20",
				value: 150000,
				paidValue: 150000,
				description: "Pagamento excedente",
				status: "PAGO",
				balanceOverride: true,
				reason: "Aprovado pela diretoria",
			}),
		);

		expect(response.status).toBe(200);
		expect(auditLogCreate).toHaveBeenCalledTimes(1);
		expect(auditLogCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({
				entityType: "CONTRACT_PAYMENT",
				newState: expect.objectContaining({
					balanceOverride: true,
					reason: "Aprovado pela diretoria",
				}),
			}),
		});
	});

	it("POST - pagamento igual ao saldo exibido (com centavos) passa pelo gate", async () => {
		contractFindFirst.mockImplementation(async () => ({
			id: CONTRACT_ID,
			workId: TEST_WORK_ID,
			startDate: null,
			endDate: null,
			contractValue: 100.01,
			amendments: [],
			measurements: [],
		}));
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			postPayment({
				date: "2026-06-20",
				value: 100.01,
				paidValue: 100.01,
				description: "Pagamento igual ao saldo",
				status: "PAGO",
			}),
		);

		expect(response.status).toBe(200);
	});

	it("PATCH - atualizacao do proprio pagamento PAGO exclui o valor pago do saldo", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			patchPayment({
				paidValue: 95000,
				status: "PAGO",
			}),
		);

		expect(response.status).toBe(200);
	});

	it("PATCH - atualizacao acima do saldo -> 422 PAYMENT_EXCEEDS_BALANCE", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			patchPayment({
				paidValue: 105000,
				status: "PAGO",
			}),
		);

		expect(response.status).toBe(422);
		const body = await response.json();
		expect(body.message).toBe("Pagamento acima do saldo do contrato");
	});

	it("POST /payments com measurementId valido -> 200 e vinculo persistido", async () => {
		contractPaymentCreate.mockClear();
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			postPayment({
				date: "2026-06-15",
				value: 1000,
				paidValue: 1000,
				measurementId: MEASUREMENT_ID,
			}),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body.measurementId).toBe(MEASUREMENT_ID);
		expect(contractPaymentCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({ measurementId: MEASUREMENT_ID }),
		});
	});

	it("POST /payments sem measurementId (pagamento geral) -> measurementId null", async () => {
		contractPaymentCreate.mockClear();
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			postPayment({
				date: "2026-06-15",
				value: 1000,
				paidValue: 1000,
			}),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body.measurementId).toBeNull();
		expect(contractPaymentCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({ measurementId: null }),
		});
	});

	it("POST /payments com measurementId inexistente -> 404 sem gravar pagamento", async () => {
		contractMeasurementFindFirst.mockImplementation(async () => null);
		contractPaymentCreate.mockClear();
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			postPayment({
				date: "2026-06-15",
				value: 1000,
				paidValue: 1000,
				measurementId: "medicao-inexistente",
			}),
		);

		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body.message).toBe("Medicao vinculada nao encontrada no contrato");
		expect(contractPaymentCreate).not.toHaveBeenCalled();
	});

	it("POST /payments com measurementId de outro contrato -> 404", async () => {
		contractMeasurementFindFirst.mockImplementation(async () => null);
		contractPaymentCreate.mockClear();
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			postPayment({
				date: "2026-06-15",
				value: 1000,
				paidValue: 1000,
				measurementId: "medicao-outro-contrato",
			}),
		);

		expect(response.status).toBe(404);
		expect(contractPaymentCreate).not.toHaveBeenCalled();
	});

	it("PATCH /payments/:pId altera measurementId", async () => {
		contractPaymentUpdate.mockClear();
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			patchPayment({
				measurementId: MEASUREMENT_ID,
			}),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body.measurementId).toBe(MEASUREMENT_ID);
		expect(contractPaymentUpdate).toHaveBeenCalledWith({
			where: { id: PAYMENT_ID, ownerId: TEST_OWNER },
			data: expect.objectContaining({ measurementId: MEASUREMENT_ID }),
		});
	});

	it("PATCH /payments/:pId com measurementId null limpa o vinculo", async () => {
		contractPaymentUpdate.mockClear();
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			patchPayment({
				measurementId: null,
			}),
		);

		assertJsonResponse(response, 200);
		expect(contractPaymentUpdate).toHaveBeenCalledWith({
			where: { id: PAYMENT_ID, ownerId: TEST_OWNER },
			data: expect.objectContaining({ measurementId: null }),
		});
	});

	it("PATCH /payments/:pId com measurementId de outro contrato -> 404 sem atualizar", async () => {
		contractMeasurementFindFirst.mockImplementation(async () => null);
		contractPaymentUpdate.mockClear();
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			patchPayment({
				measurementId: "medicao-outro-contrato",
			}),
		);

		expect(response.status).toBe(404);
		expect(contractPaymentUpdate).not.toHaveBeenCalled();
	});
});
