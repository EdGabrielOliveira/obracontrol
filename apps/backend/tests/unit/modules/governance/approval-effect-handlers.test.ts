import { describe, expect, it, mock } from "bun:test";
import { hashApprovalPayload } from "../../../../src/modules/governance/approval.types";

const createContractWithEffectsInTx = mock(async () => ({
	contract: {
		id: "contract-1",
		code: "CT-001",
		contractValue: 1000,
		serviceCount: 0,
		status: "RASCUNHO",
	},
	replayed: false,
}));
const writeAudit = mock(async () => ({ id: "audit-1" }));
mock.module("../../../../src/lib/audit-writer", () => ({ writeAudit }));
mock.module(
	"../../../../src/modules/construction-planning/contracts/contract-creation.service",
	() => ({
		createContractWithEffectsInTx,
	}),
);

import { approvalEffectHandlers } from "../../../../src/modules/governance/approval-effect-handlers";

const budgetVersionFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => ({
		id: "budget-version-1",
		workId: "work-1",
		status: "RASCUNHO",
		isActive: false,
	}),
);
const budgetVersionCount = mock(async () => 0);
const budgetVersionUpdateMany = mock(async () => ({ count: 1 }));
const budgetVersionUpdate = mock(async () => ({ id: "budget-version-1" }));
const scheduleVersionFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const scheduleVersionUpdateMany = mock(async () => ({ count: 1 }));
const scheduleVersionUpdate = mock(async () => ({ id: "schedule-version-1" }));
const governanceRecordUpsert = mock(async () => ({}));
const importBatchFindUnique = mock(async () => ({
	id: "batch-1",
	ownerId: "owner-1",
	workId: "work-1",
	status: "READY",
	batchVersion: 1,
	model: "obra-completa",
	expiresAt: new Date(Date.now() + 60_000),
	parsedWorkbook: {
		fileName: "obra.xlsx",
		sheetName: "Obra",
		header: {},
		work: { code: "OBRA-1", name: "Obra" },
		budgetRows: [
			{ rowNumber: 2, index: "1" },
			{ rowNumber: 3, index: "2" },
		],
		itensRows: [],
		baselineRows: [],
		replanningRows: [],
		measurementRows: [],
		contractRows: [],
		serviceRows: [],
		contractMeasurementRows: [],
		paymentRows: [],
		actualCostRows: [],
		sheetNames: ["Obra", "Orcamento"],
	},
}));
const importRowFindMany = mock(async () => [
	{ id: "row-1", sheet: "Orcamento", rowNumber: 2, status: "VALID" },
]);
const importBatchUpdate = mock(async () => ({}));
const importBatchUpdateMany = mock(async () => ({ count: 1 }));
const applyStagedWorkbook = mock(async () => ({ importId: "import-1" }));
const approveBudgetImpact = mock(async () => ({
	status: "APPROVED",
	requiresApproval: false,
	availableBalance: 0,
	projectedBalance: 0,
	allocations: [],
}));
const rejectBudgetImpact = mock(async () => undefined);
const projectApprovedVersion = mock(async () => ({ importId: "import-1" }));
const workDeleteMany = mock(async () => ({ count: 0 }));

mock.module(
	"../../../../src/modules/construction-planning/budget-version-projection.service",
	() => ({
		projectApprovedBudgetVersion: projectApprovedVersion,
	}),
);

mock.module(
	"../../../../src/modules/construction-planning/imports/import-service",
	() => ({
		constructionImportService: { applyStagedWorkbook },
		ConstructionImportService: class {},
		rejectedRowCount: () => 0,
		importWorkbook: async () => ({}),
		previewWorkbook: async () => ({}),
		buildRejectedSheet: () => new Uint8Array(),
	}),
);

mock.module(
	"../../../../src/modules/construction-planning/budget-control/budget-control.service",
	() => ({
		budgetControlService: {
			approve: approveBudgetImpact,
			reject: rejectBudgetImpact,
		},
	}),
);

