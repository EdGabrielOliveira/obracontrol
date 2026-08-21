import { beforeEach, describe, expect, it, mock } from "bun:test";

const getWorkOrThrow = mock(async () => ({ id: "work-1" }));
const assertWritable = mock(async () => undefined);
const createContractService = mock(async () => ({
	id: "service-1",
	budgetItemId: "item-1",
	totalCost: 300,
}));
const createContractServices = mock(async () => [
	{ id: "service-1", budgetItemId: "item-1", totalCost: 100 },
	{ id: "service-2", budgetItemId: "item-2", totalCost: 200 },
]);
const getContractServiceBudgetItem = mock(
	async (): Promise<{
		id: string;
		description: string;
		index: string;
	} | null> => ({
		id: "item-1",
		description: "Fundacao",
		index: "1.1",
	}),
);
const withOverflowApproval = mock(
	async ({ commit }: { commit: (tx: never) => Promise<unknown> }) =>
		((await commit({} as never)) as { value: unknown }).value,
);
const resolveLedgerItemRef = mock(
	async (): Promise<{
		identityId: string;
		versionItemId: string;
		budgetItemId: string;
	} | null> => ({
		identityId: "identity-1",
		versionItemId: "version-item-1",
		budgetItemId: "item-1",
	}),
);
const applyBudgetImpact = mock(async () => ({
	status: "APPROVED" as const,
	requiresApproval: false,
	availableBalance: 1000,
	projectedBalance: 900,
	allocations: [],
}));
const previewBudget = mock(async () => ({
	items: [
		{
			budgetItemId: "item-1",
			limit: 1000,
			approvedCommitted: 0,
			approvedConsumed: 0,
			pendingImpact: 0,
			availableBalance: 1000,
			projectedBalance: 700,
		},
	],
	totalImpact: 300,
	requiresApproval: false,
}));

mock.module("../../../../src/modules/construction-planning/repository", () => ({
	getWorkOrThrow,
}));
mock.module(
	"../../../../src/modules/construction-planning/contract.repository",
	() => ({
		createContractService,
		createContractServices,
		getContractServiceBudgetItem,
		deriveServiceTotalCost: (input: {
			quantity?: number | null;
			unitCost?: number | null;
		}) => {
			const quantity = Number(input.quantity ?? 0);
			const unitCost = Number(input.unitCost ?? 0);
			return quantity > 0 && unitCost > 0
				? Math.round(quantity * unitCost * 100) / 100
				: null;
		},
	}),
);
mock.module(
	"../../../../src/modules/construction-planning/governance-guard",
	() => ({
		constructionGovernanceGuard: { assertWritable },
		assertNoPendingEffect: mock(async () => undefined),
	}),
);
mock.module(
	"../../../../src/modules/construction-planning/budget-control/overflow-approval",
	() => ({
		withOverflowApproval,
	}),
);
mock.module(
	"../../../../src/modules/construction-planning/budget-control/budget-control.service",
	() => ({
		budgetControlService: { apply: applyBudgetImpact, preview: previewBudget },
	}),
);
mock.module(
	"../../../../src/modules/construction-planning/budget-control/budget-control.repository",
	() => ({
		findActiveImpactsBySource: mock(async () => []),
	}),
);
mock.module(
	"../../../../src/modules/construction-planning/ledger/ledger.integration",
	() => ({
		COMPONENT_AMENDMENT: "AMENDMENT",
		COMPONENT_BASE: "BASE",
		SERVICE_SOURCE_TYPE: "CONTRACT_SERVICE",
		AMENDMENT_SOURCE_TYPE: "CONTRACT_AMENDMENT",
		resolveLedgerItemRef,
		competenceOf: () => "2026-08",
	}),
);
mock.module(
	"../../../../src/modules/construction-planning/ledger/ledger.repository",
	() => ({
		findLedgerEventsBySourcePrefix: mock(async () => []),
	}),
);

mock.module("../../../../src/lib/audit-writer", () => ({
	writeAudit: mock(async () => ({ id: "audit-1" })),
}));

