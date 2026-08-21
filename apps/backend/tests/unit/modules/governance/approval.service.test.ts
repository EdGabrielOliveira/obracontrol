import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { ConstructionError } from "../../../../src/lib/errors";
import { hashApprovalPayload } from "../../../../src/modules/governance/approval.types";

const approvalRequestFindUnique = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const approvalRequestFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const userFindUnique = mock(
	async (): Promise<{ role: string | null } | null> => ({ role: "ADMIN" }),
);
const userFindMany = mock(async (): Promise<{ id: string }[]> => []);
const approvalRequestCreate = mock(
	async (args: { data: Record<string, unknown> }) => ({
		id: "req-1",
		...args.data,
	}),
);
const approvalRequestUpdate = mock(
	async (args: { data: Record<string, unknown> }) => ({
		id: "req-1",
		...args.data,
	}),
);
const approvalRequestUpdateMany = mock(async () => ({ count: 1 }));
const approvalDecisionCreate = mock(
	async (args: { data: Record<string, unknown> }) => ({
		id: "dec-1",
		...args.data,
	}),
);
const approvalReversalRequestFindUnique = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const approvalReversalRequestCreate = mock(
	async (args: { data: Record<string, unknown> }) => ({
		id: "reversal-1",
		...args.data,
	}),
);
const auditLogCreate = mock(async () => ({ id: "audit-1" }));
const orgMembershipFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const ccMembershipFindMany = mock(
	async (): Promise<{ costCenterId: string }[]> => [],
);
const budgetVersionFindFirst = mock(async () => ({
	id: "version-2",
	workId: "work-1",
	budgetImportId: null,
	sourceVersionId: null,
}));
const budgetVersionUpdateMany = mock(async () => ({ count: 1 }));
const budgetVersionUpdate = mock(async () => ({ id: "version-2" }));

const notificationFindUnique = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const notificationCreate = mock(
	async (args: { data: Record<string, unknown> }) => ({
		id: "notif-1",
		createdAt: new Date(),
		...args.data,
	}),
);

const transactionMock = mock(
	async (callback: (tx: Record<string, unknown>) => Promise<unknown>) =>
		callback({
			approvalRequest: {
				findUnique: approvalRequestFindUnique,
				create: approvalRequestCreate,
				update: approvalRequestUpdate,
				updateMany: approvalRequestUpdateMany,
			},
			approvalDecision: { create: approvalDecisionCreate },
			approvalReversalRequest: {
				create: approvalReversalRequestCreate,
			},
			auditLog: { create: auditLogCreate },
			organizationMembership: { findMany: orgMembershipFindMany },
			budgetVersion: {
				findFirst: budgetVersionFindFirst,
				updateMany: budgetVersionUpdateMany,
				update: budgetVersionUpdate,
			},
			notification: {
				findUnique: notificationFindUnique,
				create: notificationCreate,
			},
		}),
);

const approvalPolicyFindMany = mock(async () => []);

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		user: { findUnique: userFindUnique, findMany: userFindMany },
		approvalRequest: {
			findUnique: approvalRequestFindUnique,
			findMany: approvalRequestFindMany,
			create: approvalRequestCreate,
			update: approvalRequestUpdate,
			updateMany: approvalRequestUpdateMany,
		},
		approvalDecision: { create: approvalDecisionCreate },
		approvalReversalRequest: {
			findUnique: approvalReversalRequestFindUnique,
		},
		approvalPolicy: { findMany: approvalPolicyFindMany },
		organizationMembership: { findMany: orgMembershipFindMany },
		costCenterMembership: { findMany: ccMembershipFindMany },
		notification: {
			findUnique: notificationFindUnique,
			create: notificationCreate,
		},
		$transaction: transactionMock,
	},
}));

type ScopeMock = {
	role: "ADMIN" | "GERENTE" | "GESTOR" | "SUPERVISOR" | null;
	resourceOwnerId: string;
	canRead: boolean;
	canWrite: boolean;
	canApprove: boolean;
	canAdmin: boolean;
	path: {
		organizationId: string;
		costCenterId: string | null;
		workId: string | null;
	};
};

function makeScopeMock(overrides: Partial<ScopeMock> = {}): ScopeMock {
	return {
		role: "GERENTE",
		resourceOwnerId: "owner-1",
		canRead: true,
		canWrite: true,
		canApprove: true,
		canAdmin: false,
		path: { organizationId: "org-1", costCenterId: "cc-1", workId: "work-1" },
		...overrides,
	};
}

const resolveResourceScopeMock = mock(
	async (): Promise<ScopeMock> => makeScopeMock(),
);

mock.module("../../../../src/lib/resource-scope", () => ({
	resolveResourceScope: resolveResourceScopeMock,
	resolvePortfolioScope: mock(async () => ({ actorId: "user-1", paths: [] })),
}));

const applyHandler = mock(async () => undefined);
const canReverseHandler = mock(
	async (): Promise<{ reversible: boolean; reason?: string | null }> => ({
		reversible: true,
	}),
);
const compensateHandler = mock(async () => ({ reversedImpacts: 2 }));

