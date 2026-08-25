import { describe, expect, it, mock } from "bun:test";

const contractFindMany = mock(async (): Promise<unknown[]> => []);
const contractFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => ({
		id: "contract-1",
		workId: "work-1",
	}),
);
const contractCreate = mock(async () => ({ id: "contract-1" }));
const contractUpdate = mock(async () => ({ id: "contract-1" }));
const amendmentFindMany = mock(async () => []);
const amendmentCreate = mock(async () => ({ id: "amendment-1" }));
const amendmentUpdate = mock(async () => ({ id: "amendment-1" }));
const amendmentDelete = mock(async () => ({ id: "amendment-1" }));
const amendmentCount = mock(async () => 0);
const amendmentFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => ({
		id: "amendment-1",
		ownerId: "owner-1",
		contractId: "contract-1",
		kind: "ADITIVO",
		value: 1500,
		reason: "Escopo extra",
		date: new Date("2026-07-01"),
		createdBy: "user-1",
	}),
);
const amendmentMeasurementCreateMany = mock(async () => ({ count: 1 }));
const amendmentMeasurementDeleteMany = mock(async () => ({ count: 1 }));
const amendmentMeasurementFindMany = mock(async () => [
	{ measurementId: "measurement-1" },
]);
const contractMeasurementFindMany = mock(async () => [{ id: "measurement-1" }]);
const budgetItemFindMany = mock(async (): Promise<unknown[]> => []);
const budgetItemFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => ({
		type: "ITEM",
		description: "Fundacao",
		unit: "m3",
	}),
);
const serviceUpdate = mock(async () => ({ id: "service-1" }));
const serviceCreate = mock(async (args: { data: Record<string, unknown> }) => ({
	id: "service-1",
	...args.data,
}));

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		contract: {
			findMany: contractFindMany,
			findFirst: contractFindFirst,
			create: contractCreate,
			update: contractUpdate,
		},
		constructionContractAmendment: {
			findMany: amendmentFindMany,
			findFirst: amendmentFindFirst,
			create: amendmentCreate,
			update: amendmentUpdate,
			delete: amendmentDelete,
			count: amendmentCount,
		},
		contractAmendmentMeasurement: {
			createMany: amendmentMeasurementCreateMany,
			deleteMany: amendmentMeasurementDeleteMany,
			findMany: amendmentMeasurementFindMany,
		},
		contractMeasurement: {
			findMany: contractMeasurementFindMany,
		},
		constructionBudgetItem: {
			findMany: budgetItemFindMany,
			findFirst: budgetItemFindFirst,
		},
		contractService: {
			update: serviceUpdate,
			create: serviceCreate,
		},
		$transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
			callback({
				contractService: { update: serviceUpdate, create: serviceCreate },
				constructionBudgetItem: { findFirst: budgetItemFindFirst },
				constructionContractAmendment: {
					findFirst: amendmentFindFirst,
					update: amendmentUpdate,
				},
				contractMeasurement: { findMany: contractMeasurementFindMany },
				contractAmendmentMeasurement: {
					createMany: amendmentMeasurementCreateMany,
					deleteMany: amendmentMeasurementDeleteMany,
					findMany: amendmentMeasurementFindMany,
				},
			}),
	},
}));

const { getContractsSummary, createContractService } = await import(
	"../../../../src/modules/construction-planning/contract.repository"
);

function makeStoredContract(overrides: Record<string, unknown>) {
	return {
		id: "contract-1",
		ownerId: "owner-1",
		workId: "work-1",
		code: "CT-001",
		supplierName: "Fornecedor Legado",
		supplierId: null,
		supplier: null,
		contractValue: 1000,
		status: "EM_ANDAMENTO",
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		services: [],
		measurements: [],
		payments: [],
		...overrides,
	};
}

