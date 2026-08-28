import { beforeEach, describe, expect, it, mock } from "bun:test";
import Decimal from "decimal.js";

const resolveScopeMock = mock(
	async (): Promise<Record<string, unknown>> => ({ canWrite: true }),
);
const contractRequestCreate = mock(
	async (args: {
		data: Record<string, unknown>;
	}): Promise<Record<string, unknown>> => ({ id: "request-1", ...args.data }),
);
const contractRequestBudgetItemCreate = mock(
	async (): Promise<Record<string, unknown>> => ({}),
);
const contractRequestFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const proposalFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const proposalFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const proposalCreate = mock(
	async (args: { data: Record<string, unknown> }) => ({
		id: "proposal-manual-1",
		...args.data,
	}),
);
const importRowFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const supplierFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const supplierFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const workSupplierFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const contractCreate = mock(async (): Promise<Record<string, unknown>> => ({}));
const contractCount = mock(async () => 0);
const contractFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const contractDelete = mock(async () => ({}));
const contractServiceCreate = mock(
	async (): Promise<Record<string, unknown>> => ({}),
);
const budgetVersionItemFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const requestUpdate = mock(async () => ({}));
const requestUpdateMany = mock(async () => ({ count: 1 }));
const approvalRequestFindMany = mock(
	async (): Promise<Array<{ id: string; idempotencyKey?: string }>> => [],
);
const approvalRequestUpdateMany = mock(async () => ({ count: 0 }));
const notificationUpdateMany = mock(async () => ({ count: 0 }));
const submitApprovalMock = mock(async () => ({
	status: "PENDING" as const,
	approvalRequestId: "approval-1",
	data: undefined,
}));
const transactionMock = mock(
	async (callback: (tx: Record<string, unknown>) => Promise<unknown>) =>
		callback({
			contractRequest: {
				create: contractRequestCreate,
				findFirst: contractRequestFindFirst,
				update: requestUpdate,
				updateMany: requestUpdateMany,
			},
			contractRequestBudgetItem: { create: contractRequestBudgetItemCreate },
			contractRequestProposal: {
				findFirst: proposalFindFirst,
				findMany: proposalFindMany,
			},
			constructionSupplier: { findFirst: supplierFindFirst },
			approvalRequest: {
				findMany: approvalRequestFindMany,
				updateMany: approvalRequestUpdateMany,
			},
			notification: { updateMany: notificationUpdateMany },
			constructionWorkSupplier: { findFirst: workSupplierFindFirst },
			contract: {
				create: contractCreate,
				count: contractCount,
				findFirst: contractFindFirst,
				delete: contractDelete,
			},
			contractService: { create: contractServiceCreate },
			budgetVersionItem: { findMany: budgetVersionItemFindMany },
		}),
);
const getBudgetItemReferencesMock = mock(
	async (): Promise<{
		found: Array<Record<string, unknown>>;
		missing: string[];
	}> => ({
		found: [],
		missing: [],
	}),
);

mock.module("../../../../src/lib/resource-scope", () => ({
	resolveResourceScope: resolveScopeMock,
}));

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		contractRequest: {
			findFirst: contractRequestFindFirst,
			updateMany: requestUpdateMany,
		},
		contractRequestProposal: {
			findFirst: proposalFindFirst,
			findMany: proposalFindMany,
			create: proposalCreate,
		},
		importRow: { findMany: importRowFindMany },
		constructionSupplier: {
			findFirst: supplierFindFirst,
			findMany: supplierFindMany,
		},
		constructionWorkSupplier: { findFirst: workSupplierFindFirst },
		approvalRequest: {
			findMany: approvalRequestFindMany,
			updateMany: approvalRequestUpdateMany,
		},
		notification: { updateMany: notificationUpdateMany },
		budgetVersionItem: { findMany: budgetVersionItemFindMany },
		$transaction: transactionMock,
	},
}));

mock.module(
	"../../../../src/modules/construction-planning/budget-control/budget-control.repository",
	() => ({
		getBudgetItemReferences: getBudgetItemReferencesMock,
	}),
);
mock.module("../../../../src/modules/governance/approval.service", () => ({
	submitApproval: submitApprovalMock,
}));