async function importService() {
	const module = await import(
		"../../../../src/modules/governance/approval.service"
	);
	module.registerApprovalEffectHandler({
		action: "TEST_ACTION",
		apply: applyHandler,
	});
	module.registerApprovalEffectHandler({
		action: "TEST_REVERSIBLE_ACTION",
		apply: applyHandler,
		canReverse: canReverseHandler,
		compensate: compensateHandler,
	});
	return module;
}

function pendingRequest(overrides: Record<string, unknown> = {}) {
	return {
		id: "req-1",
		ownerId: "owner-1",
		actorId: "supervisor-1",
		actorRole: "SUPERVISOR",
		organizationId: "org-1",
		costCenterId: "cc-1",
		resourceType: "WORK",
		resourceId: "work-1",
		commandId: null,
		effectAction: "TEST_ACTION",
		payloadJson: { workId: "work-1" },
		payloadHash: "hash",
		expectedVersion: 1,
		idempotencyKey: "key-1",
		requiredApproverRole: "GESTOR",
		status: "PENDING",
		decidedAt: null,
		executedAt: null,
		conflictReason: null,
		...overrides,
	};
}

describe("approval service - cadeia fixa (DEC-004/DEC-005)", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		approvalRequestFindUnique.mockResolvedValue(null);
		approvalRequestFindMany.mockResolvedValue([]);
		userFindUnique.mockResolvedValue({ role: "ADMIN" });
		resolveResourceScopeMock.mockResolvedValue(makeScopeMock());
		approvalRequestCreate.mockImplementation(
			async (args: { data: Record<string, unknown> }) => ({
				id: "req-1",
				...args.data,
			}),
		);
		approvalRequestUpdate.mockImplementation(
			async (args: { data: Record<string, unknown> }) => ({
				id: "req-1",
				...args.data,
			}),
		);
		approvalRequestUpdateMany.mockResolvedValue({ count: 1 });
		approvalDecisionCreate.mockImplementation(
			async (args: { data: Record<string, unknown> }) => ({
				id: "dec-1",
				...args.data,
			}),
		);
		orgMembershipFindMany.mockResolvedValue([{ organizationId: "org-1" }]);
		ccMembershipFindMany.mockResolvedValue([{ costCenterId: "cc-1" }]);
	});

	it("ADMIN executa diretamente e grava decisao AUTOMATICO_POR_POLITICA", async () => {
		const { submitApproval } = await importService();
		const result = await submitApproval({
			actorId: "admin-1",
			resourceType: "WORK",
			resourceId: "work-1",
			effectAction: "TEST_ACTION",
			payload: { workId: "work-1", lines: [1, 2] },
			expectedVersion: 1,
			idempotencyKey: "key-1",
		});

		expect(result).toEqual({ status: "APPROVED", approvalRequestId: "req-1" });
		expect(approvalDecisionCreate).toHaveBeenCalledWith({
			data: {
				requestId: "req-1",
				approverId: null,
				decisionMode: "AUTOMATICO_POR_POLITICA",
				decision: "APPROVE",
				reason: null,
			},
		});
		expect(applyHandler).toHaveBeenCalledTimes(1);
		expect(approvalRequestUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ status: "EXECUTED" }),
			}),
		);
	});

	it("ADMIN ativa versao de orcamento diretamente com decisao automatica", async () => {
		resolveResourceScopeMock.mockResolvedValue(
			makeScopeMock({ role: "ADMIN" }),
		);
		const { submitApproval } = await importService();

		const result = await submitApproval({
			actorId: "admin-1",
			resourceType: "BUDGET_VERSION",
			resourceId: "work-1",
			effectAction: "BUDGET_VERSION_ACTIVATE",
			payload: { workId: "work-1", budgetVersionId: "version-2" },
			expectedVersion: 2,
			idempotencyKey: "budget-version-submit:version-2",
		});

		expect(result.status).toBe("APPROVED");
		expect(approvalRequestCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					actorRole: "ADMIN",
					status: "APPROVED",
				}),
			}),
		);
		expect(approvalDecisionCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					decisionMode: "AUTOMATICO_POR_POLITICA",
					decision: "APPROVE",
				}),
			}),
		);
		expect(budgetVersionUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: "version-2" },
				data: { status: "VIGENTE", isActive: true },
			}),
		);
	});

	it("ADMIN executa pendencia legada da propria versao sem autoaprovacao manual", async () => {
		const payload = { workId: "work-1", budgetVersionId: "version-2" };
		resolveResourceScopeMock.mockResolvedValue(
			makeScopeMock({ role: "ADMIN" }),
		);
		approvalRequestFindUnique.mockResolvedValue(
			pendingRequest({
				actorId: "admin-1",
				actorRole: "ADMIN",
				effectAction: "BUDGET_VERSION_ACTIVATE",
				payloadJson: payload,
				payloadHash: hashApprovalPayload(payload),
				expectedVersion: 2,
				idempotencyKey: "budget-version-submit:version-2",
			}),
		);
		const { submitApproval } = await importService();

		const result = await submitApproval({
			actorId: "admin-1",
			resourceType: "BUDGET_VERSION",
			resourceId: "work-1",
			effectAction: "BUDGET_VERSION_ACTIVATE",
			payload,
			expectedVersion: 2,
			idempotencyKey: "budget-version-submit:version-2",
		});

		expect(result.status).toBe("APPROVED");
		expect(approvalDecisionCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					decisionMode: "AUTOMATICO_POR_POLITICA",
				}),
			}),
		);
		expect(approvalRequestUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: "req-1" },
				data: expect.objectContaining({ status: "EXECUTED" }),
			}),
		);
	});

	it("GERENTE executa diretamente dentro do escopo", async () => {
		userFindUnique.mockResolvedValue({ role: "GERENTE" });
		resolveResourceScopeMock.mockResolvedValue(
			makeScopeMock({ role: "GERENTE" }),
		);
		const { submitApproval } = await importService();

		const result = await submitApproval({
			actorId: "gerente-1",
			resourceType: "WORK",
			resourceId: "work-1",
			effectAction: "TEST_ACTION",
			payload: { workId: "work-1" },
			expectedVersion: 1,
			idempotencyKey: "gerente-1",
		});

		expect(result.status).toBe("APPROVED");
		expect(applyHandler).toHaveBeenCalledTimes(1);
	});

	it("SUPERVISOR gera solicitacao PENDING para GESTOR sem efeito", async () => {
		userFindUnique.mockResolvedValue({ role: "SUPERVISOR" });
		resolveResourceScopeMock.mockResolvedValue(
			makeScopeMock({ role: "SUPERVISOR" }),
		);
		const { submitApproval } = await importService();

		const result = await submitApproval({
			actorId: "supervisor-1",
			resourceType: "WORK",
			resourceId: "work-1",
			effectAction: "TEST_ACTION",
			payload: { workId: "work-1" },
			expectedVersion: 1,
			idempotencyKey: "supervisor-1",
		});

		expect(result.status).toBe("PENDING");
		expect(approvalRequestCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					actorRole: "SUPERVISOR",
					requiredApproverRole: "GESTOR",
					organizationId: "org-1",
					costCenterId: "cc-1",
					status: "PENDING",
				}),
			}),
		);
		expect(applyHandler).not.toHaveBeenCalled();
	});

	it("GESTOR gera solicitacao PENDING para GERENTE", async () => {
		userFindUnique.mockResolvedValue({ role: "GESTOR" });
		resolveResourceScopeMock.mockResolvedValue(
			makeScopeMock({ role: "GESTOR" }),
		);
		const { submitApproval } = await importService();

		const result = await submitApproval({
			actorId: "gestor-1",
			resourceType: "WORK",
			resourceId: "work-1",
			effectAction: "TEST_ACTION",
			payload: { workId: "work-1" },
			expectedVersion: 1,
			idempotencyKey: "gestor-1",
		});

		expect(result.status).toBe("PENDING");
		expect(approvalRequestCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					actorRole: "GESTOR",
					requiredApproverRole: "GERENTE",
					status: "PENDING",
				}),
			}),
		);
		expect(applyHandler).not.toHaveBeenCalled();
	});

	it("persiste payload com hash na solicitacao", async () => {
		userFindUnique.mockResolvedValue({ role: "SUPERVISOR" });
		resolveResourceScopeMock.mockResolvedValue(
			makeScopeMock({ role: "SUPERVISOR" }),
		);
		const { submitApproval } = await importService();
		await submitApproval({
			actorId: "supervisor-1",
			resourceType: "WORK",
			resourceId: "work-1",
			effectAction: "TEST_ACTION",
			payload: { workId: "work-1", amount: 100 },
			expectedVersion: 2,
			idempotencyKey: "key-2",
		});

		expect(approvalRequestCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					expectedVersion: 2,
					idempotencyKey: "key-2",
					payloadHash: expect.stringMatching(/^[0-9a-f]{64}$/),
				}),
			}),
		);
	});

	it("rejects an idempotency key reused with a different payload", async () => {
		approvalRequestFindUnique.mockResolvedValue({
			...pendingRequest(),
			payloadHash: hashApprovalPayload({ workId: "work-1", amount: 100 }),
		});
		const { submitApproval } = await importService();

		await expect(
			submitApproval({
				actorId: "supervisor-1",
				resourceType: "WORK",
				resourceId: "work-1",
				effectAction: "TEST_ACTION",
				payload: { workId: "work-1", amount: 200 },
				expectedVersion: 1,
				idempotencyKey: "key-1",
			}),
		).rejects.toMatchObject({
			code: "APPROVAL_IDEMPOTENCY_CONFLICT",
			status: 409,
		});
	});

	it("GESTOR do mesmo centro aprova solicitacao de SUPERVISOR e encaminha ao GERENTE", async () => {
		approvalRequestFindUnique.mockResolvedValue(pendingRequest());
		userFindUnique.mockResolvedValue({ role: "GESTOR" });
		resolveResourceScopeMock.mockResolvedValue(
			makeScopeMock({ role: "GESTOR" }),
		);
		const { decideApproval } = await importService();

		const result = await decideApproval({
			approverId: "gestor-1",
			requestId: "req-1",
			decision: "APPROVE",
			reason: "Dentro do orcamento",
		});

		expect(result.decision).toBe("APPROVE");
		expect(applyHandler).not.toHaveBeenCalled();
		expect(approvalRequestUpdateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ status: "APPROVED" }),
			}),
		);
		expect(approvalRequestCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					requiredApproverRole: "GERENTE",
					status: "PENDING",
				}),
			}),
		);
	});

	it("GERENTE pode fazer override auditado da solicitacao de SUPERVISOR", async () => {
		approvalRequestFindUnique.mockResolvedValue(pendingRequest());
		userFindUnique.mockResolvedValue({ role: "GERENTE" });
		resolveResourceScopeMock.mockResolvedValue(
			makeScopeMock({ role: "GERENTE" }),
		);
		const { decideApproval } = await importService();

		const result = await decideApproval({
			approverId: "gerente-1",
			requestId: "req-1",
			decision: "APPROVE",
			reason: "Override dentro da organizacao",
		});

		expect(result.decision).toBe("APPROVE");
		expect(applyHandler).toHaveBeenCalledTimes(1);
	});

	it("GERENTE da mesma organizacao aprova solicitacao de GESTOR", async () => {
		approvalRequestFindUnique.mockResolvedValue(
			pendingRequest({
				actorId: "gestor-1",
				actorRole: "GESTOR",
				requiredApproverRole: "GERENTE",
			}),
		);
		userFindUnique.mockResolvedValue({ role: "GERENTE" });
		resolveResourceScopeMock.mockResolvedValue(
			makeScopeMock({ role: "GERENTE" }),
		);
		const { decideApproval } = await importService();

		const result = await decideApproval({
			approverId: "gerente-1",
			requestId: "req-1",
			decision: "APPROVE",
			reason: "Ok",
		});

		expect(result.decision).toBe("APPROVE");
		expect(applyHandler).toHaveBeenCalledTimes(1);
	});

	it("proibe autoaprovacao", async () => {
		approvalRequestFindUnique.mockResolvedValue(pendingRequest());
		userFindUnique.mockResolvedValue({ role: "GESTOR" });
		resolveResourceScopeMock.mockResolvedValue(
			makeScopeMock({ role: "GESTOR" }),
		);
		const { decideApproval } = await importService();

		let error: ConstructionError | undefined;
		try {
			await decideApproval({
				approverId: "supervisor-1",
				requestId: "req-1",
				decision: "APPROVE",
				reason: "Teste de autoaprovacao",
			});
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("FORBIDDEN");
		expect(error?.status).toBe(403);
		expect(approvalRequestUpdateMany).not.toHaveBeenCalled();
	});

	it("exige motivo para rejeitar", async () => {
		approvalRequestFindUnique.mockResolvedValue(pendingRequest());
		userFindUnique.mockResolvedValue({ role: "GESTOR" });
		resolveResourceScopeMock.mockResolvedValue(
			makeScopeMock({ role: "GESTOR" }),
		);
		const { decideApproval } = await importService();

		let error: ConstructionError | undefined;
		try {
			await decideApproval({
				approverId: "gestor-1",
				requestId: "req-1",
				decision: "REJECT",
			});
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("APPROVAL_REASON_REQUIRED");
		expect(error?.status).toBe(422);
	});

	it("exige justificativa para aprovacao do GESTOR", async () => {
		approvalRequestFindUnique.mockResolvedValue(pendingRequest());
		userFindUnique.mockResolvedValue({ role: "GESTOR" });
		resolveResourceScopeMock.mockResolvedValue(
			makeScopeMock({ role: "GESTOR" }),
		);
		const { decideApproval } = await importService();

		await expect(
			decideApproval({
				approverId: "gestor-1",
				requestId: "req-1",
				decision: "APPROVE",
			}),
		).rejects.toMatchObject({
			code: "APPROVAL_REASON_REQUIRED",
			status: 422,
		});
	});

	it("rejeita decisao de aprovador com papel errado", async () => {
		approvalRequestFindUnique.mockResolvedValue(pendingRequest());
		userFindUnique.mockResolvedValue({ role: "SUPERVISOR" });
		resolveResourceScopeMock.mockResolvedValue(
			makeScopeMock({ role: "SUPERVISOR" }),
		);
		const { decideApproval } = await importService();

		let error: ConstructionError | undefined;
		try {
			await decideApproval({
				approverId: "supervisor-outro",
				requestId: "req-1",
				decision: "APPROVE",
			});
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("FORBIDDEN");
		expect(error?.status).toBe(403);
	});

	it("ADMIN nao precisa aprovar manualmente uma pendencia legada criada por ele", async () => {
		const payload = { workId: "work-1", budgetVersionId: "version-2" };
		approvalRequestFindUnique.mockResolvedValue(
			pendingRequest({
				actorId: "admin-1",
				actorRole: "ADMIN",
				effectAction: "BUDGET_VERSION_ACTIVATE",
				payloadJson: payload,
				payloadHash: hashApprovalPayload(payload),
				expectedVersion: 1,
				idempotencyKey: "key-1",
			}),
		);
		userFindUnique.mockResolvedValue({ role: "ADMIN" });
		resolveResourceScopeMock.mockResolvedValue(
			makeScopeMock({ role: "ADMIN" }),
		);
		const { decideApproval } = await importService();

		const result = await decideApproval({
			approverId: "admin-1",
			requestId: "req-1",
			decision: "APPROVE",
		});

		expect(result).toEqual({
			id: "automatic-legacy",
			requestId: "req-1",
			decision: "APPROVE",
		});
		expect(approvalRequestUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: "req-1" },
				data: expect.objectContaining({ status: "EXECUTED" }),
			}),
		);
	});

	it("ADMIN override exige motivo auditavel (APPROVAL_OVERRIDE_REASON_REQUIRED)", async () => {
		approvalRequestFindUnique.mockResolvedValue(pendingRequest());
		userFindUnique.mockResolvedValue({ role: "ADMIN" });
		const { decideApproval } = await importService();

		let error: ConstructionError | undefined;
		try {
			await decideApproval({
				approverId: "admin-1",
				requestId: "req-1",
				decision: "APPROVE",
			});
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("APPROVAL_OVERRIDE_REASON_REQUIRED");
		expect(error?.status).toBe(422);
		expect(approvalRequestUpdateMany).not.toHaveBeenCalled();
	});

	it("ADMIN override com motivo grava decisao ADMIN_OVERRIDE e executa efeito", async () => {
		approvalRequestFindUnique.mockResolvedValue(pendingRequest());
		userFindUnique.mockResolvedValue({ role: "ADMIN" });
		const { decideApproval } = await importService();

		const result = await decideApproval({
			approverId: "admin-1",
			requestId: "req-1",
			decision: "APPROVE",
			reason: "Override emergencial aprovado pela diretoria",
		});

		expect(result.decision).toBe("APPROVE");
		expect(approvalRequestUpdateMany).toHaveBeenCalled();
		const savedDecision = approvalDecisionCreate.mock.calls
			.map((call) => (call[0] as { data?: Record<string, unknown> }).data)
			.find((data) => data?.decisionMode === "ADMIN_OVERRIDE");
		expect(savedDecision).toBeDefined();
		expect(savedDecision?.reason).toBe(
			"Override emergencial aprovado pela diretoria",
		);
	});

	it("GOV-02: decisao de Supervisor notifica Gerentes elegiveis na mesma transacao", async () => {
		approvalRequestFindUnique.mockResolvedValue(pendingRequest());
		userFindUnique.mockResolvedValue({ role: "GESTOR" });
		resolveResourceScopeMock.mockResolvedValue(
			makeScopeMock({ role: "GESTOR" }),
		);
		orgMembershipFindMany.mockResolvedValue([
			{ userId: "gerente-1", user: { role: "GERENTE" } },
			{ userId: "gerente-2", user: { role: "GERENTE" } },
			{ userId: "gestor-outro", user: { role: "GESTOR" } },
		]);
		const { decideApproval } = await importService();

		await decideApproval({
			approverId: "gestor-1",
			requestId: "req-1",
			decision: "APPROVE",
			reason: "Aprovacao operacional",
		});

		const notified = notificationCreate.mock.calls
			.map((call) => (call[0] as { data?: Record<string, unknown> }).data)
			.filter((data) => data?.eventType === "APPROVAL_MANAGER_REVIEW_REQUIRED");
		expect(notified).toHaveLength(2);
		expect(notified.map((data) => data?.recipientId).sort()).toEqual([
			"gerente-1",
			"gerente-2",
		]);
		const first = notified[0];
		expect(String(first?.referenceId)).toBe("req-1");
		expect(String(first?.body)).toContain("aguarda decisao final");
	});

	it("GOV-02: nao-GERENTE na organizacao nao e notificado", async () => {
		approvalRequestFindUnique.mockResolvedValue(pendingRequest());
		userFindUnique.mockResolvedValue({ role: "GESTOR" });
		resolveResourceScopeMock.mockResolvedValue(
			makeScopeMock({ role: "GESTOR" }),
		);
		orgMembershipFindMany.mockResolvedValue([
			{ userId: "gestor-sem-acesso", user: { role: "GESTOR" } },
			{ userId: "supervisor-sem-acesso", user: { role: "SUPERVISOR" } },
		]);
		const { decideApproval } = await importService();

		await decideApproval({
			approverId: "gestor-1",
			requestId: "req-1",
			decision: "APPROVE",
			reason: "Aprovacao operacional",
		});

		const notified = notificationCreate.mock.calls
			.map((call) => (call[0] as { data?: Record<string, unknown> }).data)
			.filter((data) => data?.eventType === "SUPERVISOR_REQUEST_EXECUTED");
		expect(notified).toHaveLength(0);
	});

	it("GOV-02: solicitacao de GESTOR (decisor GERENTE) nao gera SUPERVISOR_REQUEST_EXECUTED", async () => {
		approvalRequestFindUnique.mockResolvedValue(
			pendingRequest({ actorRole: "GESTOR", requiredApproverRole: "GERENTE" }),
		);
		userFindUnique.mockResolvedValue({ role: "GERENTE" });
		resolveResourceScopeMock.mockResolvedValue(
			makeScopeMock({ role: "GERENTE" }),
		);
		const { decideApproval } = await importService();

		await decideApproval({
			approverId: "gerente-1",
			requestId: "req-1",
			decision: "APPROVE",
		});

		const notified = notificationCreate.mock.calls
			.map((call) => (call[0] as { data?: Record<string, unknown> }).data)
			.filter((data) => data?.eventType === "SUPERVISOR_REQUEST_EXECUTED");
		expect(notified).toHaveLength(0);
	});

	it("GOV-02: rejeicao nao notifica SUPERVISOR_REQUEST_EXECUTED", async () => {
		approvalRequestFindUnique.mockResolvedValue(pendingRequest());
		userFindUnique.mockResolvedValue({ role: "GESTOR" });
		resolveResourceScopeMock.mockResolvedValue(
			makeScopeMock({ role: "GESTOR" }),
		);
		orgMembershipFindMany.mockResolvedValue([
			{ userId: "gerente-1", user: { role: "GERENTE" } },
		]);
		const { decideApproval } = await importService();

		await decideApproval({
			approverId: "gestor-1",
			requestId: "req-1",
			decision: "REJECT",
			reason: "Escopo insuficiente",
		});

		const notified = notificationCreate.mock.calls
			.map((call) => (call[0] as { data?: Record<string, unknown> }).data)
			.filter((data) => data?.eventType === "SUPERVISOR_REQUEST_EXECUTED");
		expect(notified).toHaveLength(0);
	});

	it("rejeita GESTOR de outro centro de custo", async () => {
		approvalRequestFindUnique.mockResolvedValue(pendingRequest());
		userFindUnique.mockResolvedValue({ role: "GESTOR" });
		resolveResourceScopeMock.mockResolvedValue(
			makeScopeMock({
				role: "GESTOR",
				path: {
					organizationId: "org-1",
					costCenterId: "cc-other",
					workId: null,
				},
			}),
		);
		const { decideApproval } = await importService();

		let error: ConstructionError | undefined;
		try {
			await decideApproval({
				approverId: "gestor-outro-cc",
				requestId: "req-1",
				decision: "APPROVE",
				reason: "Validacao de escopo",
			});
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("FORBIDDEN");
		expect(error?.status).toBe(403);
	});

	it("rejeita GERENTE de outra organizacao", async () => {
		approvalRequestFindUnique.mockResolvedValue(
			pendingRequest({ requiredApproverRole: "GERENTE" }),
		);
		userFindUnique.mockResolvedValue({ role: "GERENTE" });
		resolveResourceScopeMock.mockResolvedValue(
			makeScopeMock({
				role: "GERENTE",
				path: { organizationId: "org-other", costCenterId: null, workId: null },
			}),
		);
		const { decideApproval } = await importService();

		let error: ConstructionError | undefined;
		try {
			await decideApproval({
				approverId: "gerente-outro-org",
				requestId: "req-1",
				decision: "APPROVE",
			});
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("FORBIDDEN");
		expect(error?.status).toBe(403);
	});

	it("retorna APPROVAL_CONFLICT quando a decisao condicional afeta zero linhas", async () => {
		approvalRequestFindUnique.mockResolvedValue(pendingRequest());
		approvalRequestUpdateMany.mockResolvedValue({ count: 0 });
		userFindUnique.mockResolvedValue({ role: "GESTOR" });
		resolveResourceScopeMock.mockResolvedValue(
			makeScopeMock({ role: "GESTOR" }),
		);
		const { decideApproval } = await importService();

		let error: ConstructionError | undefined;
		try {
			await decideApproval({
				approverId: "gestor-1",
				requestId: "req-1",
				decision: "APPROVE",
				reason: "Aprovacao operacional",
			});
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("APPROVAL_CONFLICT");
		expect(error?.status).toBe(409);
	});

	it("recusa effectAction sem handler registrado", async () => {
		const { submitApproval } = await importService();
		let error: ConstructionError | undefined;
		try {
			await submitApproval({
				actorId: "supervisor-1",
				resourceType: "WORK",
				resourceId: "work-1",
				effectAction: "UNREGISTERED",
				payload: {},
				expectedVersion: 1,
				idempotencyKey: "key-3",
			});
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("UNSUPPORTED_EFFECT_ACTION");
		expect(error?.status).toBe(422);
	});

	it("usuario sem escrita nao pode submeter", async () => {
		resolveResourceScopeMock.mockResolvedValue(
			makeScopeMock({
				role: null,
				canRead: false,
				canWrite: false,
				canApprove: false,
				resourceOwnerId: "",
			}),
		);
		const { submitApproval } = await importService();

		let error: ConstructionError | undefined;
		try {
			await submitApproval({
				actorId: "fora-1",
				resourceType: "WORK",
				resourceId: "work-1",
				effectAction: "TEST_ACTION",
				payload: { workId: "work-1" },
				expectedVersion: 1,
				idempotencyKey: "sem-write",
			});
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("FORBIDDEN");
		expect(error?.status).toBe(403);
		expect(approvalRequestCreate).not.toHaveBeenCalled();
	});
});

describe("approval service - listPendingApprovals por escopo de aprovador", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		approvalRequestFindMany.mockResolvedValue([]);
		userFindUnique.mockResolvedValue({ role: "ADMIN" });
		orgMembershipFindMany.mockResolvedValue([{ organizationId: "org-1" }]);
		ccMembershipFindMany.mockResolvedValue([{ costCenterId: "cc-1" }]);
	});

	function pendingRow(id: string, requiredApproverRole: string) {
		return {
			id,
			ownerId: "owner-1",
			actorId: "supervisor-1",
			actorRole: "SUPERVISOR",
			organizationId: "org-1",
			costCenterId: "cc-1",
			resourceType: "WORK",
			resourceId: "work-1",
			commandId: null,
			effectAction: "COST_APPROVE",
			payloadJson: { workId: "work-1" },
			payloadHash: "hash",
			expectedVersion: 1,
			idempotencyKey: `key-${id}`,
			requiredApproverRole,
			status: "PENDING",
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
		};
	}

	it("ADMIN lista todas as pendentes da plataforma", async () => {
		approvalRequestFindMany.mockResolvedValue([
			pendingRow("req-1", "GESTOR"),
			pendingRow("req-2", "GERENTE"),
		]);

		const { listPendingApprovals } = await importService();
		const result = await listPendingApprovals("admin-1");

		expect(approvalRequestFindMany).toHaveBeenCalledWith({
			where: { status: "PENDING" },
			include: {
				actor: { select: { name: true } },
				decisions: { select: { reason: true }, take: 1 },
			},
			orderBy: { createdAt: "desc" },
			take: 100,
		});
		expect(result).toHaveLength(2);
	});

	it("GERENTE lista somente pendentes da propria organizacao", async () => {
		userFindUnique.mockResolvedValue({ role: "GERENTE" });
		approvalRequestFindMany.mockResolvedValue([
			pendingRow("req-1", "GERENTE"),
			pendingRow("req-2", "GESTOR"),
		]);

		const { listPendingApprovals } = await importService();
		const result = await listPendingApprovals("gerente-1");

		expect(approvalRequestFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					status: "PENDING",
					requiredApproverRole: "GERENTE",
					organizationId: { in: ["org-1"] },
				}),
			}),
		);
		expect(result).toHaveLength(2);
	});

	it("GESTOR lista somente pendentes do proprio centro de custo", async () => {
		userFindUnique.mockResolvedValue({ role: "GESTOR" });
		approvalRequestFindMany.mockResolvedValue([pendingRow("req-1", "GESTOR")]);

		const { listPendingApprovals } = await importService();
		const result = await listPendingApprovals("gestor-1");

		expect(approvalRequestFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					status: "PENDING",
					requiredApproverRole: "GESTOR",
					organizationId: { in: ["org-1"] },
					costCenterId: { in: ["cc-1"] },
				}),
			}),
		);
		expect(result).toHaveLength(1);
	});

	it("negocia listagem para papel sem aprovacao (SUPERVISOR)", async () => {
		userFindUnique.mockResolvedValue({ role: "SUPERVISOR" });

		const { listPendingApprovals } = await importService();

		let error: ConstructionError | undefined;
		try {
			await listPendingApprovals("supervisor-1", "work-1");
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("FORBIDDEN");
		expect(error?.status).toBe(403);
		expect(approvalRequestFindMany).not.toHaveBeenCalled();
	});

	it("filtra por obra quando workId e informado", async () => {
		approvalRequestFindMany.mockResolvedValue([
			pendingRow("req-1", "GESTOR"),
			{
				...pendingRow("req-2", "GESTOR"),
				payloadJson: { workId: "work-other" },
			},
		]);

		const { listPendingApprovals } = await importService();
		const result = await listPendingApprovals("admin-1", "work-1");

		expect(result.map((row) => row.id)).toEqual(["req-1"]);
	});
});