describe("getContractsSummary.bySupplier", () => {
	it("inclui nos totais somente contratos operacionais e separa rascunhos e pendentes", async () => {
		contractFindMany.mockResolvedValue([
			makeStoredContract({
				id: "contract-active",
				status: "EM_ANDAMENTO",
				contractValue: 1000,
			}),
			makeStoredContract({
				id: "contract-pending",
				status: "A_INICIAR",
				contractValue: 2000,
			}),
			makeStoredContract({
				id: "contract-draft",
				status: "RASCUNHO",
				contractValue: 3000,
			}),
		]);

		const summary = await getContractsSummary("owner-1", "work-1");

		expect(summary).toMatchObject({
			totalContracts: 3,
			operationalContracts: 1,
			pendingContracts: 1,
			draftContracts: 1,
			pendingContractValue: 2000,
			totalContractValue: 1000,
		});
	});

	it("agrupa contratos por supplierId somando valores contratado, medido e pago", async () => {
		contractFindMany.mockResolvedValue([
			makeStoredContract({
				id: "contract-1",
				supplierId: "sup-1",
				supplier: { name: "Fornecedor Alfa" },
				supplierName: "Fornecedor Alfa",
				contractValue: 1000,
				services: [
					{ id: "svc-1", quantity: 10, unitCost: 100, totalCost: 1000 },
				],
				measurements: [
					{
						items: [
							{
								serviceId: "svc-1",
								accumulatedQuantity: 5,
								accumulatedValue: null,
								measuredValue: null,
								accumulatedPercentage: null,
								measuredPercentage: null,
							},
						],
					},
				],
				payments: [
					{ status: "PAGO", paidValue: 400 },
					{ status: "EM_ABERTO", paidValue: 100 },
				],
			}),
			makeStoredContract({
				id: "contract-2",
				supplierId: "sup-1",
				supplier: { name: "Fornecedor Alfa" },
				supplierName: "Fornecedor Alfa",
				contractValue: 2000,
				services: [
					{ id: "svc-2", quantity: null, unitCost: null, totalCost: 2000 },
				],
				measurements: [
					{
						items: [
							{
								serviceId: "svc-2",
								accumulatedQuantity: null,
								accumulatedValue: null,
								measuredValue: null,
								accumulatedPercentage: 50,
								measuredPercentage: null,
							},
						],
					},
				],
				payments: [{ status: "PAGO", paidValue: 600 }],
			}),
			makeStoredContract({
				id: "contract-3",
				supplierId: null,
				supplier: null,
				supplierName: "Sem Fornecedor",
				contractValue: 3000,
				payments: [{ status: "PAGO", paidValue: 300 }],
			}),
		]);

		const summary = await getContractsSummary("owner-1", "work-1");

		expect(summary.bySupplier).toEqual([
			{
				supplierId: "sup-1",
				supplierName: "Fornecedor Alfa",
				contractedValue: 3000,
				measuredValue: 1500,
				paidValue: 1000,
			},
			{
				supplierId: null,
				supplierName: null,
				contractedValue: 3000,
				measuredValue: 0,
				paidValue: 300,
			},
		]);
	});

	it("mantem os totais existentes inalterados com bySupplier presente", async () => {
		contractFindMany.mockResolvedValue([
			makeStoredContract({
				id: "contract-1",
				contractValue: 1000,
				payments: [{ status: "PAGO", paidValue: 250 }],
			}),
		]);

		const summary = await getContractsSummary("owner-1", "work-1");

		expect(summary.totalContracts).toBe(1);
		expect(summary.totalContractValue).toBe(1000);
		expect(summary.totalPaidValue).toBe(250);
		expect(Array.isArray(summary.bySupplier)).toBe(true);
	});

	it("retorna lista vazia quando nao ha contratos", async () => {
		contractFindMany.mockResolvedValue([]);

		const summary = await getContractsSummary("owner-1", "work-1");

		expect(summary.bySupplier).toEqual([]);
	});
});