const coveredReferences = [
	{
		budgetItemId: "budget-1",
		operationalBudgetItemId: "budget-1",
		index: "1.1",
		identityId: "identity-1",
		versionItemId: "vitem-1",
		quantity: new Decimal(10),
		unitCost: new Decimal(100),
	},
];

const validInput = {
	title: "Fundacao",
	serviceType: "Execucao",
	description: "Execucao da fundacao da torre A",
	startDate: "2026-09-01",
	endDate: "2026-10-15",
	items: [{ budgetItemId: "budget-1", quantity: 10 }],
};

describe("contract request service", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		resolveScopeMock.mockResolvedValue({
			canRead: true,
			canWrite: true,
			role: "GERENTE",
		});
		submitApprovalMock.mockClear();
		requestUpdateMany.mockResolvedValue({ count: 1 });
		getBudgetItemReferencesMock.mockResolvedValue({
			found: coveredReferences,
			missing: [],
		});
		contractRequestCreate.mockImplementation(
			async (args: {
				data: {
					items?: { create: Array<Record<string, unknown>> };
				};
			}): Promise<Record<string, unknown>> => ({
				id: "request-1",
				status: "EM_ESPERA",
				...args.data,
				items: args.data.items?.create ?? [],
			}),
		);
		contractRequestFindFirst.mockResolvedValue(null);
		proposalFindFirst.mockResolvedValue(null);
		proposalFindMany.mockResolvedValue([]);
		proposalCreate.mockResolvedValue({ id: "proposal-manual-1" });
		importRowFindMany.mockResolvedValue([]);
		supplierFindFirst.mockResolvedValue(null);
		supplierFindMany.mockResolvedValue([]);
		approvalRequestFindMany.mockResolvedValue([]);
		approvalRequestUpdateMany.mockResolvedValue({ count: 0 });
		notificationUpdateMany.mockResolvedValue({ count: 0 });
		workSupplierFindFirst.mockResolvedValue(null);
		contractCreate.mockResolvedValue({ id: "contract-1", code: "CT-001" });
		contractCount.mockResolvedValue(0);
		contractFindFirst.mockResolvedValue(null);
		contractDelete.mockResolvedValue({});
		budgetVersionItemFindMany.mockResolvedValue([
			{
				id: "vitem-1",
				totalCost: new Decimal(1000),
				description: "Servico",
				unit: "m2",
			},
		]);
		requestUpdate.mockResolvedValue({});
	});

	it("creates a request with items covered by the active budget version", async () => {
		const { createContractRequest } = await import(
			"../../../../src/modules/construction-planning/contract-request.service"
		);
		const result = await createContractRequest("user-1", "work-1", validInput);

		expect(result.id).toBe("request-1");
		expect(result.status).toBe("EM_ESPERA");
		expect(getBudgetItemReferencesMock).toHaveBeenCalledWith(
			"user-1",
			"work-1",
			["budget-1"],
		);
		const createCall = (contractRequestCreate as ReturnType<typeof mock>).mock
			.calls[0]?.[0] as { data: Record<string, unknown> };
		expect(createCall?.data).toMatchObject({
			ownerId: "user-1",
			workId: "work-1",
			title: "Fundacao",
			serviceType: "Execucao",
			description: "Execucao da fundacao da torre A",
		});
	});

	it("adds a manual participant to the confirmed quotation map", async () => {
		const { addManualContractRequestProposal } = await import(
			"../../../../src/modules/construction-planning/contract-request.service"
		);
		resolveScopeMock.mockResolvedValue({
			canRead: true,
			canWrite: true,
			resourceOwnerId: "owner-1",
		});
		contractRequestFindFirst.mockResolvedValue({
			id: "request-1",
			status: "EM_ESPERA",
			confirmedBatchId: "batch-1",
		});
		proposalFindMany.mockResolvedValue([{ rowNumber: 4 }]);

		await addManualContractRequestProposal("user-1", "work-1", "request-1", {
			supplierName: "Construtora Nova Ltda.",
			cnpj: "11222333000181",
			proposalValue: 42_500,
			notes: "Proposta recebida após a cotação inicial",
		});

		expect(proposalCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({
				ownerId: "owner-1",
				workId: "work-1",
				batchId: "batch-1",
				normalizedCnpj: "11222333000181",
				supplierName: "Construtora Nova Ltda.",
				rowNumber: 5,
			}),
			select: expect.any(Object),
		});
	});

	it("does not add a duplicated CNPJ to the comparison", async () => {
		const { addManualContractRequestProposal } = await import(
			"../../../../src/modules/construction-planning/contract-request.service"
		);
		resolveScopeMock.mockResolvedValue({
			canRead: true,
			canWrite: true,
			resourceOwnerId: "owner-1",
		});
		contractRequestFindFirst.mockResolvedValue({
			id: "request-1",
			status: "EM_ESPERA",
			confirmedBatchId: "batch-1",
		});
		proposalFindMany.mockResolvedValue([
			{ normalizedCnpj: "11222333000181", rowNumber: 2 },
		]);

		await expect(
			addManualContractRequestProposal("user-1", "work-1", "request-1", {
				supplierName: "Construtora Repetida Ltda.",
				cnpj: "11222333000181",
				proposalValue: 42_500,
			}),
		).rejects.toMatchObject({ code: "DUPLICATE_PROPOSAL" });
		expect(proposalCreate).not.toHaveBeenCalled();
	});

	it("rejects an item outside the active budget version", async () => {
		getBudgetItemReferencesMock.mockResolvedValue({
			found: [],
			missing: ["budget-9"],
		});

		const { createContractRequest } = await import(
			"../../../../src/modules/construction-planning/contract-request.service"
		);
		await expect(
			createContractRequest("user-1", "work-1", {
				...validInput,
				items: [{ budgetItemId: "budget-9", quantity: 1 }],
			}),
		).rejects.toMatchObject({ code: "BUDGET_VERSION_ITEM_INELIGIBLE" });
		expect(contractRequestCreate).not.toHaveBeenCalled();
	});

	it("rejects duplicate items and non-positive quantities", async () => {
		const { createContractRequest } = await import(
			"../../../../src/modules/construction-planning/contract-request.service"
		);
		await expect(
			createContractRequest("user-1", "work-1", {
				...validInput,
				items: [
					{ budgetItemId: "budget-1", quantity: 1 },
					{ budgetItemId: "budget-1", quantity: 2 },
				],
			}),
		).rejects.toMatchObject({ code: "DUPLICATE_BUDGET_ITEM" });
		await expect(
			createContractRequest("user-1", "work-1", {
				...validInput,
				items: [{ budgetItemId: "budget-1", quantity: 0 }],
			}),
		).rejects.toMatchObject({ code: "INVALID_QUANTITY" });
	});

	it("rejects a period whose end date precedes the start date", async () => {
		const { createContractRequest } = await import(
			"../../../../src/modules/construction-planning/contract-request.service"
		);
		await expect(
			createContractRequest("user-1", "work-1", {
				...validInput,
				startDate: "2026-09-01",
				endDate: "2026-08-01",
			}),
		).rejects.toMatchObject({ code: "INVALID_PERIOD" });
	});

	it("denies creation without write scope", async () => {
		resolveScopeMock.mockResolvedValue({ canWrite: false });

		const { createContractRequest } = await import(
			"../../../../src/modules/construction-planning/contract-request.service"
		);
		await expect(
			createContractRequest("user-1", "work-1", validInput),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	const pendingRequest = {
		id: "request-1",
		ownerId: "user-1",
		workId: "work-1",
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
		createdBy: "user-1",
		items: [
			{
				id: "ri-1",
				requestId: "request-1",
				ownerId: "user-1",
				workId: "work-1",
				budgetItemId: "budget-1",
				quantity: new Decimal(10),
				sortOrder: 0,
			},
		],
	};

	const eligibleProposal = {
		id: "proposal-1",
		ownerId: "user-1",
		workId: "work-1",
		batchId: "batch-1",
		normalizedCnpj: "11222333000181",
		supplierName: "Construtora Modelo",
		originalProposalValue: new Decimal(60_000),
		proposalValue: new Decimal(50_000),
		notes: null,
		suggestedWinner: false,
		rowNumber: 2,
	};

	it("accepts a proposal creating one draft contract with the selected services", async () => {
		contractRequestFindFirst.mockResolvedValue(pendingRequest);
		proposalFindFirst.mockResolvedValue(eligibleProposal);
		supplierFindFirst.mockResolvedValue({
			id: "supplier-1",
			status: "APPROVED",
		});
		workSupplierFindFirst.mockResolvedValue({ id: "ws-1" });
		getBudgetItemReferencesMock.mockResolvedValue({
			found: [
				{
					budgetItemId: "budget-1",
					operationalBudgetItemId: "budget-1",
					index: "1.1",
					identityId: "identity-1",
					versionItemId: "vitem-1",
					quantity: new Decimal(10),
					unitCost: new Decimal(100),
				},
			],
			missing: [],
		});

		const { acceptContractRequest } = await import(
			"../../../../src/modules/construction-planning/contract-request.service"
		);
		const result = await acceptContractRequest(
			"user-1",
			"work-1",
			"request-1",
			"proposal-1",
			"accept-1",
			"GERENTE",
		);

		expect(result).toMatchObject({
			requestId: "request-1",
			status: "ACEITA",
			acceptedProposalId: "proposal-1",
		});
		expect(contractCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					supplierId: "supplier-1",
					supplierName: "Construtora Modelo",
					contractValue: new Decimal(50_000),
					serviceType: "Execucao",
					title: "Fundacao",
					startDate: new Date("2026-09-01"),
					endDate: new Date("2026-10-15"),
					notes: "Execucao da fundacao da torre A",
					status: "RASCUNHO",
					contractRequestId: "request-1",
				}),
			}),
		);
		expect(contractServiceCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					contractId: "contract-1",
					budgetItemId: "budget-1",
					quantity: new Decimal(10),
				}),
			}),
		);
		expect(requestUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: "request-1" },
				data: expect.objectContaining({
					status: "ACEITA",
					acceptedProposalId: "proposal-1",
					contractId: "contract-1",
				}),
			}),
		);
	});

	it("accepts an unregistered supplier with a warning-only workflow", async () => {
		contractRequestFindFirst.mockResolvedValue(pendingRequest);
		proposalFindFirst.mockResolvedValue(eligibleProposal);
		supplierFindFirst.mockResolvedValue(null);

		const { acceptContractRequest } = await import(
			"../../../../src/modules/construction-planning/contract-request.service"
		);
		const result = await acceptContractRequest(
			"user-1",
			"work-1",
			"request-1",
			"proposal-1",
			"accept-1",
			"GERENTE",
		);
		expect(result.contract.supplierId).toBeNull();
		expect(contractCreate).toHaveBeenCalled();
	});

	it("accepts a supplier that is not linked to the work", async () => {
		contractRequestFindFirst.mockResolvedValue(pendingRequest);
		proposalFindFirst.mockResolvedValue(eligibleProposal);
		supplierFindFirst.mockResolvedValue({ id: "supplier-1" });
		workSupplierFindFirst.mockResolvedValue(null);

		const { acceptContractRequest } = await import(
			"../../../../src/modules/construction-planning/contract-request.service"
		);
		const result = await acceptContractRequest(
			"user-1",
			"work-1",
			"request-1",
			"proposal-1",
			"accept-1",
			"GERENTE",
		);
		expect(result.contract.supplierId).toBe("supplier-1");
		expect(contractCreate).toHaveBeenCalled();
	});

	it("denies acceptance to non-approvers", async () => {
		resolveScopeMock.mockResolvedValue({
			canRead: true,
			canWrite: true,
			role: "SUPERVISOR",
		});
		contractRequestFindFirst.mockResolvedValue(pendingRequest);
		proposalFindFirst.mockResolvedValue(eligibleProposal);
		supplierFindFirst.mockResolvedValue({ id: "supplier-1" });
		workSupplierFindFirst.mockResolvedValue({ id: "ws-1" });

		const { acceptContractRequest } = await import(
			"../../../../src/modules/construction-planning/contract-request.service"
		);
		await expect(
			acceptContractRequest(
				"user-1",
				"work-1",
				"request-1",
				"proposal-1",
				"accept-1",
				"SUPERVISOR",
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(contractCreate).not.toHaveBeenCalled();
	});

	it("replays an already accepted request without creating a second contract", async () => {
		contractRequestFindFirst.mockResolvedValue({
			...pendingRequest,
			status: "ACEITA",
			acceptedProposalId: "proposal-1",
			acceptedAt: new Date(),
			acceptedBy: "user-1",
			contractId: "contract-1",
		});
		contractFindFirst.mockResolvedValue({
			id: "contract-1",
			code: "CT-001",
			status: "RASCUNHO",
			supplierId: "supplier-1",
			supplierName: "Construtora Modelo",
			contractValue: new Decimal(50_000),
		});

		const { acceptContractRequest } = await import(
			"../../../../src/modules/construction-planning/contract-request.service"
		);
		const result = await acceptContractRequest(
			"user-1",
			"work-1",
			"request-1",
			"proposal-1",
			"accept-1",
			"GERENTE",
		);

		expect(result.contract.id).toBe("contract-1");
		expect(contractCreate).not.toHaveBeenCalled();
	});

	it("reverts a contracted request while the generated contract is still a draft", async () => {
		contractRequestFindFirst.mockResolvedValue({
			...pendingRequest,
			status: "CONTRATADA",
			acceptedProposalId: "proposal-1",
			acceptedAt: new Date(),
			acceptedBy: "user-1",
			contractId: "contract-1",
		});
		contractFindFirst.mockResolvedValue({
			id: "contract-1",
			status: "RASCUNHO",
			instrumentGeneratedAt: null,
			_count: { measurements: 0, payments: 0, folders: 0, amendments: 0 },
		});

		const { revertContractRequestAcceptance } = await import(
			"../../../../src/modules/construction-planning/contract-request.service"
		);
		const result = await revertContractRequestAcceptance(
			"user-1",
			"work-1",
			"request-1",
			"GERENTE",
		);

		expect(result).toEqual({
			requestId: "request-1",
			reverted: true,
			status: "EM_ESPERA",
		});
		expect(contractDelete).toHaveBeenCalledWith({
			where: { id: "contract-1" },
		});
		expect(requestUpdate).toHaveBeenCalledWith({
			where: { id: "request-1" },
			data: expect.objectContaining({
				status: "EM_ESPERA",
				contractId: null,
				acceptedProposalId: null,
			}),
		});
	});

	it("blocks reverting after contract data has been registered", async () => {
		contractRequestFindFirst.mockResolvedValue({
			...pendingRequest,
			status: "ACEITA",
			acceptedProposalId: "proposal-1",
			contractId: "contract-1",
		});
		contractFindFirst.mockResolvedValue({
			id: "contract-1",
			status: "RASCUNHO",
			instrumentGeneratedAt: null,
			_count: { measurements: 1, payments: 0, folders: 0, amendments: 0 },
		});

		const { revertContractRequestAcceptance } = await import(
			"../../../../src/modules/construction-planning/contract-request.service"
		);
		await expect(
			revertContractRequestAcceptance(
				"user-1",
				"work-1",
				"request-1",
				"GERENTE",
			),
		).rejects.toMatchObject({ code: "CONTRACT_REQUEST_REVERT_BLOCKED" });
		expect(contractDelete).not.toHaveBeenCalled();
	});

	it("builds the comparison with budget total, differences and canAccept", async () => {
		contractRequestFindFirst.mockResolvedValue({
			...pendingRequest,
			confirmedBatchId: "batch-1",
		});
		proposalFindMany.mockResolvedValue([
			eligibleProposal,
			{
				...eligibleProposal,
				id: "proposal-2",
				normalizedCnpj: "52998224725",
				supplierName: "Outra Construtora",
				proposalValue: new Decimal(55_000),
				rowNumber: 3,
			},
		]);
		importRowFindMany.mockResolvedValue([
			{
				values: {
					supplierDocument: "11.222.333/0001-81",
					supplierAddress: "Rua das Flores, 123",
					supplierPhone: "(11) 99999-9999",
					supplierEmail: "contato@modelo.com",
					supplierResponsible: "Maria Silva",
				},
			},
		]);
		supplierFindFirst.mockResolvedValue({
			id: "supplier-1",
			status: "APPROVED",
		});
		workSupplierFindFirst.mockResolvedValue({ id: "ws-1" });
		getBudgetItemReferencesMock.mockResolvedValue({
			found: [
				{
					budgetItemId: "budget-1",
					index: "1.1",
					identityId: "identity-1",
					versionItemId: "vitem-1",
					quantity: new Decimal(10),
					unitCost: new Decimal(100),
				},
			],
			missing: [],
		});

		const { getContractRequestComparison } = await import(
			"../../../../src/modules/construction-planning/contract-request.service"
		);
		const comparison = await getContractRequestComparison(
			"user-1",
			"work-1",
			"request-1",
			"GERENTE",
		);

		expect(comparison.budget.total).toBe(1000);
		expect(comparison.selectedItems).toHaveLength(1);
		expect(comparison.selectedItems[0]).toMatchObject({
			budgetItemId: "budget-1",
			index: "1.1",
			quantity: 10,
		});
		expect(comparison.proposals).toHaveLength(2);
		expect(comparison.proposals[0]).toMatchObject({
			supplier: {
				cnpj: "11222333000181",
				registered: true,
				address: "Rua das Flores, 123",
				phone: "(11) 99999-9999",
				email: "contato@modelo.com",
				responsibleName: "Maria Silva",
			},
			proposalValue: 50_000,
			costRatioPercent: 5000,
			costAlert: "RED",
			costStatus: "EXPENSE",
			costDifferenceAmount: -49_000,
			originalProposalValue: 60_000,
			negotiationReductionAmount: 10_000,
			negotiationReductionPercent: (10_000 / 60_000) * 100,
			profitMarginAmount: -49_000,
			profitMarginPercent: -4900,
			difference: { amount: 49_000, percent: 4900 },
		});
		expect(comparison.statistics).toMatchObject({
			budgetTotal: 1000,
			supplierCount: 2,
			supplierLowest: 50_000,
			supplierHighest: 55_000,
			supplierAverage: 52_500,
			lowestRatioPercent: 5000,
			averageRatioPercent: 5250,
			classification: {
				profit: { count: 0, amount: 0 },
				neutral: { count: 0, amount: 0 },
				expense: { count: 1, amount: 54_000 },
			},
			negotiatedReductionTotal: 10_000,
			originalProposalTotal: 60_000,
			negotiatedReductionPercent: (10_000 / 60_000) * 100,
		});
		expect(comparison.permissions).toEqual({ canAccept: true });
	});

	it("classifies each financial card from one relevant proposal", async () => {
		contractRequestFindFirst.mockResolvedValue({
			...pendingRequest,
			confirmedBatchId: "batch-1",
		});
		proposalFindMany.mockResolvedValue([
			{
				...eligibleProposal,
				proposalValue: new Decimal(800),
				originalProposalValue: new Decimal(900),
			},
			{
				...eligibleProposal,
				id: "proposal-2",
				normalizedCnpj: "52998224725",
				supplierName: "Fornecedor neutro",
				proposalValue: new Decimal(950),
				originalProposalValue: new Decimal(1_000),
			},
			{
				...eligibleProposal,
				id: "proposal-3",
				normalizedCnpj: "39000000000190",
				supplierName: "Fornecedor acima do orçamento",
				proposalValue: new Decimal(1_200),
				originalProposalValue: new Decimal(1_300),
			},
		]);
		supplierFindFirst.mockResolvedValue({ id: "supplier-1" });
		workSupplierFindFirst.mockResolvedValue({ id: "ws-1" });
		getBudgetItemReferencesMock.mockResolvedValue({
			found: [
				{
					budgetItemId: "budget-1",
					index: "1.1",
					identityId: "identity-1",
					versionItemId: "vitem-1",
					quantity: new Decimal(10),
					unitCost: new Decimal(100),
				},
			],
			missing: [],
		});

		const { getContractRequestComparison } = await import(
			"../../../../src/modules/construction-planning/contract-request.service"
		);
		const comparison = await getContractRequestComparison(
			"user-1",
			"work-1",
			"request-1",
			"GERENTE",
		);

		expect(comparison.statistics.classification).toEqual({
			profit: {
				count: 1,
				amount: 200,
				supplier: {
					name: "Construtora Modelo",
					proposalValue: 800,
					costRatioPercent: 80,
				},
			},
			neutral: {
				count: 1,
				amount: 50,
				supplier: {
					name: "Fornecedor neutro",
					proposalValue: 950,
					costRatioPercent: 95,
				},
			},
			expense: {
				count: 1,
				amount: 200,
				supplier: {
					name: "Fornecedor acima do orçamento",
					proposalValue: 1_200,
					costRatioPercent: 120,
				},
			},
		});
		expect(comparison.statistics.bestSupplier).toEqual({
			name: "Construtora Modelo",
			proposalValue: 800,
			costRatioPercent: 80,
		});
		expect(comparison.statistics.worstSupplier).toEqual({
			name: "Fornecedor acima do orçamento",
			proposalValue: 1_200,
			costRatioPercent: 120,
		});
		expect(comparison.statistics.negotiatedReductionTotal).toBe(100);
		expect(comparison.statistics.originalProposalTotal).toBe(900);
		expect(comparison.proposals.map((proposal) => proposal.costStatus)).toEqual(
			["PROFIT", "NEUTRAL", "EXPENSE"],
		);
	});

	it("selects a proposal without creating a contract and opens final approval", async () => {
		const { selectContractRequestWinner } = await import(
			"../../../../src/modules/construction-planning/contract-request.service"
		);
		resolveScopeMock.mockResolvedValue({
			canRead: true,
			canWrite: true,
			resourceOwnerId: "owner-1",
		});
		contractRequestFindFirst.mockResolvedValue({
			id: "request-1",
			status: "EM_ESPERA",
			confirmedBatchId: "batch-1",
		});
		proposalFindFirst.mockResolvedValue({
			id: "proposal-1",
			normalizedCnpj: "11222333000181",
		});
		supplierFindFirst.mockResolvedValue({ id: "supplier-1" });

		const result = await selectContractRequestWinner(
			"actor-1",
			"work-1",
			"request-1",
			"proposal-1",
			"idempotency-1",
			"GERENTE",
		);

		expect(result).toMatchObject({
			status: "PENDING",
			approvalRequestId: "approval-1",
		});
		expect(requestUpdateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					status: "AGUARDANDO_APROVACAO_FINAL",
					acceptedProposalId: "proposal-1",
				}),
			}),
		);
		expect(submitApprovalMock).toHaveBeenCalledWith(
			expect.objectContaining({
				effectAction: "CONTRACT_REQUEST_FINALIZE",
				resourceId: "request-1",
			}),
		);
		expect(contractCreate).not.toHaveBeenCalled();
	});

	it("allows selecting an unregistered supplier and opens final approval", async () => {
		const { selectContractRequestWinner } = await import(
			"../../../../src/modules/construction-planning/contract-request.service"
		);
		resolveScopeMock.mockResolvedValue({
			canRead: true,
			canWrite: true,
			resourceOwnerId: "owner-1",
		});
		contractRequestFindFirst.mockResolvedValue({
			id: "request-1",
			status: "EM_ESPERA",
			confirmedBatchId: "batch-1",
		});
		proposalFindFirst.mockResolvedValue({
			id: "proposal-1",
			normalizedCnpj: "11222333000181",
		});
		supplierFindFirst.mockResolvedValue(null);

		const result = await selectContractRequestWinner(
			"user-1",
			"work-1",
			"request-1",
			"proposal-1",
			"key-1",
			"ADMIN",
		);

		expect(result).toMatchObject({
			requestId: "request-1",
			status: "PENDING",
			approvalRequestId: "approval-1",
		});
		expect(requestUpdateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					status: "AGUARDANDO_APROVACAO_FINAL",
					acceptedProposalId: "proposal-1",
				}),
			}),
		);
		expect(submitApprovalMock).toHaveBeenCalledWith(
			expect.objectContaining({
				effectAction: "CONTRACT_REQUEST_FINALIZE",
				resourceId: "request-1",
			}),
		);
	});

	it("restarts selection with a new idempotency key after a stale approval", async () => {
		const { selectContractRequestWinner } = await import(
			"../../../../src/modules/construction-planning/contract-request.service"
		);
		resolveScopeMock.mockResolvedValue({
			canRead: true,
			canWrite: true,
			resourceOwnerId: "owner-1",
		});
		contractRequestFindFirst.mockResolvedValue({
			id: "request-1",
			status: "EM_ESPERA",
			confirmedBatchId: "batch-1",
		});
		proposalFindFirst.mockResolvedValue({
			id: "proposal-1",
			normalizedCnpj: "11222333000181",
		});
		approvalRequestFindMany.mockResolvedValue([
			{ id: "stale-approval", idempotencyKey: "selection-key" },
		]);

		await selectContractRequestWinner(
			"actor-1",
			"work-1",
			"request-1",
			"proposal-1",
			"selection-key",
			"GERENTE",
		);

		expect(submitApprovalMock).toHaveBeenCalledWith(
			expect.objectContaining({
				idempotencyKey: expect.stringMatching(/^selection-key:retry:/),
			}),
		);
	});
});
