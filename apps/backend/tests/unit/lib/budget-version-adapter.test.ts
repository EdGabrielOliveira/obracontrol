import { beforeEach, describe, expect, it, mock } from "bun:test";
import Decimal from "decimal.js";
import type { ConstructionError } from "../../../src/lib/errors";

const budgetVersionFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const budgetVersionCreate = mock(
	async (args: { data: Record<string, unknown> }) => ({
		id: "version-1",
		...args.data,
	}),
);
const budgetItemIdentityCreate = mock(
	async (args: { data: Record<string, unknown> }) => ({
		id: `identity-${args.data.index}`,
		...args.data,
	}),
);
const budgetItemIdentityUpsert = mock(
	async (args: { create: Record<string, unknown> }) => ({
		id: `identity-${args.create.index}`,
		...args.create,
	}),
);
const budgetVersionItemCreate = mock(
	async (args: { data: Record<string, unknown> }) => ({
		id: `vitem-${args.data.index}`,
		...args.data,
	}),
);
const budgetVersionItemUpdate = mock(async () => ({ id: "vitem-1.1" }));
const constructionWorkFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => ({
		id: "work-1",
		ownerId: "owner-1",
	}),
);
const constructionBudgetItemFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const constructionImportFindFirst = mock(
	async (): Promise<{ id: string } | null> => null,
);
const transactionMock = mock(
	async (callback: (tx: Record<string, unknown>) => Promise<unknown>) =>
		callback({
			budgetVersion: {
				findFirst: budgetVersionFindFirst,
				create: budgetVersionCreate,
				count: budgetVersionCount,
			},
			constructionWork: { findFirst: constructionWorkFindFirst },
			constructionImport: { findFirst: constructionImportFindFirst },
			constructionBudgetItem: { findMany: constructionBudgetItemFindMany },
			budgetItemIdentity: {
				create: budgetItemIdentityCreate,
				upsert: budgetItemIdentityUpsert,
			},
			budgetVersionItem: {
				create: budgetVersionItemCreate,
				update: budgetVersionItemUpdate,
			},
		}),
);

const budgetVersionItemFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const budgetVersionFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const budgetVersionCount = mock(async () => 0);
const budgetVersionItemFindMany = mock(
	async (
		_args: Record<string, unknown>,
	): Promise<Array<Record<string, unknown>>> => [],
);
const budgetVersionFindUnique = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const budgetVersionUpdate = mock(async () => ({}));
const approvalRequestFindUnique = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const approvalRequestCreate = mock(async () => ({
	id: "approval-1",
	status: "PENDING",
}));
const approvalPolicyFindMany = mock(async () => []);
const organizationMembershipFindMany = mock(async () => []);
const costCenterMembershipFindMany = mock(async () => []);
const userFindMany = mock(async () => []);
const notificationFindUnique = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const notificationCreate = mock(async () => ({
	id: "notif-1",
	createdAt: new Date(),
}));
const budgetProjectionStateUpsert = mock(async () => ({}));
const budgetProjectionOutboxUpsert = mock(async () => ({}));