describe("getContractsSummary com aditivos", () => {
	it("deriva o valor contratado pela soma de aditivos e reducoes", async () => {
		contractFindMany.mockResolvedValue([
			makeStoredContract({
				id: "contract-1",
				supplierId: "sup-1",
				supplier: { name: "Fornecedor Alfa" },
				supplierName: "Fornecedor Alfa",
				contractValue: 1000,
				amendments: [
					{ kind: "ADITIVO", value: 200 },
					{ kind: "REDUCAO", value: 100 },
				],
				payments: [{ status: "PAGO", paidValue: 300 }],
			}),
		]);

		const summary = await getContractsSummary("owner-1", "work-1");

		expect(summary.totalContractValue).toBe(1100);
		expect(summary.totalPaidValue).toBe(300);
		expect(summary.paidPercentage).toBeCloseTo(300 / 1100, 6);
		expect(summary.bySupplier[0].contractedValue).toBe(1100);
	});
});

describe("amendment repository", () => {
	it("cria aditivo persistindo kind, value, reason e createdBy", async () => {
		amendmentCreate.mockClear();
		const { createAmendment } = await import(
			"../../../../src/modules/construction-planning/contract.repository"
		);

		const result = await createAmendment("owner-1", "contract-1", {
			kind: "ADITIVO",
			value: 1500,
			reason: "Escopo extra",
			date: "2026-07-01",
			createdBy: "user-1",
			measurementIds: ["measurement-1"],
		});

		expect(result?.id).toBe("amendment-1");
		expect(amendmentCreate).toHaveBeenCalledWith({
			data: {
				ownerId: "owner-1",
				contractId: "contract-1",
				kind: "ADITIVO",
				value: 1500,
				reason: "Escopo extra",
				date: new Date("2026-07-01"),
				createdBy: "user-1",
			},
		});
		expect(amendmentMeasurementCreateMany).toHaveBeenCalledWith({
			data: [
				{
					ownerId: "owner-1",
					amendmentId: "amendment-1",
					measurementId: "measurement-1",
				},
			],
		});
	});

	it("retorna null quando o contrato nao existe no listAmendments", async () => {
		contractFindFirst.mockImplementationOnce(
			async (): Promise<Record<string, unknown> | null> => null,
		);
		const { listAmendments } = await import(
			"../../../../src/modules/construction-planning/contract.repository"
		);

		const result = await listAmendments("owner-1", "contract-1");

		expect(result).toBeNull();
	});

	it("rejeita medicao que nao pertence ao contrato do aditivo", async () => {
		contractMeasurementFindMany.mockResolvedValueOnce([]);
		const { createAmendment } = await import(
			"../../../../src/modules/construction-planning/contract.repository"
		);

		await expect(
			createAmendment("owner-1", "contract-1", {
				kind: "ADITIVO",
				value: 100,
				reason: "Escopo extra",
				date: "2026-07-01",
				createdBy: "user-1",
				measurementIds: ["measurement-other-contract"],
			}),
		).rejects.toMatchObject({
			code: "CONTRACT_AMENDMENT_MEASUREMENT_INVALID",
			status: 422,
		});
	});

	it("deduplica measurementIds duplicados ao criar aditivo", async () => {
		contractMeasurementFindMany.mockResolvedValueOnce([
			{ id: "measurement-1" },
			{ id: "measurement-2" },
		]);
		amendmentMeasurementCreateMany.mockClear();
		const { createAmendment } = await import(
			"../../../../src/modules/construction-planning/contract.repository"
		);

		await createAmendment("owner-1", "contract-1", {
			kind: "ADITIVO",
			value: 100,
			reason: "Escopo extra",
			date: "2026-07-01",
			createdBy: "user-1",
			measurementIds: ["measurement-1", "measurement-1", "measurement-2"],
		});

		expect(amendmentMeasurementCreateMany).toHaveBeenCalledWith({
			data: [
				{
					ownerId: "owner-1",
					amendmentId: "amendment-1",
					measurementId: "measurement-1",
				},
				{
					ownerId: "owner-1",
					amendmentId: "amendment-1",
					measurementId: "measurement-2",
				},
			],
		});
	});

	it("nao persiste associacao parcial quando medicao do aditivo e invalida", async () => {
		contractMeasurementFindMany.mockResolvedValueOnce([]);
		amendmentCreate.mockClear();
		amendmentMeasurementCreateMany.mockClear();
		const { createAmendment } = await import(
			"../../../../src/modules/construction-planning/contract.repository"
		);

		await expect(
			createAmendment("owner-1", "contract-1", {
				kind: "ADITIVO",
				value: 100,
				reason: "Escopo extra",
				date: "2026-07-01",
				createdBy: "user-1",
				measurementIds: ["measurement-ok", "measurement-other-contract"],
			}),
		).rejects.toMatchObject({
			code: "CONTRACT_AMENDMENT_MEASUREMENT_INVALID",
			status: 422,
		});

		expect(amendmentCreate).not.toHaveBeenCalled();
		expect(amendmentMeasurementCreateMany).not.toHaveBeenCalled();
	});

	it("atualiza vinculos de medicao com dedupe dentro do tx", async () => {
		contractMeasurementFindMany.mockResolvedValueOnce([
			{ id: "measurement-1" },
			{ id: "measurement-2" },
		]);
		amendmentMeasurementDeleteMany.mockClear();
		amendmentMeasurementCreateMany.mockClear();
		const { updateAmendment } = await import(
			"../../../../src/modules/construction-planning/contract.repository"
		);

		const result = await updateAmendment(
			"owner-1",
			"contract-1",
			"amendment-1",
			{
				measurementIds: ["measurement-1", "measurement-1", "measurement-2"],
			},
		);

		expect(result?.previous?.id).toBe("amendment-1");
		expect(amendmentMeasurementDeleteMany).toHaveBeenCalledWith({
			where: { amendmentId: "amendment-1" },
		});
		expect(amendmentMeasurementCreateMany).toHaveBeenCalledWith({
			data: [
				{
					ownerId: "owner-1",
					amendmentId: "amendment-1",
					measurementId: "measurement-1",
				},
				{
					ownerId: "owner-1",
					amendmentId: "amendment-1",
					measurementId: "measurement-2",
				},
			],
		});
		expect(result?.updated?.measurementIds).toEqual([
			"measurement-1",
			"measurement-2",
		]);
	});

	it("rejeita update de aditivo com medicao de outro contrato sem tocar nos vinculos", async () => {
		contractMeasurementFindMany.mockResolvedValueOnce([]);
		amendmentMeasurementDeleteMany.mockClear();
		amendmentMeasurementCreateMany.mockClear();
		const { updateAmendment } = await import(
			"../../../../src/modules/construction-planning/contract.repository"
		);

		await expect(
			updateAmendment("owner-1", "contract-1", "amendment-1", {
				measurementIds: ["measurement-other-contract"],
			}),
		).rejects.toMatchObject({
			code: "CONTRACT_AMENDMENT_MEASUREMENT_INVALID",
			status: 422,
		});

		expect(amendmentMeasurementDeleteMany).not.toHaveBeenCalled();
		expect(amendmentMeasurementCreateMany).not.toHaveBeenCalled();
	});
});