const { ContractService } = await import(
	"../../../../src/modules/construction-planning/contract.service"
);

describe("ContractService.createServices", () => {
	beforeEach(() => {
		getWorkOrThrow.mockClear();
		assertWritable.mockClear();
		createContractServices.mockClear();
		withOverflowApproval.mockClear();
		resolveLedgerItemRef.mockClear();
		applyBudgetImpact.mockClear();
	});

	it("creates every selected service inside one transaction command", async () => {
		const service = new ContractService({ assertWritable } as never);

		const result = await service.createServices(
			"owner-1",
			"work-1",
			"contract-1",
			[
				{ budgetItemId: "item-1", quantity: 10, unitCost: 10, sortOrder: 0 },
				{ budgetItemId: "item-2", quantity: 20, unitCost: 10, sortOrder: 1 },
			],
			{ userId: "user-1" },
		);

		expect(withOverflowApproval).toHaveBeenCalledTimes(1);
		expect(createContractServices).toHaveBeenCalledWith(
			"owner-1",
			"contract-1",
			expect.arrayContaining([
				expect.objectContaining({ budgetItemId: "item-1" }),
				expect.objectContaining({ budgetItemId: "item-2" }),
			]),
			expect.anything(),
		);
		expect(result).toHaveLength(2);
	});

	it("propagates a line failure so the transaction can roll back all lines", async () => {
		createContractServices.mockRejectedValueOnce(
			new Error("second service is invalid"),
		);
		const service = new ContractService({ assertWritable } as never);

		await expect(
			service.createServices(
				"owner-1",
				"work-1",
				"contract-1",
				[
					{ budgetItemId: "item-1", quantity: 10, unitCost: 10, sortOrder: 0 },
					{ budgetItemId: "item-2", quantity: 20, unitCost: 10, sortOrder: 1 },
				],
				{ userId: "user-1" },
			),
		).rejects.toThrow("second service is invalid");
	});

	it("CON-002: saldo insuficiente no segundo servico reverte o lote inteiro", async () => {
		applyBudgetImpact.mockRejectedValueOnce(
			new Error("BUDGET_BALANCE_EXCEEDED"),
		);
		applyBudgetImpact.mockRejectedValueOnce(
			new Error("BUDGET_BALANCE_EXCEEDED"),
		);
		const service = new ContractService({ assertWritable } as never);

		// A rejeicao propaga do commit: com tx real, nada e confirmado
		// (rollback de contrato/servicos juntos).
		await expect(
			service.createServices(
				"owner-1",
				"work-1",
				"contract-1",
				[
					{ budgetItemId: "item-1", quantity: 10, unitCost: 10, sortOrder: 0 },
					{ budgetItemId: "item-2", quantity: 20, unitCost: 10, sortOrder: 1 },
				],
				{ userId: "user-1" },
			),
		).rejects.toThrow("BUDGET_BALANCE_EXCEEDED");
	});
});