function makeTx() {
	return {
		constructionWork: {
			findFirst: mock(async () => ({ id: "work-1", ownerId: "owner-1" })),
			delete: mock(async () => ({ id: "work-1" })),
		},
		quotationBudgetItem: { deleteMany: workDeleteMany },
		contractRequestBudgetItem: { deleteMany: workDeleteMany },
		quotation: { deleteMany: workDeleteMany },
		constructionBudgetReconciliation: { deleteMany: workDeleteMany },
		constructionMonthlyFact: { deleteMany: workDeleteMany },
		budgetVersion: {
			findFirst: budgetVersionFindFirst,
			count: budgetVersionCount,
			updateMany: budgetVersionUpdateMany,
			update: budgetVersionUpdate,
		},
		scheduleVersion: {
			findFirst: scheduleVersionFindFirst,
			updateMany: scheduleVersionUpdateMany,
			update: scheduleVersionUpdate,
		},
		governanceRecord: { upsert: governanceRecordUpsert },
		importBatch: {
			findUnique: importBatchFindUnique,
			update: importBatchUpdate,
			updateMany: importBatchUpdateMany,
			deleteMany: workDeleteMany,
		},
		importRow: { findMany: importRowFindMany },
	};
}

function makeRequest(overrides: Record<string, unknown> = {}) {
	const request = {
		id: "req-1",
		ownerId: "owner-1",
		actorId: "user-1",
		resourceType: "BUDGET_VERSION",
		resourceId: "budget-version-1",
		effectAction: "BUDGET_VERSION_ACTIVATE",
		payloadJson: { workId: "work-1", budgetVersionId: "budget-version-1" },
		payloadHash: "hash",
		expectedVersion: 1,
		idempotencyKey: "key-1",
		status: "APPROVED",
		...overrides,
	};
	if (request.effectAction === "IMPORT_CONFIRM") {
		request.payloadHash = hashApprovalPayload(request.payloadJson);
	}
	return request;
}

const decision = {
	id: "dec-1",
	requestId: "req-1",
	approverId: "admin-1",
	decisionMode: "MANUAL_POR_SUPERIOR" as const,
	decision: "APPROVE" as const,
	reason: null,
};