describe("createContract com supplierId", () => {
	it("persiste supplierId quando fornecido", async () => {
		contractCreate.mockClear();
		const { createContract } = await import(
			"../../../../src/modules/construction-planning/contract.repository"
		);

		await createContract("owner-1", "work-1", {
			code: "CT-001",
			supplierName: "Fornecedor Alfa",
			supplierId: "sup-1",
			contractValue: 1000,
			status: "RASCUNHO",
		});

		expect(contractCreate).toHaveBeenCalledWith({
			data: {
				ownerId: "owner-1",
				workId: "work-1",
				code: "CT-001",
				supplierName: "Fornecedor Alfa",
				supplierId: "sup-1",
				contractValue: 1000,
				serviceType: null,
				title: null,
				startDate: null,
				endDate: null,
				status: "RASCUNHO",
				createdBy: null,
				notes: null,
			},
		});
	});

	it("persiste supplierId null quando nao fornecido", async () => {
		contractCreate.mockClear();
		const { createContract } = await import(
			"../../../../src/modules/construction-planning/contract.repository"
		);

		await createContract("owner-1", "work-1", {
			code: "CT-002",
			supplierName: "Fornecedor Legado",
			contractValue: 1000,
			status: "RASCUNHO",
		});

		expect(contractCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({ supplierId: null }),
		});
	});
});

