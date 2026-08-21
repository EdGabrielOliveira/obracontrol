import { beforeEach, describe, expect, it, mock } from "bun:test";

const quotationFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const quotationFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const quotationCreate = mock(
	async (args: { data: Record<string, unknown> }) => ({
		id: "quote-1",
		...args.data,
		createdAt: new Date(),
		proposals: [],
	}),
);
const quotationUpdate = mock(
	async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
		id: args.where.id,
		...args.data,
	}),
);
const quotationBudgetItemCreateMany = mock(async () => ({ count: 1 }));
const quotationBudgetItemFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const proposalCreate = mock(async () => ({ id: "prop-1" }));
const proposalFindFirst = mock(async () => ({ id: "prop-1", value: 10000 }));
const proposalUpdate = mock(async () => ({ id: "prop-1" }));
const proposalUpdateMany = mock(async () => ({ count: 1 }));
const quotationRoundFindFirst = mock(async () => ({
	id: "round-1",
	roundNumber: 1,
}));
const quotationRoundCreate = mock(
	async (args: { data: Record<string, unknown> }) => ({
		id: "round-1",
		...args.data,
	}),
);
const negotiationEventCreate = mock(async () => ({ id: "event-1" }));
const contractCreate = mock(
	async (args: { data: Record<string, unknown> }) => ({
		id: "contract-1",
		...args.data,
	}),
);
const contractServiceCreate = mock(async () => ({ id: "svc-1" }));
const auditLogCreate = mock(async () => ({ id: "audit-1" }));
const budgetItemFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const transaction = mock(async (fn: (tx: unknown) => unknown) => fn({}));
const findSupplierByDocument = mock(
	async (_ownerId: string, _document: string): Promise<{ id: string } | null> =>
		null,
);
const getSupplierById = mock(async (): Promise<{ id: string } | null> => null);
const createContractWithEffectsInTx = mock(async () => ({
	contract: {
		id: "contract-1",
		code: "Q-quote-1",
		ownerId: "owner-1",
		workId: "work-1",
		createdBy: "user-1",
		contractValue: 10000,
		serviceCount: 1,
		status: "RASCUNHO",
	},
	replayed: false,
}));

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		quotation: {
			findFirst: quotationFindFirst,
			findMany: quotationFindMany,
			create: quotationCreate,
			update: quotationUpdate,
		},
		quotationBudgetItem: {
			createMany: quotationBudgetItemCreateMany,
			findMany: quotationBudgetItemFindMany,
		},
		quotationProposal: {
			findFirst: proposalFindFirst,
			create: proposalCreate,
			update: proposalUpdate,
			updateMany: proposalUpdateMany,
		},
		contract: { create: contractCreate },
		contractService: { create: contractServiceCreate },
		auditLog: { create: auditLogCreate },
		constructionBudgetItem: { findMany: budgetItemFindMany },
		$transaction: transaction,
	},
}));

mock.module("../../../../src/modules/construction-planning/repository", () => ({
	getWorkOrThrow: mock(async () => ({ id: "work-1" })),
}));
mock.module(
	"../../../../src/modules/construction-planning/suppliers/supplier.repository",
	() => ({
		findSupplierByDocument,
		getSupplierById,
	}),
);
mock.module(
	"../../../../src/modules/construction-planning/contracts/contract-creation.service",
	() => ({
		createContractWithEffectsInTx,
	}),
);

const { quotationService } = await import(
	"../../../../src/modules/construction-planning/quotation.service"
);

function makeQuotation(overrides: Record<string, unknown> = {}) {
	return {
		id: "quote-1",
		ownerId: "owner-1",
		workId: "work-1",
		title: "Cotacao fundacao",
		observation: null,
		status: "EM_COTACAO",
		maxSuppliers: 3,
		contractId: null,
		createdAt: new Date(),
		proposals: [],
		...overrides,
	};
}

function makeProposal(overrides: Record<string, unknown> = {}) {
	return {
		id: "prop-1",
		quotationId: "quote-1",
		supplierName: "Fornecedor A",
		value: 10000,
		justification: null,
		isWinner: false,
		...overrides,
	};
}