describe("ContractService.previewService", () => {
	beforeEach(() => {
		getWorkOrThrow.mockClear();
		createContractService.mockClear();
		getContractServiceBudgetItem.mockClear();
		resolveLedgerItemRef.mockClear();
		applyBudgetImpact.mockClear();
		previewBudget.mockClear();
		resolveLedgerItemRef.mockResolvedValue({
			identityId: "identity-1",
			versionItemId: "version-item-1",
			budgetItemId: "item-1",
		});
		previewBudget.mockResolvedValue({
			items: [
				{
					budgetItemId: "item-1",
					limit: 1000,
					approvedCommitted: 0,
					approvedConsumed: 0,
					pendingImpact: 0,
					availableBalance: 1000,
					projectedBalance: 700,
				},
			],
			totalImpact: 300,
			requiresApproval: false,
		});
	});

	it("calcula saldo antes e depois via budget-control sem persistir nada", async () => {
		const service = new ContractService({ assertWritable } as never);

		const result = await service.previewService(
			"owner-1",
			"work-1",
			"contract-1",
			{ budgetItemId: "item-1", quantity: 10, unitCost: 30 },
		);

		expect(getContractServiceBudgetItem).toHaveBeenCalledWith(
			"owner-1",
			"contract-1",
			"item-1",
		);
		expect(previewBudget).toHaveBeenCalledWith("owner-1", "work-1", {
			allocations: [{ budgetItemId: "item-1", value: 300 }],
		});
		expect(result).toEqual({
			budgetItem: { id: "item-1", description: "Fundacao", index: "1.1" },
			availableBefore: 1000,
			projectedValue: 300,
			availableAfter: 700,
			warnings: [],
		});
		expect(createContractService).not.toHaveBeenCalled();
		expect(applyBudgetImpact).not.toHaveBeenCalled();
	});

	it("rejeita item sem cobertura vigente com CONTRACT_BUDGET_COVERAGE_MISSING", async () => {
		resolveLedgerItemRef.mockResolvedValueOnce(null);
		const service = new ContractService({ assertWritable } as never);

		const promise = service.previewService("owner-1", "work-1", "contract-1", {
			budgetItemId: "item-1",
			quantity: 10,
			unitCost: 30,
		});

		await expect(promise).rejects.toMatchObject({
			code: "CONTRACT_BUDGET_COVERAGE_MISSING",
			status: 422,
		});
		expect(previewBudget).not.toHaveBeenCalled();
	});

	it("retorna 404 quando o contrato nao existe", async () => {
		getContractServiceBudgetItem.mockResolvedValueOnce(null);
		const service = new ContractService({ assertWritable } as never);

		const promise = service.previewService("owner-1", "work-1", "contract-1", {
			budgetItemId: "item-1",
			quantity: 10,
			unitCost: 30,
		});

		await expect(promise).rejects.toMatchObject({
			code: "NOT_FOUND",
			status: 404,
			message: "Contrato nao encontrado",
		});
	});

	it("retorna warning quando o valor projetado excede o saldo disponivel", async () => {
		previewBudget.mockResolvedValueOnce({
			items: [
				{
					budgetItemId: "item-1",
					limit: 1000,
					approvedCommitted: 0,
					approvedConsumed: 0,
					pendingImpact: 0,
					availableBalance: 200,
					projectedBalance: -100,
				},
			],
			totalImpact: 300,
			requiresApproval: true,
		});
		const service = new ContractService({ assertWritable } as never);

		const result = await service.previewService(
			"owner-1",
			"work-1",
			"contract-1",
			{ budgetItemId: "item-1", quantity: 10, unitCost: 30 },
		);

		expect(result.availableBefore).toBe(200);
		expect(result.availableAfter).toBe(-100);
		expect(result.warnings).toContain(
			"O valor projetado excede o saldo disponivel do item de orcamento e dependera de aprovacao",
		);
	});

	it("createService usa a mesma guarda de cobertura da previa", async () => {
		resolveLedgerItemRef.mockResolvedValueOnce(null);
		const service = new ContractService({ assertWritable } as never);

		const promise = service.createService(
			"owner-1",
			"work-1",
			"contract-1",
			{
				budgetItemId: "item-1",
				quantity: 10,
				unitCost: 30,
				sortOrder: 0,
			},
			{ userId: "user-1" },
		);

		await expect(promise).rejects.toMatchObject({
			code: "CONTRACT_BUDGET_COVERAGE_MISSING",
			status: 422,
		});
		expect(createContractService).toHaveBeenCalled();
		expect(applyBudgetImpact).not.toHaveBeenCalled();
	});

	it("createServices usa a mesma guarda de cobertura da previa", async () => {
		resolveLedgerItemRef.mockResolvedValueOnce(null);
		const service = new ContractService({ assertWritable } as never);

		const promise = service.createServices(
			"owner-1",
			"work-1",
			"contract-1",
			[{ budgetItemId: "item-1", quantity: 10, unitCost: 30, sortOrder: 0 }],
			{ userId: "user-1" },
		);

		await expect(promise).rejects.toMatchObject({
			code: "CONTRACT_BUDGET_COVERAGE_MISSING",
			status: 422,
		});
		expect(applyBudgetImpact).not.toHaveBeenCalled();
	});
});