describe("updateContract com supplierId", () => {
	it("atualiza supplierId quando fornecido", async () => {
		contractUpdate.mockClear();
		const { updateContract } = await import(
			"../../../../src/modules/construction-planning/contract.repository"
		);

		await updateContract("owner-1", "work-1", "contract-1", {
			supplierId: "sup-1",
		});

		expect(contractUpdate).toHaveBeenCalledWith({
			where: { id: "contract-1", ownerId: "owner-1" },
			data: { supplierId: "sup-1" },
		});
	});

	it("limpa supplierId quando null explicito", async () => {
		contractUpdate.mockClear();
		const { updateContract } = await import(
			"../../../../src/modules/construction-planning/contract.repository"
		);

		await updateContract("owner-1", "work-1", "contract-1", {
			supplierId: null,
		});

		expect(contractUpdate).toHaveBeenCalledWith({
			where: { id: "contract-1", ownerId: "owner-1" },
			data: { supplierId: null },
		});
	});
});

describe("getContractById detalhe", () => {
	it("retorna totalValue derivado e amendmentTotal com aditivos", async () => {
		contractFindFirst.mockImplementationOnce(
			async (): Promise<Record<string, unknown> | null> => ({
				id: "contract-1",
				ownerId: "owner-1",
				workId: "work-1",
				code: "CT-001",
				supplierName: "Fornecedor Alfa",
				supplierId: "sup-1",
				contractValue: 100000,
				services: [],
				folders: [],
				amendments: [
					{ kind: "ADITIVO", value: 15000 },
					{ kind: "REDUCAO", value: 5000 },
				],
			}),
		);
		const { getContractById } = await import(
			"../../../../src/modules/construction-planning/contract.repository"
		);

		const result = await getContractById("owner-1", "work-1", "contract-1");

		expect(result).toMatchObject({
			totalValue: 110000,
			amendmentTotal: 10000,
			amendments: [
				{ kind: "ADITIVO", value: 15000 },
				{ kind: "REDUCAO", value: 5000 },
			],
		});
	});

	it("retorna totalValue igual ao base e amendmentTotal zero sem aditivos", async () => {
		contractFindFirst.mockImplementationOnce(
			async (): Promise<Record<string, unknown> | null> => ({
				id: "contract-1",
				ownerId: "owner-1",
				workId: "work-1",
				code: "CT-001",
				supplierName: "Fornecedor Alfa",
				supplierId: null,
				contractValue: 50000,
				services: [],
				folders: [],
				amendments: [],
			}),
		);
		const { getContractById } = await import(
			"../../../../src/modules/construction-planning/contract.repository"
		);

		const result = await getContractById("owner-1", "work-1", "contract-1");

		expect(result).toMatchObject({
			totalValue: 50000,
			amendmentTotal: 0,
			amendments: [],
		});
	});
});

describe("linkServicesToBudget", () => {
	it("rejeita budgetItemId de outra obra -> 422 INVALID_BUDGET_ITEM", async () => {
		budgetItemFindMany.mockImplementationOnce(async () => [{ id: "bi-1" }]);
		const { linkServicesToBudget } = await import(
			"../../../../src/modules/construction-planning/contract.repository"
		);

		const promise = linkServicesToBudget("owner-1", "contract-1", {
			links: [
				{ serviceId: "service-1", budgetItemId: "bi-1" },
				{ serviceId: "service-2", budgetItemId: "bi-fora-da-obra" },
			],
		});

		await expect(promise).rejects.toMatchObject({
			code: "INVALID_BUDGET_ITEM",
			status: 422,
			message: "Item de orcamento nao pertence a obra do contrato",
		});
		expect(serviceUpdate).not.toHaveBeenCalled();
	});

	it("vincula servicos quando todos os budgetItemId pertencem a obra", async () => {
		budgetItemFindMany.mockImplementationOnce(async () => [
			{ id: "bi-1" },
			{ id: "bi-2" },
		]);
		serviceUpdate.mockClear();
		const { linkServicesToBudget } = await import(
			"../../../../src/modules/construction-planning/contract.repository"
		);

		const result = await linkServicesToBudget("owner-1", "contract-1", {
			links: [
				{ serviceId: "service-1", budgetItemId: "bi-1" },
				{ serviceId: "service-2", budgetItemId: "bi-2" },
			],
		});

		expect(result).toHaveLength(2);
		expect(serviceUpdate).toHaveBeenCalledWith({
			where: { id: "service-1", contractId: "contract-1" },
			data: { budgetItemId: "bi-1" },
		});
		expect(serviceUpdate).toHaveBeenCalledWith({
			where: { id: "service-2", contractId: "contract-1" },
			data: { budgetItemId: "bi-2" },
		});
	});
});