describe("approval service - reversao compensatoria (GOV-03)", () => {
	function executedRequest(overrides: Record<string, unknown> = {}) {
		return pendingRequest({
			status: "EXECUTED",
			effectAction: "TEST_REVERSIBLE_ACTION",
			executedAt: new Date().toISOString(),
			...overrides,
		});
	}

	beforeEach(() => {
		mock.clearAllMocks();
		userFindUnique.mockResolvedValue({ role: "GERENTE" });
		resolveResourceScopeMock.mockResolvedValue(makeScopeMock());
		approvalReversalRequestFindUnique.mockResolvedValue(null);
		canReverseHandler.mockResolvedValue({ reversible: true });
	});

	it("exige motivo para reverter (REVERSAL_REASON_REQUIRED)", async () => {
		approvalRequestFindUnique.mockResolvedValue(executedRequest());
		const { requestReversal } = await importService();

		let error: ConstructionError | undefined;
		try {
			await requestReversal({
				actorId: "gerente-1",
				requestId: "req-1",
				reason: "   ",
				expectedVersion: 1,
			});
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("REVERSAL_REASON_REQUIRED");
		expect(error?.status).toBe(422);
	});

	it("somente solicitacoes EXECUTED sao reversiveis", async () => {
		approvalRequestFindUnique.mockResolvedValue(pendingRequest());
		const { requestReversal } = await importService();

		let error: ConstructionError | undefined;
		try {
			await requestReversal({
				actorId: "gerente-1",
				requestId: "req-1",
				reason: "Erro operacional",
				expectedVersion: 1,
			});
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("REVERSAL_NOT_AVAILABLE");
		expect(error?.status).toBe(409);
	});

	it("GESTOR/SUPERVISOR nao podem reverter (capability de revisao)", async () => {
		approvalRequestFindUnique.mockResolvedValue(executedRequest());
		userFindUnique.mockResolvedValue({ role: "GESTOR" });
		const { requestReversal } = await importService();

		let error: ConstructionError | undefined;
		try {
			await requestReversal({
				actorId: "gestor-1",
				requestId: "req-1",
				reason: "Erro operacional",
				expectedVersion: 1,
			});
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("FORBIDDEN");
		expect(error?.status).toBe(403);
	});

	it("efeito sem canReverse nao e reversivel", async () => {
		approvalRequestFindUnique.mockResolvedValue(
			executedRequest({ effectAction: "TEST_ACTION" }),
		);
		const { requestReversal } = await importService();

		let error: ConstructionError | undefined;
		try {
			await requestReversal({
				actorId: "gerente-1",
				requestId: "req-1",
				reason: "Erro operacional",
				expectedVersion: 1,
			});
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("REVERSAL_NOT_AVAILABLE");
		expect(error?.status).toBe(422);
	});

	it("canReverse=false bloqueia com o motivo do handler", async () => {
		approvalRequestFindUnique.mockResolvedValue(executedRequest());
		canReverseHandler.mockResolvedValue({
			reversible: false,
			reason: "Impacto ja revertido",
		});
		const { requestReversal } = await importService();

		let error: ConstructionError | undefined;
		try {
			await requestReversal({
				actorId: "gerente-1",
				requestId: "req-1",
				reason: "Erro operacional",
				expectedVersion: 1,
			});
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("REVERSAL_NOT_AVAILABLE");
		expect(error?.message).toBe("Impacto ja revertido");
	});

	it("segunda reversao e rejeitada (REVERSAL_ALREADY_EXISTS)", async () => {
		approvalRequestFindUnique.mockResolvedValue(executedRequest());
		approvalReversalRequestFindUnique.mockResolvedValue({ id: "reversal-1" });
		const { requestReversal } = await importService();

		let error: ConstructionError | undefined;
		try {
			await requestReversal({
				actorId: "gerente-1",
				requestId: "req-1",
				reason: "Erro operacional",
				expectedVersion: 1,
			});
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("REVERSAL_ALREADY_EXISTS");
		expect(error?.status).toBe(409);
		expect(compensateHandler).not.toHaveBeenCalled();
	});

	it("reversao bem-sucedida persiste resultado, auditoria e notificacao", async () => {
		approvalRequestFindUnique.mockResolvedValue(executedRequest());
		const { requestReversal } = await importService();

		const result = await requestReversal({
			actorId: "gerente-1",
			requestId: "req-1",
			reason: "Medicao incorreta aprovada",
			expectedVersion: 1,
		});

		expect(result.status).toBe("EXECUTED");
		expect(result.result).toEqual({ reversedImpacts: 2 });
		expect(compensateHandler).toHaveBeenCalled();
		const saved = approvalReversalRequestCreate.mock.calls.map(
			(call) => (call[0] as { data?: Record<string, unknown> }).data,
		)[approvalReversalRequestCreate.mock.calls.length - 1];
		expect(saved?.requestId).toBe("req-1");
		expect(saved?.actorId).toBe("gerente-1");
		expect(saved?.reason).toBe("Medicao incorreta aprovada");
		expect(saved?.status).toBe("EXECUTED");
		expect(auditLogCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					action: "REVERSE",
					entityType: "APPROVAL_REQUEST",
				}),
			}),
		);
		const notified = notificationCreate.mock.calls
			.map((call) => (call[0] as { data?: Record<string, unknown> }).data)
			.filter((data) => data?.eventType === "APPROVAL_REVERSED");
		expect(notified).toHaveLength(1);
		expect(notified[0]?.recipientId).toBe("supervisor-1");
	});
});