describe("quotationService (CON-003/004, DEC-002/003)", () => {
	beforeEach(() => {
		quotationFindFirst.mockClear();
		quotationFindMany.mockClear();
		quotationCreate.mockClear();
		quotationUpdate.mockClear();
		quotationBudgetItemCreateMany.mockClear();
		quotationBudgetItemFindMany.mockClear();
		proposalCreate.mockClear();
		proposalUpdate.mockClear();
		proposalUpdateMany.mockClear();
		contractCreate.mockClear();
		contractServiceCreate.mockClear();
		auditLogCreate.mockClear();
		budgetItemFindMany.mockClear();
		transaction.mockClear();
		findSupplierByDocument.mockClear();
		getSupplierById.mockClear();
		createContractWithEffectsInTx.mockClear();
		quotationFindFirst.mockResolvedValue(null);
		quotationCreate.mockImplementation(
			async (args: { data: Record<string, unknown> }) => ({
				id: "quote-1",
				...args.data,
				createdAt: new Date(),
				proposals: [],
			}),
		);
		proposalUpdateMany.mockResolvedValue({ count: 1 });
		transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
			fn({
				quotation: { create: quotationCreate, update: quotationUpdate },
				quotationBudgetItem: {
					createMany: quotationBudgetItemCreateMany,
					findMany: quotationBudgetItemFindMany,
				},
				contract: { create: contractCreate },
				contractService: { create: contractServiceCreate },
				auditLog: { create: auditLogCreate },
				quotationProposal: {
					findFirst: proposalFindFirst,
					updateMany: proposalUpdateMany,
					update: proposalUpdate,
				},
				quotationRound: {
					findFirst: quotationRoundFindFirst,
					create: quotationRoundCreate,
				},
				proposalNegotiationEvent: { create: negotiationEventCreate },
			}),
		);
		budgetItemFindMany.mockResolvedValue([]);
		quotationBudgetItemFindMany.mockResolvedValue([]);
	});

	it("expoe os campos expandidos da proposta de empreitada", async () => {
		quotationFindFirst.mockResolvedValue(
			makeQuotation({
				proposals: [
					makeProposal({
						supplierId: null,
						supplierDocument: "12345678000190",
						supplierName: "Construtora Modelo Ltda.",
						supplierAddress: "Rua das Palmeiras, 250, Centro",
						supplierPhone: "83999991234",
						supplierEmail: "contato@modelo.com.br",
						supplierResponsible: "João Silva",
						serviceDescription: "Execução de alvenaria e reboco",
						value: 35000,
						serviceStartDate: new Date("2026-09-01"),
						executionTermDays: 90,
						paymentTerms: "30/60/90 dias",
						notes: "Prazo negociável",
						justification: null,
						isWinner: false,
					}),
				],
			}),
		);

		const result = await quotationService.get("owner-1", "quote-1");

		expect(result.proposals[0]).toEqual(
			expect.objectContaining({
				supplierAddress: "Rua das Palmeiras, 250, Centro",
				supplierEmail: "contato@modelo.com.br",
				serviceDescription: "Execução de alvenaria e reboco",
				serviceStartDate: "2026-09-01T00:00:00.000Z",
				executionTermDays: 90,
				paymentTerms: "30/60/90 dias",
				notes: "Prazo negociável",
			}),
		);
	});

	it("lista cotacoes da obra do owner ordenadas por criacao", async () => {
		quotationFindMany.mockResolvedValue([
			makeQuotation({ id: "quote-2" }),
			makeQuotation({ id: "quote-1" }),
		]);

		const result = await quotationService.list("owner-1", "work-1");

		expect(quotationFindMany).toHaveBeenCalledWith({
			where: { ownerId: "owner-1", workId: "work-1" },
			orderBy: { createdAt: "desc" },
			include: {
				proposals: { orderBy: { value: "asc" } },
				budgetItems: {
					include: { budgetItem: true },
					orderBy: { createdAt: "asc" },
				},
			},
		});
		expect(result).toHaveLength(2);
	});

	it("cria cotacao como etapa previa ao contrato", async () => {
		budgetItemFindMany.mockResolvedValue([
			{ id: "budget-1", ownerId: "owner-1", workId: "work-1" },
		]);

		const result = await quotationService.create(
			"owner-1",
			"work-1",
			{
				title: "Cotacao fundacao",
				items: [{ budgetItemId: "budget-1", quantity: 10 }],
			},
			{ userId: "user-1" },
		);

		expect(quotationCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					ownerId: "owner-1",
					workId: "work-1",
					title: "Cotacao fundacao",
					status: "EM_COTACAO",
					maxSuppliers: 3,
				}),
			}),
		);
		expect(result.status).toBe("EM_COTACAO");
	});

	it("cria solicitacao sem fornecedor ou valor com itens selecionados", async () => {
		budgetItemFindMany.mockResolvedValue([{ id: "budget-1" }]);
		const result = await quotationService.create(
			"owner-1",
			"work-1",
			{
				serviceType: "Execucao",
				title: "Contrato de pintura",
				items: [{ budgetItemId: "budget-1", quantity: 10 }],
			},
			{ userId: "user-1" },
		);

		expect(quotationCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					serviceType: "Execucao",
				}),
			}),
		);
		expect(result.items).toHaveLength(1);
	});

	it("cria cotacao com apenas os itens selecionados", async () => {
		budgetItemFindMany.mockResolvedValue([
			{
				id: "budget-1",
				ownerId: "owner-1",
				workId: "work-1",
				description: "Pintura",
				unit: "m2",
				unitCost: 12,
				totalCost: 1200,
			},
		]);

		const result = await quotationService.create(
			"owner-1",
			"work-1",
			{
				title: "Pintura",
				items: [{ budgetItemId: "budget-1", quantity: 40 }],
			},
			{ userId: "user-1" },
		);

		expect(quotationBudgetItemCreateMany).toHaveBeenCalledWith({
			data: [
				{
					ownerId: "owner-1",
					workId: "work-1",
					quotationId: "quote-1",
					budgetItemId: "budget-1",
					quantity: 40,
				},
			],
		});
		expect(result.items).toEqual([
			expect.objectContaining({ budgetItemId: "budget-1", quantity: 40 }),
		]);
	});

	it("rejeita item de outra obra", async () => {
		budgetItemFindMany.mockResolvedValue([]);

		await expect(
			quotationService.create(
				"owner-1",
				"work-1",
				{
					title: "Pintura",
					items: [{ budgetItemId: "budget-other-work", quantity: 40 }],
				},
				{ userId: "user-1" },
			),
		).rejects.toMatchObject({ code: "INVALID_BUDGET_ITEM", status: 422 });
	});

	it("compara propostas com o total orcado dos itens selecionados", async () => {
		quotationFindFirst.mockResolvedValue(
			makeQuotation({
				budgetItems: [
					{
						id: "quotation-item-1",
						budgetItemId: "budget-1",
						quantity: 40,
						budgetItem: {
							id: "budget-1",
							index: "1.1",
							description: "Pintura",
							unit: "m2",
							unitCost: 10,
							totalCost: 1000,
						},
					},
				],
				proposals: [makeProposal({ value: 450 })],
			}),
		);

		const result = await quotationService.getComparison(
			"owner-1",
			"work-1",
			"quote-1",
		);

		expect(result.budgetTotal).toBe(400);
		expect(result.proposals[0]).toEqual(
			expect.objectContaining({ value: 450, differenceFromBudget: 50 }),
		);
	});

	it("informa quais propostas possuem fornecedor cadastrado pelo CNPJ", async () => {
		quotationFindFirst.mockResolvedValue(
			makeQuotation({
				proposals: [
					makeProposal({ supplierDocument: "12345678000190" }),
					makeProposal({
						id: "prop-2",
						supplierDocument: "98765432000100",
					}),
				],
			}),
		);
		findSupplierByDocument.mockImplementation(async (_ownerId, document) =>
			document === "12345678000190" ? { id: "supplier-1" } : null,
		);

		const result = await quotationService.getComparison(
			"owner-1",
			"work-1",
			"quote-1",
		);

		expect(
			result.proposals.map((proposal) => proposal.supplierRegistered),
		).toEqual([true, false]);
	});

	it("compara fornecedores por CNPJ com estado de cadastro e id resolvido", async () => {
		quotationFindFirst.mockResolvedValue(
			makeQuotation({
				proposals: [
					makeProposal({
						supplierId: null,
						supplierDocument: "12345678000190",
					}),
					makeProposal({
						id: "prop-2",
						supplierId: null,
						supplierDocument: "98765432000100",
					}),
				],
			}),
		);
		findSupplierByDocument.mockImplementation(async (_ownerId, document) =>
			document === "12345678000190" ? { id: "supplier-1" } : null,
		);

		const comparison = await quotationService.getComparison(
			"owner-1",
			"work-1",
			"quote-1",
		);

		expect(comparison.proposals).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					supplierDocument: "12345678000190",
					supplierRegistered: true,
					supplierId: "supplier-1",
				}),
				expect.objectContaining({
					supplierDocument: "98765432000100",
					supplierRegistered: false,
					supplierId: null,
				}),
			]),
		);
	});

	it("o CNPJ resolvido prevalece sobre supplierId legado no comparativo", async () => {
		quotationFindFirst.mockResolvedValue(
			makeQuotation({
				proposals: [
					makeProposal({
						supplierId: "stale-supplier",
						supplierDocument: "12345678000190",
					}),
				],
			}),
		);
		findSupplierByDocument.mockResolvedValue({ id: "supplier-1" });

		const comparison = await quotationService.getComparison(
			"owner-1",
			"work-1",
			"quote-1",
		);

		expect(comparison.proposals[0]).toEqual(
			expect.objectContaining({
				supplierRegistered: true,
				supplierId: "supplier-1",
			}),
		);
	});

	it("proposta com CNPJ nao cadastrado fica fora do aceite ate cadastrar e vincular", async () => {
		quotationFindFirst
			.mockResolvedValueOnce(
				makeQuotation({
					status: "NEGOCIACAO",
					proposals: [makeProposal({ supplierDocument: "98765432000100" })],
				}),
			)
			.mockResolvedValueOnce(
				makeQuotation({
					status: "CONTRATADA",
					contractId: "contract-1",
					proposals: [makeProposal({ isWinner: true })],
				}),
			);
		findSupplierByDocument.mockImplementation(async (_ownerId, document) =>
			document === "98765432000100" ? { id: "supplier-9" } : null,
		);
		quotationBudgetItemFindMany.mockResolvedValue([
			{
				id: "quotation-item-1",
				budgetItemId: "item-1.1",
				quantity: 10,
				budgetItem: {
					type: "ITEM",
					description: "Servico",
					unit: "m2",
					unitCost: 100,
					totalCost: 1000,
				},
			} as Record<string, unknown>,
		]);

		const result = await quotationService.chooseWinner(
			"owner-1",
			"quote-1",
			"prop-1",
			{ userId: "user-1" },
		);

		expect(createContractWithEffectsInTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				supplier: expect.objectContaining({ supplierId: "supplier-9" }),
			}),
		);
		expect(result.status).toBe("CONTRATADA");
	});

	it("DEC-003: limite de propostas respeita maxSuppliers (padrao 3)", async () => {
		quotationFindFirst.mockResolvedValue(
			makeQuotation({
				status: "NEGOCIACAO",
				proposals: [
					makeProposal({ id: "p1", supplierName: "A" }),
					makeProposal({ id: "p2", supplierName: "B" }),
					makeProposal({ id: "p3", supplierName: "C" }),
				],
			}),
		);

		await expect(
			quotationService.addProposal("owner-1", "quote-1", {
				supplierName: "D",
				value: 9000,
			}),
		).rejects.toMatchObject({
			code: "QUOTATION_MAX_PROPOSALS",
			status: 422,
		});
		expect(proposalCreate).not.toHaveBeenCalled();
	});

	it("adiciona proposta e move a cotacao para NEGOCIACAO", async () => {
		// 1a busca (validacao) -> EM_COTACAO sem propostas; get() final ->
		// NEGOCIACAO com a proposta adicionada.
		quotationFindFirst
			.mockResolvedValueOnce(makeQuotation())
			.mockResolvedValueOnce(
				makeQuotation({ status: "NEGOCIACAO", proposals: [makeProposal()] }),
			);
		quotationUpdate.mockResolvedValue(makeQuotation({ status: "NEGOCIACAO" }));

		const result = await quotationService.addProposal("owner-1", "quote-1", {
			supplierName: "Fornecedor A",
			value: 10000,
		});

		expect(proposalCreate).toHaveBeenCalled();
		expect(quotationUpdate).toHaveBeenCalledWith({
			where: { id: "quote-1" },
			data: { status: "NEGOCIACAO" },
		});
		expect(result.proposals).toHaveLength(1);
	});

	it("normaliza o CNPJ da proposta", async () => {
		quotationFindFirst
			.mockResolvedValueOnce(makeQuotation())
			.mockResolvedValueOnce(
				makeQuotation({
					status: "NEGOCIACAO",
					proposals: [makeProposal({ supplierDocument: "12345678000190" })],
				}),
			);

		await quotationService.addProposal("owner-1", "quote-1", {
			supplierName: "Fornecedor A",
			supplierDocument: "12.345.678/0001-90",
			value: 10000,
		});

		expect(proposalCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({ supplierDocument: "12345678000190" }),
		});
	});

	it("rejeita CNPJ de proposta com tamanho invalido", async () => {
		quotationFindFirst.mockResolvedValue(makeQuotation());

		await expect(
			quotationService.addProposal("owner-1", "quote-1", {
				supplierName: "Fornecedor A",
				supplierDocument: "123",
				value: 10000,
			}),
		).rejects.toMatchObject({ code: "INVALID_CNPJ", status: 400 });
	});

	it("rejeita proposta duplicada do mesmo fornecedor", async () => {
		quotationFindFirst.mockResolvedValue(
			makeQuotation({
				status: "NEGOCIACAO",
				proposals: [makeProposal({ supplierName: "Fornecedor A" })],
			}),
		);

		await expect(
			quotationService.addProposal("owner-1", "quote-1", {
				supplierName: "Fornecedor A",
				value: 9000,
			}),
		).rejects.toMatchObject({
			code: "DUPLICATE_PROPOSAL",
			status: 409,
		});
	});

	it("negociacao edita valor com justificativa obrigatoria", async () => {
		quotationFindFirst.mockResolvedValue(
			makeQuotation({ status: "NEGOCIACAO" }),
		);

		await quotationService.negotiate("owner-1", "quote-1", "prop-1", {
			value: 9500,
			justification: "Acordo comercial com desconto",
		});

		expect(proposalUpdate).toHaveBeenCalledWith({
			where: { id: "prop-1" },
			data: expect.objectContaining({
				justification: "Acordo comercial com desconto",
			}),
		});
		expect(negotiationEventCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					previousValue: 10000,
					newValue: expect.anything(),
				}),
			}),
		);
	});

	it("negociacao sem justificativa e rejeitada", async () => {
		quotationFindFirst.mockResolvedValue(
			makeQuotation({ status: "NEGOCIACAO" }),
		);

		await expect(
			quotationService.negotiate("owner-1", "quote-1", "prop-1", {
				value: 9500,
				justification: "  ",
			}),
		).rejects.toMatchObject({
			code: "INVALID_INPUT",
			status: 400,
		});
		expect(proposalUpdateMany).not.toHaveBeenCalled();
	});

	it("recotacao reabre a etapa sem apagar propostas existentes", async () => {
		quotationFindFirst
			.mockResolvedValueOnce(
				makeQuotation({ status: "NEGOCIACAO", proposals: [makeProposal()] }),
			)
			.mockResolvedValueOnce(
				makeQuotation({ status: "EM_COTACAO", proposals: [makeProposal()] }),
			);

		const result = await quotationService.requote("owner-1", "quote-1");

		expect(quotationUpdate).toHaveBeenCalledWith({
			where: { id: "quote-1" },
			data: { status: "EM_COTACAO" },
		});
		expect(result.proposals).toHaveLength(1);
	});

	it("permite escolher vencedor sem cadastro e nao cria contrato", async () => {
		quotationFindFirst.mockResolvedValue(
			makeQuotation({
				status: "NEGOCIACAO",
				proposals: [makeProposal({ supplierDocument: "12345678000190" })],
			}),
		);
		findSupplierByDocument.mockResolvedValue(null);
		quotationFindFirst
			.mockResolvedValueOnce(
				makeQuotation({
					status: "NEGOCIACAO",
					proposals: [makeProposal({ supplierDocument: "12345678000190" })],
				}),
			)
			.mockResolvedValueOnce(
				makeQuotation({
					status: "ESCOLHIDA",
					proposals: [makeProposal({ isWinner: true })],
				}),
			);

		const result = await quotationService.chooseWinner(
			"owner-1",
			"quote-1",
			"prop-1",
			{
				userId: "user-1",
			},
		);

		expect(result.status).toBe("ESCOLHIDA");
		expect(transaction).toHaveBeenCalledTimes(1);
		expect(createContractWithEffectsInTx).not.toHaveBeenCalled();
		expect(quotationUpdate).toHaveBeenCalledWith({
			where: { id: "quote-1" },
			data: { status: "ESCOLHIDA", contractId: null },
		});
	});

	it("escolha do vencedor delega ao gateway e marca CONTRATADA", async () => {
		// 1a busca (validacao) -> NEGOCIACAO com 2 propostas; get() final ->
		// CONTRATADA com vencedor marcado.
		quotationFindFirst
			.mockResolvedValueOnce(
				makeQuotation({
					status: "NEGOCIACAO",
					startDate: new Date("2026-01-01"),
					endDate: new Date("2026-12-31"),
					proposals: [
						makeProposal({
							id: "prop-1",
							supplierId: "supplier-1",
							supplierName: "A",
							value: 10000,
						}),
						makeProposal({ id: "prop-2", supplierName: "B", value: 11000 }),
					],
				}),
			)
			.mockResolvedValueOnce(
				makeQuotation({
					status: "CONTRATADA",
					contractId: "contract-1",
					proposals: [
						makeProposal({ id: "prop-1", isWinner: true }),
						makeProposal({ id: "prop-2" }),
					],
				}),
			);
		// Somente os servicos selecionados na cotacao sao copiados para o contrato.
		quotationBudgetItemFindMany.mockResolvedValue([
			{
				id: "quotation-item-1",
				budgetItemId: "item-1.1",
				quantity: 10,
				budgetItem: {
					type: "ITEM",
					description: "Servico",
					unit: "m2",
					unitCost: 100,
					totalCost: 1000,
				},
			} as Record<string, unknown>,
		]);
		getSupplierById.mockResolvedValue({ id: "supplier-1" });

		const result = await quotationService.chooseWinner(
			"owner-1",
			"quote-1",
			"prop-1",
			{ userId: "user-1" },
		);

		expect(transaction).toHaveBeenCalledTimes(1);
		expect(createContractWithEffectsInTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				resourceOwnerId: "owner-1",
				actorId: "user-1",
				origin: { type: "QUOTATION", quotationId: "quote-1" },
				services: [
					expect.objectContaining({
						budgetItemId: "item-1.1",
						quantity: 10,
						unitCost: 100,
					}),
				],
			}),
		);
		expect(contractCreate).not.toHaveBeenCalled();
		expect(contractServiceCreate).not.toHaveBeenCalled();
		expect(proposalUpdate).toHaveBeenCalledWith({
			where: { id: "prop-1" },
			data: { isWinner: true },
		});
		expect(quotationUpdate).toHaveBeenCalledWith({
			where: { id: "quote-1" },
			data: { status: "CONTRATADA", contractId: "contract-1" },
		});
		expect(auditLogCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({
				userId: "user-1",
				ownerId: "owner-1",
				action: "APPROVE",
				entityType: "QUOTATION",
				entityId: "quote-1",
			}),
		});
		expect(result.status).toBe("CONTRATADA");
	});

	it("cotacao contratada nao aceita novas propostas", async () => {
		quotationFindFirst.mockResolvedValue(
			makeQuotation({ status: "CONTRATADA" }),
		);

		await expect(
			quotationService.addProposal("owner-1", "quote-1", {
				supplierName: "Novo",
				value: 9000,
			}),
		).rejects.toMatchObject({
			code: "QUOTATION_CLOSED",
			status: 409,
		});
	});
});