describe("createContractService", () => {
	it("deriva descricao, tipo e unidade do item de orcamento da obra do contrato", async () => {
		contractFindFirst.mockResolvedValue({ id: "contract-1", workId: "work-1" });
		budgetItemFindFirst.mockResolvedValue({
			type: "SUBETAPA",
			description: "Estrutura",
			unit: "m2",
		});
		serviceCreate.mockClear();

		const result = await createContractService("owner-1", "contract-1", {
			budgetItemId: "bi-1",
			quantity: 10,
			unitCost: 300,
			sortOrder: 2,
		});

		expect(serviceCreate).toHaveBeenCalledWith({
			data: {
				contractId: "contract-1",
				type: "SUBETAPA",
				description: "Estrutura",
				parentId: null,
				unit: "m2",
				quantity: 10,
				unitCost: 300,
				totalCost: 3000,
				budgetItemId: "bi-1",
				sortOrder: 2,
			},
		});
		expect(result).toMatchObject({
			id: "service-1",
			description: "Estrutura",
			type: "SUBETAPA",
			unit: "m2",
		});
	});

	it("rejeita item de orcamento de outra obra com INVALID_BUDGET_ITEM", async () => {
		contractFindFirst.mockResolvedValue({ id: "contract-1", workId: "work-1" });
		budgetItemFindFirst.mockResolvedValue(null);
		serviceCreate.mockClear();

		const promise = createContractService("owner-1", "contract-1", {
			budgetItemId: "bi-fora-da-obra",
			sortOrder: 0,
		});

		await expect(promise).rejects.toMatchObject({
			code: "INVALID_BUDGET_ITEM",
			status: 422,
			message: "Item de orcamento nao pertence a obra do contrato",
		});
		expect(serviceCreate).not.toHaveBeenCalled();
	});

	it("rejeita item inexistente com INVALID_BUDGET_ITEM", async () => {
		contractFindFirst.mockResolvedValue({ id: "contract-1", workId: "work-1" });
		budgetItemFindFirst.mockResolvedValue(null);
		serviceCreate.mockClear();

		const promise = createContractService("owner-1", "contract-1", {
			budgetItemId: "bi-inexistente",
			sortOrder: 0,
		});

		await expect(promise).rejects.toMatchObject({
			code: "INVALID_BUDGET_ITEM",
			status: 422,
		});
		expect(serviceCreate).not.toHaveBeenCalled();
	});

	it("persiste totalCost null quando custo unitario nao e informado", async () => {
		contractFindFirst.mockResolvedValue({ id: "contract-1", workId: "work-1" });
		budgetItemFindFirst.mockResolvedValue({
			type: "ITEM",
			description: "Fundacao",
			unit: "m3",
		});
		serviceCreate.mockClear();

		await createContractService("owner-1", "contract-1", {
			budgetItemId: "bi-1",
			quantity: 10,
			sortOrder: 0,
		});

		const calls = serviceCreate.mock.calls;
		const lastCall = calls[calls.length - 1];
		const data = lastCall?.[0]?.data as { totalCost: number | null };
		expect(data.totalCost).toBeNull();
	});
});