mock.module("../../../src/lib/prisma", () => ({
	prisma: {
		budgetVersion: {
			findFirst: budgetVersionFindFirst,
			findMany: budgetVersionFindMany,
			findUnique: budgetVersionFindUnique,
			count: budgetVersionCount,
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
		organizationMembership: { findMany: organizationMembershipFindMany },
		costCenterMembership: { findMany: costCenterMembershipFindMany },
		user: { findMany: userFindMany },
		notification: {
			create: notificationCreate,
			findUnique: notificationFindUnique,
		},
		budgetProjectionState: { upsert: budgetProjectionStateUpsert },
		budgetProjectionOutbox: { upsert: budgetProjectionOutboxUpsert },
		constructionImport: { findFirst: constructionImportFindFirst },
		$transaction: transactionMock,
	},
}));

mock.module("../../../src/lib/resource-scope", () => ({
	resolveResourceScope: mock(async () => ({
		actorId: "user-1",
		resourceType: "WORK",
		resourceOwnerId: "owner-1",
		path: { organizationId: "org-1", costCenterId: "cc-1", workId: "work-1" },
		role: "OPERADOR",
		canRead: true,
		canWrite: true,
		canAdmin: false,
	})),
	resolvePortfolioScope: mock(async () => ({ actorId: "user-1", paths: [] })),
}));

async function importAdapter() {
	return import("../../../src/lib/budget-version-adapter");
}

describe("budget version adapter", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		constructionImportFindFirst.mockResolvedValue(null);
		budgetVersionFindFirst.mockResolvedValue(null);
		budgetVersionFindUnique.mockResolvedValue(null);
		approvalRequestFindUnique.mockResolvedValue(null);
		approvalPolicyFindMany.mockResolvedValue([]);
		notificationFindUnique.mockResolvedValue(null);
		approvalRequestCreate.mockImplementation(async () => ({
			id: "approval-1",
			status: "PENDING",
		}));
		budgetVersionCreate.mockImplementation(
			async (args: { data: Record<string, unknown> }) => ({
				id: "version-1",
				...args.data,
			}),
		);
		budgetItemIdentityCreate.mockImplementation(
			async (args: { data: Record<string, unknown> }) => ({
				id: `identity-${String(args.data.index)}`,
			}),
		);
		budgetVersionItemCreate.mockImplementation(
			async (args: { data: Record<string, unknown> }) => ({
				id: `vitem-${String(args.data.index)}`,
			}),
		);
		constructionBudgetItemFindMany.mockResolvedValue([
			{
				id: "item-1",
				parentId: null,
				index: "1",
				type: "STAGE",
				description: "Etapa 1",
				unit: null,
				quantity: null,
				unitCost: null,
				totalCost: 0,
				sortOrder: 1,
			},
			{
				id: "item-1.1",
				parentId: "item-1",
				index: "1.1",
				type: "ITEM",
				description: "Servico",
				unit: "m2",
				quantity: 10,
				unitCost: 100,
				totalCost: 1000,
				sortOrder: 2,
			},
		]);
	});

	it("cria a baseline como primeira versao vigente da obra", async () => {
		const { getOrCreateBaselineVersion } = await importAdapter();
		const versionId = await getOrCreateBaselineVersion("user-1", "work-1");

		expect(versionId).toBe("version-1");
		expect(budgetVersionCreate).toHaveBeenCalledWith({
			data: {
				ownerId: "owner-1",
				workId: "work-1",
				versionNumber: 1,
				label: "Baseline",
				status: "VIGENTE",
				isActive: true,
			},
		});
		expect(budgetItemIdentityUpsert).toHaveBeenCalledTimes(2);
		expect(budgetVersionItemCreate).toHaveBeenCalledTimes(2);
	});

	it("usa somente os itens do import ativo ao criar a baseline (itens orfaos de imports anteriores nao colidem)", async () => {
		constructionWorkFindFirst.mockResolvedValue({
			id: "work-1",
			ownerId: "owner-1",
			activeImportId: "import-ativo",
		});
		constructionImportFindFirst.mockResolvedValue({ id: "import-ativo" });
		constructionBudgetItemFindMany.mockResolvedValue([
			{
				id: "item-ativo",
				parentId: null,
				index: "1.1",
				type: "ITEM",
				description: "Servico novo",
				unit: "m2",
				quantity: 10,
				unitCost: 100,
				totalCost: 1000,
				sortOrder: 1,
			},
		]);
		const { getOrCreateBaselineVersion } = await importAdapter();
		const versionId = await getOrCreateBaselineVersion("user-1", "work-1");

		expect(versionId).toBe("version-1");
		expect(constructionBudgetItemFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ importId: "import-ativo" }),
			}),
		);
		expect(budgetItemIdentityUpsert).toHaveBeenCalledTimes(1);
	});

	it("nao recria a baseline quando ela ja existe (imutavel)", async () => {
		budgetVersionFindFirst.mockResolvedValue({ id: "version-existing" });
		const { getOrCreateBaselineVersion } = await importAdapter();
		const versionId = await getOrCreateBaselineVersion("user-1", "work-1");

		expect(versionId).toBe("version-existing");
		expect(budgetVersionCreate).not.toHaveBeenCalled();
	});

	it("resolve a versao vigente no modo EFFECTIVE", async () => {
		budgetVersionFindFirst.mockResolvedValue({ id: "version-active" });
		const { resolveBudgetAnalysisVersion } = await importAdapter();
		const resolved = await resolveBudgetAnalysisVersion("user-1", "work-1", {});

		expect(resolved).toEqual({
			budgetVersionId: "version-active",
			scheduleVersionId: null,
			mode: "EFFECTIVE",
		});
	});

	it("exige versao explicita no modo SELECTED_VERSION", async () => {
		const { resolveBudgetAnalysisVersion } = await importAdapter();
		let error: ConstructionError | undefined;
		try {
			await resolveBudgetAnalysisVersion("user-1", "work-1", {
				mode: "SELECTED_VERSION",
			});
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("SELECTED_VERSION_REQUIRES_BUDGET_VERSION");
		expect(error?.status).toBe(422);
	});

	it("resolve a versao selecionada com cronograma opcional", async () => {
		budgetVersionFindFirst.mockResolvedValue({
			id: "version-2",
			isActive: false,
		});
		const { resolveBudgetAnalysisVersion } = await importAdapter();
		const resolved = await resolveBudgetAnalysisVersion("user-1", "work-1", {
			mode: "SELECTED_VERSION",
			budgetVersionId: "version-2",
			scheduleVersionId: "schedule-2",
		});

		expect(resolved).toEqual({
			budgetVersionId: "version-2",
			scheduleVersionId: "schedule-2",
			mode: "SELECTED_VERSION",
		});
	});

	it("produz referencia canonica de item por indice na versao vigente", async () => {
		budgetVersionFindFirst.mockResolvedValue({ id: "version-active" });
		budgetVersionItemFindFirst.mockResolvedValue({
			id: "vitem-1.1",
			identityId: "identity-1.1",
		});
		const { resolveBudgetItemReference } = await importAdapter();
		const result = await resolveBudgetItemReference("user-1", "work-1", "1.1");

		expect(result).toEqual({
			identityId: "identity-1.1",
			versionItemId: "vitem-1.1",
			versionId: "version-active",
		});
	});

	it("cria aditivo como nova versao em rascunho sem ativar", async () => {
		budgetVersionFindFirst.mockResolvedValue({ id: "version-1" });
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
				totalCost: 0,
				sortOrder: 1,
			},
			{
				id: "vitem-1.1",
				identityId: "identity-1.1",
				parentVersionId: "vitem-1",
				index: "1.1",
				type: "ITEM",
				description: "Servico",
				unit: "m2",
				quantity: 10,
				unitCost: 100,
				totalCost: 1000,
				sortOrder: 2,
			},
		]);
		budgetVersionCount.mockResolvedValue(1);
		budgetVersionCreate.mockImplementation(
			async (args: { data: Record<string, unknown> }) => ({
				id: "version-2",
				...args.data,
			}),
		);
		const { createDraftBudgetVersion } = await importAdapter();
		const result = await createDraftBudgetVersion("user-1", "work-1", {
			label: "Aditivo 1",
			itemOverrides: [{ index: "1.1", totalCost: 1200 }],
		});

		expect(result).toEqual({
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
		expect(budgetVersionCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({
				ownerId: "owner-1",
				workId: "work-1",
				versionNumber: 2,
				label: "Aditivo 1",
				status: "RASCUNHO",
				isActive: false,
				sourceVersionId: "version-1",
				kind: "ACRESCIMO",
			}),
		});
		const createData = (budgetVersionCreate as ReturnType<typeof mock>).mock
			.calls[0][0].data as Record<string, unknown>;
		expect(Number(createData.acrescimoBruto)).toBe(200);
		expect(Number(createData.supressao)).toBe(0);
		expect(Number(createData.impactoLiquido)).toBe(200);
		expect(Number(createData.percentualImpacto)).toBe(20);
		expect(budgetVersionItemCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					index: "1.1",
					totalCost: 1200,
				}),
			}),
		);
	});

	it("calcula impacto usando somente folhas quando a origem tem agregadores", async () => {
		budgetVersionFindFirst.mockResolvedValue({ id: "version-1" });
		budgetVersionItemFindMany.mockResolvedValue([
			{
				id: "vitem-1",
				identityId: "identity-1",
				parentVersionId: null,
				index: "1",
				type: "STAGE",
				description: "Etapa",
				unit: null,
				quantity: null,
				unitCost: null,
				totalCost: 500,
				sortOrder: 1,
			},
			{
				id: "vitem-1.1",
				identityId: "identity-1.1",
				parentVersionId: "vitem-1",
				index: "1.1",
				type: "ITEM",
				description: "Servico",
				unit: "m2",
				quantity: 10,
				unitCost: 50,
				totalCost: 500,
				sortOrder: 2,
			},
		]);
		budgetVersionCount.mockResolvedValue(1);
		budgetVersionCreate.mockImplementation(
			async (args: { data: Record<string, unknown> }) => ({
				id: "version-2",
				versionNumber: 2,
				...args.data,
			}),
		);

		const { createDraftBudgetVersion } = await importAdapter();
		const result = await createDraftBudgetVersion("user-1", "work-1", {
			label: "Aditivo de folha",
			itemOverrides: [{ index: "1.1", totalCost: 600 }],
		});

		expect(result.impactoLiquido).toBe(100);
		expect(result.percentualImpacto).toBe(20);
	});

	it("clona a arvore com indices 1, 1.1 e 1.1.1 preservando o vinculo pai/filho", async () => {
		budgetVersionFindFirst.mockResolvedValue({ id: "version-1" });
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
				totalCost: 0,
				sortOrder: 1,
			},
			{
				id: "vitem-1.1",
				identityId: "identity-1.1",
				parentVersionId: "vitem-1",
				index: "1.1",
				type: "ITEM",
				description: "Sub-etapa",
				unit: null,
				quantity: null,
				unitCost: null,
				totalCost: 500,
				sortOrder: 2,
			},
			{
				id: "vitem-1.1.1",
				identityId: "identity-1.1.1",
				parentVersionId: "vitem-1.1",
				index: "1.1.1",
				type: "ITEM",
				description: "Servico",
				unit: "m2",
				quantity: 10,
				unitCost: 50,
				totalCost: 500,
				sortOrder: 3,
			},
		]);
		budgetVersionCount.mockResolvedValue(1);
		budgetVersionCreate.mockImplementation(
			async (args: { data: Record<string, unknown> }) => ({
				id: "version-2",
				...args.data,
			}),
		);
		const { createDraftBudgetVersion } = await importAdapter();
		await createDraftBudgetVersion("user-1", "work-1", {
			label: "Aditivo 2",
			itemOverrides: [{ index: "1.1", totalCost: 9999 }],
		});

		const createdIndexes = budgetVersionItemCreate.mock.calls.map(
			([call]) => call.data.index,
		);
		expect(createdIndexes).toEqual(["1", "1.1", "1.1.1"]);
		expect(budgetVersionItemUpdate).toHaveBeenCalledTimes(2);
	});

	it("cria snapshot sem copiar item removido e persiste impacto misto", async () => {
		budgetVersionFindFirst.mockResolvedValue({
			id: "version-1",
			ownerId: "owner-1",
			workId: "work-1",
			isActive: true,
			items: [
				{
					id: "vitem-1",
					identityId: "identity-1",
					index: "1",
					parentVersionId: null,
				},
				{
					id: "vitem-1.1",
					identityId: "identity-1.1",
					index: "1.1",
					parentVersionId: "vitem-1",
				},
				{
					id: "vitem-1.2",
					identityId: "identity-1.2",
					index: "1.2",
					parentVersionId: "vitem-1",
				},
			],
		});
		budgetVersionCount.mockResolvedValue(1);
		budgetVersionCreate.mockImplementation(
			async (args: { data: Record<string, unknown> }) => ({
				id: "version-2",
				versionNumber: 2,
				...args.data,
			}),
		);

		const { createDraftBudgetVersionFromSnapshot } = await importAdapter();
		const result = await createDraftBudgetVersionFromSnapshot(
			"user-1",
			"work-1",
			{
				label: "Aditivo 1",
				sourceVersionId: "version-1",
				items: [
					{
						index: "1",
						parentIndex: null,
						type: "STAGE",
						description: "Etapa 1",
						unit: null,
						quantity: null,
						unitCost: null,
						totalCost: new Decimal(0),
						plannedStart: null,
						plannedEnd: null,
					},
					{
						index: "1.1",
						parentIndex: "1",
						type: "ITEM",
						description: "Servico",
						unit: "m2",
						quantity: new Decimal(10),
						unitCost: new Decimal(70),
						totalCost: new Decimal(700),
						plannedStart: null,
						plannedEnd: null,
					},
				],
				impact: {
					grossIncrease: new Decimal(200),
					suppression: new Decimal(500),
					netImpact: new Decimal(-300),
					impactPercent: new Decimal(-30),
				},
			},
		);

		expect(result).toMatchObject({
			version: 2,
			sourceVersionId: "version-1",
			acrescimoBruto: 200,
			supressao: 500,
			impactoLiquido: -300,
			percentualImpacto: -30,
		});
		expect(
			(budgetVersionItemCreate as ReturnType<typeof mock>).mock.calls.map(
				([call]) => (call as { data: { index: string } }).data.index,
			),
		).toEqual(["1", "1.1"]);
	});

	it("serializes a submitted version as pending approval", async () => {
		budgetVersionFindMany.mockResolvedValue([
			{
				id: "version-2",
				versionNumber: 2,
				label: "Aditivo 1",
				status: "RASCUNHO",
				isActive: false,
				sourceVersionId: "version-1",
				approvalRequestId: "approval-1",
				submittedAt: new Date(),
				reason: null,
				kind: null,
				acrescimoBruto: null,
				supressao: null,
				impactoLiquido: null,
				percentualImpacto: null,
			},
		]);

		const { listBudgetVersions } = await importAdapter();
		const [summary] = await listBudgetVersions("user-1", "work-1");

		expect(summary.status).toBe("PENDING_APPROVAL");
		expect(summary.approvalRequestId).toBe("approval-1");
	});

	it("persiste datas de cronograma do candidato e vincula o import na versao", async () => {
		budgetVersionFindFirst.mockResolvedValue({
			id: "version-1",
			ownerId: "owner-1",
			workId: "work-1",
			isActive: true,
			items: [
				{
					id: "vitem-1.1",
					identityId: "identity-1.1",
					index: "1.1",
					parentVersionId: null,
					plannedStart: new Date("2026-08-01T00:00:00.000Z"),
					plannedEnd: new Date("2026-08-10T00:00:00.000Z"),
				},
			],
		});
		budgetVersionCount.mockResolvedValue(1);
		budgetVersionCreate.mockImplementation(
			async (args: { data: Record<string, unknown> }) => ({
				id: "version-2",
				versionNumber: 2,
				...args.data,
			}),
		);

		const { createDraftBudgetVersionFromSnapshot } = await importAdapter();
		await createDraftBudgetVersionFromSnapshot("user-1", "work-1", {
			label: "Aditivo cronograma",
			sourceVersionId: "version-1",
			budgetImportId: "import-1",
			items: [
				{
					index: "1.1",
					parentIndex: null,
					type: "ITEM",
					description: "Servico",
					unit: null,
					quantity: new Decimal(10),
					unitCost: new Decimal(70),
					totalCost: new Decimal(700),
					plannedStart: new Date("2026-08-01T00:00:00.000Z"),
					plannedEnd: new Date("2026-08-12T00:00:00.000Z"),
				},
			],
			impact: {
				grossIncrease: new Decimal(0),
				suppression: new Decimal(0),
				netImpact: new Decimal(0),
				impactPercent: new Decimal(0),
			},
		});

		const itemCall = (budgetVersionItemCreate as ReturnType<typeof mock>).mock
			.calls[0][0] as {
			data: { index: string; plannedEnd: Date | null };
		};
		expect(itemCall.data.index).toBe("1.1");
		expect(itemCall.data.plannedEnd).toEqual(
			new Date("2026-08-12T00:00:00.000Z"),
		);

		const versionCall = (budgetVersionCreate as ReturnType<typeof mock>).mock
			.calls[0][0] as { data: { budgetImportId: string } };
		expect(versionCall.data.budgetImportId).toBe("import-1");
	});

	it("nao altera a versao de origem ao aplicar overrides no aditivo", async () => {
		budgetVersionFindFirst.mockResolvedValue({ id: "version-1" });
		budgetVersionItemFindMany.mockResolvedValue([
			{
				id: "vitem-1.1",
				identityId: "identity-1.1",
				parentVersionId: null,
				index: "1.1",
				type: "ITEM",
				description: "Servico",
				unit: "m2",
				quantity: 10,
				unitCost: 100,
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
		const { createDraftBudgetVersion } = await importAdapter();
		await createDraftBudgetVersion("user-1", "work-1", {
			label: "Aditivo 1",
			itemOverrides: [{ index: "1.1", totalCost: 9999 }],
		});

		const sourceCall = budgetVersionItemFindMany.mock.calls[0][0];
		expect(sourceCall).toEqual(
			expect.objectContaining({
				where: { versionId: "version-1" },
			}),
		);
		expect(budgetVersionItemUpdate).not.toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: "vitem-1.1" } }),
		);
	});

	it("cria novas etapas e itens no aditivo preservando o vinculo pai/filho", async () => {
		budgetVersionFindFirst.mockResolvedValue({ id: "version-1" });
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
				totalCost: 0,
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
		budgetItemIdentityCreate.mockImplementation(
			async (args: { data: Record<string, unknown> }) => ({
				id: `identity-novo-${args.data.index}`,
				...args.data,
			}),
		);
		const { createDraftBudgetVersion } = await importAdapter();

		await createDraftBudgetVersion("user-1", "work-1", {
			label: "Aditivo com etapa nova",
			newItems: [
				{
					index: "2",
					type: "STAGE",
					description: "Etapa 2",
				},
				{
					index: "2.1",
					parentIndex: "2",
					type: "ITEM",
					description: "Servico 2",
					unit: "m2",
					quantity: 5,
					unitCost: 10,
				},
			],
		});

		expect(budgetItemIdentityCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ index: "2", workId: "work-1" }),
			}),
		);
		expect(budgetItemIdentityCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ index: "2.1", workId: "work-1" }),
			}),
		);
		const createdNew = budgetVersionItemCreate.mock.calls
			.filter(([call]) => String(call.data.index).startsWith("2"))
			.map(([call]) => call.data);
		expect(createdNew.map((data) => data.index)).toEqual(["2", "2.1"]);
		expect(createdNew.find((data) => data.index === "2")?.identityId).toBe(
			"identity-novo-2",
		);
		expect(createdNew.find((data) => data.index === "2.1")?.totalCost).toBe(50);
	});

	it("rejeita item novo com indice ja existente na origem", async () => {
		budgetVersionFindFirst.mockResolvedValue({ id: "version-1" });
		budgetVersionItemFindMany.mockResolvedValue([
			{
				id: "vitem-1.1",
				identityId: "identity-1.1",
				parentVersionId: null,
				index: "1.1",
				type: "ITEM",
				description: "Servico",
				unit: "m2",
				quantity: 10,
				unitCost: 100,
				totalCost: 1000,
				sortOrder: 1,
			},
		]);
		const { createDraftBudgetVersion } = await importAdapter();

		let error: ConstructionError | undefined;
		try {
			await createDraftBudgetVersion("user-1", "work-1", {
				label: "Aditivo invalido",
				newItems: [
					{
						index: "1.1",
						type: "ITEM",
						description: "Duplicado",
					},
				],
			});
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("DUPLICATE_BUDGET_INDEX");
		expect(error?.status).toBe(422);
		expect(budgetVersionCreate).not.toHaveBeenCalled();
	});

	it("rejeita item novo com parentIndex inexistente", async () => {
		budgetVersionFindFirst.mockResolvedValue({ id: "version-1" });
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
				totalCost: 0,
				sortOrder: 1,
			},
		]);
		const { createDraftBudgetVersion } = await importAdapter();

		let error: ConstructionError | undefined;
		try {
			await createDraftBudgetVersion("user-1", "work-1", {
				label: "Aditivo invalido",
				newItems: [
					{
						index: "2.1",
						parentIndex: "9.9",
						type: "ITEM",
						description: "Sem pai",
					},
				],
			});
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("INVALID_PARENT_INDEX");
		expect(error?.status).toBe(422);
		expect(budgetVersionCreate).not.toHaveBeenCalled();
	});

	it("rejeita versao duplicada por label", async () => {
		budgetVersionFindFirst.mockResolvedValue({ id: "version-1" });
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
				totalCost: 0,
				sortOrder: 1,
			},
		]);
		budgetVersionCount.mockResolvedValue(1);
		budgetVersionCreate.mockImplementation(async () => {
			throw { code: "P2002" };
		});
		const { createDraftBudgetVersion } = await importAdapter();

		let error: ConstructionError | undefined;
		try {
			await createDraftBudgetVersion("user-1", "work-1", {
				label: "Aditivo 1",
				itemOverrides: [{ index: "1.1", totalCost: 9999 }],
			});
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("DUPLICATE_BUDGET_VERSION");
		expect(error?.status).toBe(409);
	});

	it("lista o historico ordenado com status mapeado e estado de ativacao", async () => {
		budgetVersionFindMany.mockResolvedValue([
			{
				id: "version-1",
				versionNumber: 1,
				label: "Baseline",
				status: "VIGENTE",
				isActive: true,
				sourceVersionId: null,
				approvalRequestId: null,
				submittedAt: null,
				reason: null,
				kind: null,
				acrescimoBruto: null,
				supressao: null,
				impactoLiquido: null,
				percentualImpacto: null,
			},
			{
				id: "version-2",
				versionNumber: 2,
				label: "Aditivo 1",
				status: "RASCUNHO",
				isActive: false,
				sourceVersionId: "version-1",
				approvalRequestId: "approval-1",
				submittedAt: new Date("2026-08-05T10:00:00Z"),
				reason: "Aditivo de servicos",
				kind: "ACRESCIMO",
				acrescimoBruto: 200,
				supressao: 0,
				impactoLiquido: 200,
				percentualImpacto: 20,
			},
		]);
		const { listBudgetVersions } = await importAdapter();
		const result = await listBudgetVersions("user-1", "work-1");

		expect(budgetVersionFindMany).toHaveBeenCalledWith({
			where: { workId: "work-1" },
			orderBy: { versionNumber: "asc" },
		});
		expect(result).toEqual([
			{
				id: "version-1",
				index: "1",
				version: 1,
				label: "Baseline",
				status: "ACTIVE",
				isActive: true,
				sourceVersionId: null,
				approvalRequestId: null,
				submittedAt: null,
				reason: null,
				kind: null,
				acrescimoBruto: null,
				supressao: null,
				impactoLiquido: null,
				percentualImpacto: null,
			},
			{
				id: "version-2",
				index: "2",
				version: 2,
				label: "Aditivo 1",
				status: "PENDING_APPROVAL",
				isActive: false,
				sourceVersionId: "version-1",
				approvalRequestId: "approval-1",
				submittedAt: "2026-08-05T10:00:00.000Z",
				reason: "Aditivo de servicos",
				kind: "ACRESCIMO",
				acrescimoBruto: 200,
				supressao: 0,
				impactoLiquido: 200,
				percentualImpacto: 20,
			},
		]);
	});

	it("retorna o detalhe da versao com itens e totais capturados", async () => {
		budgetVersionFindUnique.mockResolvedValue({
			id: "version-1",
			workId: "work-1",
			versionNumber: 1,
			label: "Baseline",
			status: "VIGENTE",
			isActive: true,
			sourceVersionId: null,
			approvalRequestId: null,
			submittedAt: null,
			reason: null,
			kind: null,
			acrescimoBruto: null,
			supressao: null,
			impactoLiquido: null,
			percentualImpacto: null,
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
				totalCost: 0,
				sortOrder: 1,
			},
			{
				id: "vitem-1.1",
				identityId: "identity-1.1",
				parentVersionId: "vitem-1",
				index: "1.1",
				type: "ITEM",
				description: "Servico",
				unit: "m2",
				quantity: 10,
				unitCost: 100,
				totalCost: 1000,
				sortOrder: 2,
			},
		]);
		const { getBudgetVersion } = await importAdapter();
		const result = await getBudgetVersion("user-1", "work-1", "version-1");

		expect(result).toEqual({
			id: "version-1",
			index: "1",
			version: 1,
			label: "Baseline",
			status: "ACTIVE",
			isActive: true,
			sourceVersionId: null,
			approvalRequestId: null,
			submittedAt: null,
			reason: null,
			kind: null,
			acrescimoBruto: null,
			supressao: null,
			impactoLiquido: null,
			percentualImpacto: null,
			totals: { totalCost: 1000 },
			items: [
				{
					id: "vitem-1",
					index: "1",
					type: "STAGE",
					description: "Etapa 1",
					unit: null,
					quantity: null,
					unitCost: null,
					totalCost: 0,
					plannedStart: null,
					plannedEnd: null,
					parentIndex: null,
					sortOrder: 1,
				},
				{
					id: "vitem-1.1",
					index: "1.1",
					type: "ITEM",
					description: "Servico",
					unit: "m2",
					quantity: 10,
					unitCost: 100,
					totalCost: 1000,
					plannedStart: null,
					plannedEnd: null,
					parentIndex: "1",
					sortOrder: 2,
				},
			],
		});
	});

	it("submete rascunho para aprovacao e grava metadados", async () => {
		budgetVersionFindUnique.mockResolvedValue({
			id: "version-2",
			workId: "work-1",
			versionNumber: 2,
			label: "Aditivo 1",
			status: "RASCUNHO",
			isActive: false,
			approvalRequestId: null,
		});
		const { submitBudgetVersion } = await importAdapter();
		const result = await submitBudgetVersion("user-1", "work-1", "version-2", {
			reason: "Aditivo de servicos",
		});

		expect(approvalRequestCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					resourceType: "BUDGET_VERSION",
					resourceId: "work-1",
					effectAction: "BUDGET_VERSION_ACTIVATE",
					payloadJson: { workId: "work-1", budgetVersionId: "version-2" },
					expectedVersion: 2,
					idempotencyKey: "budget-version-submit:version-2",
					status: "PENDING",
				}),
			}),
		);
		expect(budgetVersionUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: "version-2" },
				data: expect.objectContaining({
					approvalRequestId: "approval-1",
					reason: "Aditivo de servicos",
					submittedAt: expect.any(Date),
				}),
			}),
		);
		expect(result).toEqual({
			budgetVersionId: "version-2",
			status: "PENDING",
			approvalRequestId: "approval-1",
		});
	});

	it("rejeita submissao de versao ja ativa", async () => {
		budgetVersionFindUnique.mockResolvedValue({
			id: "version-1",
			workId: "work-1",
			status: "VIGENTE",
			isActive: true,
			approvalRequestId: null,
		});
		const { submitBudgetVersion } = await importAdapter();

		let error: ConstructionError | undefined;
		try {
			await submitBudgetVersion("user-1", "work-1", "version-1", {});
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("BUDGET_VERSION_ACTIVE");
		expect(error?.status).toBe(422);
		expect(approvalRequestCreate).not.toHaveBeenCalled();
	});

	it("rejeita submissao de versao recusada", async () => {
		budgetVersionFindUnique.mockResolvedValue({
			id: "version-2",
			workId: "work-1",
			status: "RECUSADO",
			isActive: false,
			approvalRequestId: "approval-1",
		});
		const { submitBudgetVersion } = await importAdapter();

		let error: ConstructionError | undefined;
		try {
			await submitBudgetVersion("user-1", "work-1", "version-2", {});
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("BUDGET_VERSION_REJECTED");
		expect(error?.status).toBe(422);
		expect(approvalRequestCreate).not.toHaveBeenCalled();
	});

	it("rejeita submissao duplicada de um rascunho ja enviado", async () => {
		budgetVersionFindUnique.mockResolvedValue({
			id: "version-2",
			workId: "work-1",
			status: "RASCUNHO",
			isActive: false,
			approvalRequestId: "approval-1",
		});
		const { submitBudgetVersion } = await importAdapter();

		let error: ConstructionError | undefined;
		try {
			await submitBudgetVersion("user-1", "work-1", "version-2", {});
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("BUDGET_VERSION_ALREADY_SUBMITTED");
		expect(error?.status).toBe(409);
		expect(approvalRequestCreate).not.toHaveBeenCalled();
	});
});

describe("ORC-004 (DEC-007) aditivo formal: tipo e impacto", () => {
	async function draftWith(items: unknown[], overrides: unknown[]) {
		budgetVersionFindFirst.mockResolvedValue({ id: "version-1" });
		budgetVersionItemFindMany.mockResolvedValue(items as never[]);
		budgetVersionCount.mockResolvedValue(1);
		budgetVersionCreate.mockImplementation(
			async (args: { data: Record<string, unknown> }) => ({
				id: "version-2",
				versionNumber: 2,
				...args.data,
			}),
		);
		budgetItemIdentityCreate.mockImplementation(
			async (args: { data: Record<string, unknown> }) => ({
				id: `identity-${args.data.index}`,
				...args.data,
			}),
		);
		budgetVersionItemCreate.mockImplementation(
			async (args: { data: Record<string, unknown> }) => ({
				id: `vitem-${String(args.data.index)}`,
				...args.data,
			}),
		);
		const { createDraftBudgetVersion } = await importAdapter();
		return createDraftBudgetVersion("user-1", "work-1", {
			label: "Aditivo",
			itemOverrides: overrides as never[],
		});
	}

	const item1000 = {
		id: "vitem-1",
		identityId: "identity-1",
		parentVersionId: null,
		index: "1.1",
		type: "ITEM",
		description: "Servico",
		unit: "m2",
		quantity: 10,
		unitCost: 100,
		totalCost: 1000,
		sortOrder: 1,
	};

	it("supressao: override abaixo do total deriva SUPRESSAO e impacto negativo", async () => {
		const result = await draftWith(
			[item1000],
			[{ index: "1.1", totalCost: 600 }],
		);

		expect(result.kind).toBe("SUPRESSAO");
		expect(result.acrescimoBruto).toBe(0);
		expect(result.supressao).toBe(400);
		expect(result.impactoLiquido).toBe(-400);
		expect(result.percentualImpacto).toBe(-40);
	});

	it("ORC-005 (DEC-008): aditivo global sem itens e proibido (422)", async () => {
		await expect(draftWith([item1000], [])).rejects.toMatchObject({
			code: "GLOBAL_AMENDMENT_FORBIDDEN",
			status: 422,
			message:
				"Aditivo deve alterar itens especificos do orcamento (aditivo global nao e permitido)",
		});
	});
});