describe("approval effect handlers", () => {
	it("BUDGET_VERSION_ACTIVATE ativa a versao e desativa as demais", async () => {
		const handler = approvalEffectHandlers.find(
			(h) => h.action === "BUDGET_VERSION_ACTIVATE",
		);
		expect(handler).toBeDefined();

		await handler?.apply({
			tx: makeTx() as never,
			request: makeRequest() as never,
			decision,
		});

		expect(budgetVersionUpdateMany).toHaveBeenCalledWith({
			where: { workId: "work-1", isActive: true },
			data: { isActive: false, status: "SUBSTITUIDO" },
		});
		expect(budgetVersionUpdate).toHaveBeenCalledWith({
			where: { id: "budget-version-1" },
			data: { status: "VIGENTE", isActive: true },
		});
	});

	it("BUDGET_VERSION_ACTIVATE projeta a versao importada antes de ativar", async () => {
		const handler = approvalEffectHandlers.find(
			(h) => h.action === "BUDGET_VERSION_ACTIVATE",
		);
		expect(handler).toBeDefined();
		budgetVersionFindFirst.mockResolvedValueOnce({
			id: "budget-version-2",
			workId: "work-1",
			status: "RASCUNHO",
			isActive: false,
			sourceVersionId: "budget-version-1",
			budgetImportId: "import-1",
		});
		budgetVersionCount.mockResolvedValueOnce(1);

		await handler?.apply({
			tx: makeTx() as never,
			request: makeRequest({
				payloadJson: {
					workId: "work-1",
					budgetVersionId: "budget-version-2",
				},
			}) as never,
			decision,
		});

		expect(projectApprovedVersion).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				ownerId: "owner-1",
				workId: "work-1",
				budgetVersionId: "budget-version-2",
			}),
		);
	});

	it("WORK_MEASUREMENT_APPROVE nao grava lock legado ACEITO (decisao vem do ApprovalRequest)", async () => {
		const handler = approvalEffectHandlers.find(
			(h) => h.action === "WORK_MEASUREMENT_APPROVE",
		);
		expect(handler).toBeDefined();

		await handler?.apply({
			tx: makeTx() as never,
			request: makeRequest({
				resourceId: "work-1",
				payloadJson: { workId: "work-1" },
			}) as never,
			decision,
		});

		const governanceUpsert = makeTx().governanceRecord.upsert as ReturnType<
			typeof mock
		>;
		expect(governanceUpsert).not.toHaveBeenCalled();
	});

	it("applies only the selected valid or warning staged rows", async () => {
		const handler = approvalEffectHandlers.find(
			(h) => h.action === "IMPORT_CONFIRM",
		);
		expect(handler).toBeDefined();

		await handler?.apply({
			tx: makeTx() as never,
			request: makeRequest({
				effectAction: "IMPORT_CONFIRM",
				resourceType: "IMPORT_BATCH",
				resourceId: "batch-1",
				payloadJson: {
					actorId: "user-1",
					workId: "work-1",
					batchId: "batch-1",
					selectedRowIds: ["row-1"],
					expectedBatchVersion: 1,
					model: "obra-completa",
					idempotencyKey: "key-1",
				},
			}) as never,
			decision,
		});

		expect(applyStagedWorkbook).toHaveBeenCalledWith(
			"user-1",
			"work-1",
			expect.objectContaining({
				budgetRows: [{ rowNumber: 2, index: "1" }],
			}),
			expect.objectContaining({
				kind: "obra-completa",
				db: expect.anything(),
			}),
		);
	});

	it("rejects a stale batch before applying its staged workbook", async () => {
		const handler = approvalEffectHandlers.find(
			(h) => h.action === "IMPORT_CONFIRM",
		);
		applyStagedWorkbook.mockClear();
		importBatchFindUnique.mockResolvedValueOnce({
			...(await importBatchFindUnique()),
			status: "CONFIRMED",
		} as never);

		await expect(
			handler?.apply({
				tx: makeTx() as never,
				request: makeRequest({
					effectAction: "IMPORT_CONFIRM",
					resourceType: "IMPORT_BATCH",
					resourceId: "batch-1",
					payloadJson: {
						actorId: "user-1",
						workId: "work-1",
						batchId: "batch-1",
						selectedRowIds: ["row-1"],
						expectedBatchVersion: 1,
						model: "obra-completa",
						idempotencyKey: "key-1",
					},
				}) as never,
				decision,
			}),
		).rejects.toMatchObject({ code: "IMPORT_BATCH_NOT_READY", status: 422 });
		expect(applyStagedWorkbook).not.toHaveBeenCalled();
	});

	it("registra os handlers do dominio", () => {
		const actions = approvalEffectHandlers.map((h) => h.action).sort();
		expect(actions).toEqual([
			"BUDGET_IMPACT_APPROVE",
			"BUDGET_VERSION_ACTIVATE",
			"CONTRACT_CREATE",
			"CONTRACT_DELETE",
			"CONTRACT_MEASUREMENT_APPROVE",
			"CONTRACT_REQUEST_FINALIZE",
			"CONTRACT_SUPPLIER_LINK",
			"CONTRACT_UPDATE",
			"COST_APPROVE",
			"IMPORT_CONFIRM",
			"PAYMENT_CONFIRM",
			"SCHEDULE_VERSION_ACTIVATE",
			"WORK_DELETE",
			"WORK_MEASUREMENT_APPROVE",
		]);
	});

	it("BUDGET_IMPACT_APPROVE aprova os impactos pendentes via controle", async () => {
		const handler = approvalEffectHandlers.find(
			(h) => h.action === "BUDGET_IMPACT_APPROVE",
		);
		expect(handler).toBeDefined();

		await handler?.apply({
			tx: makeTx() as never,
			request: makeRequest({
				effectAction: "BUDGET_IMPACT_APPROVE",
				resourceType: "WORK",
				resourceId: "work-1",
				payloadJson: { workId: "work-1", impactIds: ["impact-1", "impact-2"] },
			}) as never,
			decision,
		});

		expect(approveBudgetImpact).toHaveBeenCalledTimes(2);
		expect(approveBudgetImpact).toHaveBeenCalledWith(
			"owner-1",
			"impact-1",
			{ userId: "user-1" },
			expect.anything(),
		);
	});

	it("BUDGET_IMPACT_APPROVE.reject rejeita os impactos pendentes via controle", async () => {
		const handler = approvalEffectHandlers.find(
			(h) => h.action === "BUDGET_IMPACT_APPROVE",
		);
		expect(handler?.reject).toBeDefined();

		await handler?.reject?.({
			tx: makeTx() as never,
			request: makeRequest({
				effectAction: "BUDGET_IMPACT_APPROVE",
				resourceType: "WORK",
				resourceId: "work-1",
				payloadJson: { workId: "work-1", impactIds: ["impact-1"] },
			}) as never,
			decision,
		});

		expect(rejectBudgetImpact).toHaveBeenCalledWith(
			"owner-1",
			"impact-1",
			{ userId: "user-1" },
			expect.anything(),
		);
	});

	it("CONTRACT_CREATE delega ao gateway unico na execucao do efeito", async () => {
		const tx = makeTx();
		const handler = approvalEffectHandlers.find(
			(h) => h.action === "CONTRACT_CREATE",
		);
		expect(handler).toBeDefined();

		const result = await handler?.apply({
			tx: tx as never,
			request: makeRequest({
				effectAction: "CONTRACT_CREATE",
				resourceType: "CONTRACT",
				resourceId: null,
				commandId: "contract-create-x",
				payloadJson: {
					workId: "work-1",
					contract: {
						code: "CT-001",
						supplierName: "Fornecedor",
						contractValue: 1000,
					},
					services: [
						{
							budgetItemId: "item-1",
							quantity: 10,
							unitCost: 100,
						},
					],
					createdBy: "user-1",
				},
			}) as never,
			decision,
		});

		expect(result).toMatchObject({
			id: "contract-1",
			code: "CT-001",
			contractValue: 1000,
		});
		expect(createContractWithEffectsInTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				resourceOwnerId: "owner-1",
				workId: "work-1",
				origin: { type: "MANUAL" },
				supplier: { name: "Fornecedor", supplierId: null },
				contract: expect.objectContaining({
					code: "CT-001",
					contractValue: 1000,
				}),
				services: [{ budgetItemId: "item-1", quantity: 10, unitCost: 100 }],
			}),
		);
	});

	it("CONTRACT_UPDATE altera o status e registra a transicao na auditoria", async () => {
		const contract = {
			id: "contract-1",
			ownerId: "owner-1",
			workId: "work-1",
			code: "CT-001",
			status: "RASCUNHO",
			title: "Contrato de fundacao",
			serviceType: null,
			objectDescription: "Fundacao",
			startDate: null,
			endDate: null,
		};
		const contractFindFirst = mock(async () => contract);
		const contractUpdate = mock(
			async (args: { data: Record<string, unknown> }) => ({
				...contract,
				...args.data,
			}),
		);
		const handler = approvalEffectHandlers.find(
			(h) => h.action === "CONTRACT_UPDATE",
		);
		expect(handler).toBeDefined();
		writeAudit.mockClear();

		await handler?.apply({
			tx: {
				...makeTx(),
				contract: { findFirst: contractFindFirst, update: contractUpdate },
			} as never,
			request: makeRequest({
				effectAction: "CONTRACT_UPDATE",
				resourceType: "CONTRACT",
				resourceId: "contract-1",
				payloadJson: {
					workId: "work-1",
					contractId: "contract-1",
					input: { status: "A_INICIAR" },
				},
			}) as never,
			decision,
		});

		expect(contractUpdate).toHaveBeenCalledWith({
			where: { id: "contract-1" },
			data: { status: "A_INICIAR" },
		});
		expect(writeAudit).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				previousState: expect.objectContaining({ status: "RASCUNHO" }),
				newState: expect.objectContaining({ status: "A_INICIAR" }),
			}),
		);
	});

	it("WORK_DELETE exclui a obra apenas na execucao do efeito", async () => {
		const workFindFirst = mock(async () => ({
			id: "work-1",
			ownerId: "owner-1",
			code: "OBRA-1",
		}));
		const workDelete = mock(async () => ({ id: "work-1" }));
		const tx = {
			...makeTx(),
			constructionWork: {
				findFirst: workFindFirst,
				delete: workDelete,
			},
		};
		const handler = approvalEffectHandlers.find(
			(h) => h.action === "WORK_DELETE",
		);
		expect(handler).toBeDefined();

		const result = await handler?.apply({
			tx: tx as never,
			request: makeRequest({
				effectAction: "WORK_DELETE",
				resourceType: "WORK",
				resourceId: "work-1",
				commandId: "work-delete-1",
				payloadJson: { workId: "work-1" },
			}) as never,
			decision,
		});

		expect(result).toMatchObject({ id: "work-1", deleted: true });
		expect(workFindFirst).toHaveBeenCalledWith({
			where: { id: "work-1", ownerId: "owner-1" },
		});
		expect(workDelete).toHaveBeenCalledWith({
			where: { id: "work-1", ownerId: "owner-1" },
		});
	});
});
