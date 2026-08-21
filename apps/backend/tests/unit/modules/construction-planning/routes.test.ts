import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { ConstructionError } from "../../../../src/lib/errors";
import { buildWorkMetricsSnapshot } from "../../../../src/modules/construction-planning/bi/work-metrics-snapshot";

const TEST_CC_ID = "cc-1";
const TEST_ORG_ID = "org-1";

const getSessionUser = mock(async () => ({ id: "owner-1", role: "GERENTE" }));
const getAllWorksWithItems = mock(async () => []);
const getWorkWithItems = mock(
	async (_ownerId: string, _workId: string) => null,
);
const findWorkByOwnerAndCode = mock(async () => null);
const createWorkWithImport = mock(async () => ({
	workId: "work-1",
	importId: "import-1",
	importedSections: ["Obra", "Orcamento", "Medicoes"],
}));
const replaceWorkWithImport = mock(async () => ({
	workId: "work-existing",
	importId: "import-replacement",
	importedSections: ["Obra", "Orcamento", "Medicoes"],
}));
const replaceBudgetWithImport = mock(async () => ({
	workId: "work-existing",
	importId: "import-replacement",
}));
const existingBudgetIndexes = mock(
	async (
		_ctx: { ownerId: string; workId: string | null },
		indexes: string[],
	) => {
		void _ctx;
		void indexes;
		return new Set<string>();
	},
);
const existingScheduleIndexes = mock(
	async (
		_ctx: { ownerId: string; workId: string | null },
		indexes: string[],
	) => {
		void _ctx;
		void indexes;
		return new Set<string>();
	},
);
const listWorks = mock(async () => ({
	data: [],
	currentPage: 1,
	nextPage: null,
	previousPage: null,
	pageCount: 0,
	totalCount: 0,
	isLastPage: true,
	isFirstPage: true,
}));
const getWorkById = mock(async () => ({
	id: "work-1",
	ownerId: "owner-1",
	code: "OBRA-001",
}));
const listSelectableImportRowIds = mock(
	async (): Promise<string[] | null> => ["row-1", "row-2"],
);
const getWorkOrThrow = mock(async () => ({
	id: "work-1",
	ownerId: "owner-1",
	code: "OBRA-001",
}));
const createWorkManual = mock(async () => ({
	id: "work-created",
	ownerId: "owner-1",
	code: "OBRA-NEW",
	name: "Obra Nova",
}));
const updateWork = mock(async () => ({
	id: "work-1",
	ownerId: "owner-1",
	name: "Obra Atualizada",
}));
const deleteWork = mock(async () => {});
const createMeasurement = mock(async () => ({
	id: "measurement-1",
	workId: "work-1",
}));
const listMeasurements = mock(async () => [
	{ id: "measurement-1", workId: "work-1" },
]);
const deleteMeasurement = mock(async () => ({
	id: "measurement-1",
	workId: "work-1",
}));
const workMeasurementCreate = mock(async () => ({
	id: "measurement-1",
	workId: "work-1",
}));
const workMeasurementList = mock(async () => [
	{ id: "measurement-1", workId: "work-1" },
]);
const workMeasurementDelete = mock(async () => undefined);
const createActualCost = mock(async () => ({
	id: "cost-1",
	workId: "work-1",
	amount: 123,
}));
const listActualCosts = mock(async () => [
	{ id: "cost-1", workId: "work-1", amount: 123 },
]);
const deleteActualCost = mock(async () => ({ id: "cost-1", workId: "work-1" }));
const getCostCenterByIdOnly = mock(
	async (): Promise<{ id: string } | null> => ({ id: "cc-test" }),
);
const parseWorkbook = mock(() => makeWorkbook());
const parseWorkbookByKind = mock(
	(_bytes: Uint8Array, fileName: string, kind: string) => {
		const base = makeWorkbook();
		if (fileName === "parcial.xlsx") {
			return {
				...base,
				budgetRows: [
					{
						rowNumber: 2,
						index: "1",
						type: "Item",
						description: "Escavacao",
						unit: "m3",
						quantity: 10,
						laborUnitCost: 20,
						materialUnitCost: 30,
						equipmentUnitCost: 5,
						otherUnitCost: 2,
						providedStatus: "Ativo",
					},
					{
						rowNumber: 3,
						index: "2",
						type: null,
						description: "Pintura",
						unit: "m2",
						quantity: 10,
						laborUnitCost: 10,
						materialUnitCost: 10,
						equipmentUnitCost: 0,
						otherUnitCost: 0,
						providedStatus: null,
					},
				],
			};
		}
		switch (kind) {
			case "cronograma":
				return {
					...base,
					budgetRows: [],
					baselineRows: [
						{
							rowNumber: 2,
							index: "1",
							plannedStart: "2026-01-01",
							plannedEnd: "2026-01-31",
							plannedWeight: null,
						},
					],
					replanningRows: [],
					measurementRows: [],
					contractRows: [],
					serviceRows: [],
					contractMeasurementRows: [],
					paymentRows: [],
					actualCostRows: [],
				};
			case "medicao-obra":
				return {
					...base,
					budgetRows: [],
					baselineRows: [],
					replanningRows: [],
					contractRows: [],
					serviceRows: [],
					contractMeasurementRows: [],
					paymentRows: [],
					actualCostRows: [],
				};
			case "custos":
				return {
					...base,
					budgetRows: [],
					baselineRows: [],
					replanningRows: [],
					measurementRows: [],
					contractRows: [],
					serviceRows: [],
					contractMeasurementRows: [],
					paymentRows: [],
				};
			case "medicao-contrato":
				return {
					...base,
					budgetRows: [],
					baselineRows: [],
					replanningRows: [],
					measurementRows: [],
					actualCostRows: [],
					sheetNames: [
						"Guia",
						"Contrato",
						"Servicos",
						"Medicoes Contrato",
						"Pagamentos",
					],
					contractRows: [
						{
							rowNumber: 2,
							code: "C-001",
							supplierName: "Fornecedor A",
							contractValue: 50000,
							serviceType: "Servico",
							title: "Contrato 1",
							startDate: "2026-01-01",
							endDate: "2026-12-31",
							status: "Ativo",
							notes: null,
						},
					],
					serviceRows: [
						{
							rowNumber: 2,
							index: "1",
							type: "ITEM",
							description: "Servico A",
							unit: "m2",
							quantity: 10,
							unitCost: 100,
							totalCost: 1000,
						},
					],
					contractMeasurementRows: [
						{
							rowNumber: 2,
							number: "1",
							date: "2026-01-15",
							title: "Medicao 1",
							status: "APROVADA",
							discountValue: null,
							retentionValue: null,
							notes: null,
						},
					],
					paymentRows: [
						{
							rowNumber: 2,
							date: "2026-01-20",
							value: 10000,
							paidValue: 10000,
							description: "Pagamento 1",
							retentionValue: null,
							discountValue: null,
							status: "PAGO",
						},
					],
				};
			default:
				return base;
		}
	},
);

const txContractCreate = mock(
	async (args: { data?: Record<string, unknown> }) => ({
		id: "contract-created",
		...(args.data ?? {}),
	}),
);
const txContractFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => ({
		id: "contract-1",
		ownerId: "owner-1",
		workId: "work-1",
		code: "C-001",
	}),
);
const txBudgetItemFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => ({
		id: "budget-item-1",
		ownerId: "owner-1",
		workId: "work-1",
		index: "1.1",
		type: "ITEM",
		description: "Item A",
		unit: "m2",
	}),
);
const txServiceCreate = mock(
	async (_args: { data?: Record<string, unknown> }) => ({
		id: "service-1",
	}),
);
const txMeasurementFindFirst = mock(async () => null);
const txContractFindMany = mock(
	async (): Promise<Array<{ code: string }>> => [],
);
const txMeasurementCreate = mock(
	async (args: { data?: Record<string, unknown> }) => ({
		id: "measurement-imported",
		...(args.data ?? {}),
	}),
);
const txItemCreateMany = mock(async () => ({ count: 1 }));
const txPaymentCreate = mock(
	async (args: { data?: Record<string, unknown> }) => ({
		id: "payment-imported",
		...(args.data ?? {}),
	}),
);
const transaction = mock(async (fn: (tx: never) => Promise<unknown>) =>
	fn({
		contract: {
			create: txContractCreate,
			findMany: txContractFindMany,
			findFirst: txContractFindFirst,
		},
		constructionBudgetItem: { findFirst: txBudgetItemFindFirst },
		contractService: { create: txServiceCreate },
		contractMeasurement: {
			create: txMeasurementCreate,
			findFirst: txMeasurementFindFirst,
		},
		contractMeasurementItem: { createMany: txItemCreateMany },
		contractPayment: { create: txPaymentCreate },
	} as never),
);

mock.module("../../../../src/lib/auth-middleware", () => ({
	getSessionUser,
}));

mock.module("../../../../src/modules/construction-planning/repository", () => ({
	createActualCost,
	createMeasurement,
	createWorkManual,
	deleteActualCost,
	deleteMeasurement,
	deleteWork,
	findWorkByOwnerAndCode,
	createWorkWithImport,
	getWorkOrThrow,
	getWorkById,
	replaceWorkWithImport,
	getAllWorksWithItems,
	getWorkWithItems,
	getWorkMeasurementsForBI: mock(async () => []),
	getWorkMeasurementsForManyWorks: mock(async () => new Map()),
	listActualCosts,
	listMeasurements,
	listWorks,
	updateWork,
}));

mock.module(
	"../../../../src/modules/construction-planning/imports/import-batch.repository",
	() => ({
		listSelectableImportRowIds,
	}),
);

mock.module(
	"../../../../src/modules/construction-planning/work-measurement.service",
	() => ({
		workMeasurementService: {
			create: workMeasurementCreate,
			list: workMeasurementList,
			delete: workMeasurementDelete,
			get: mock(async () => null),
			getMap: mock(async () => []),
			getReports: mock(async () => []),
			getSummary: mock(async () => ({})),
			getReport: mock(async () => null),
		},
	}),
);

mock.module(
	"../../../../src/modules/construction-planning/imports/import-repository",
	() => ({
		findWorkByOwnerAndCode,
		createWorkWithImport,
		replaceWorkWithImport,
		replaceBudgetWithImport,
		existingBudgetIndexes,
		existingScheduleIndexes,
		getImportById: mock(async () => null),
		listImports: mock(async () => ({
			data: [],
			total: 0,
			page: 1,
			limit: 10,
			totalPages: 0,
			hasNextPage: false,
			hasPreviousPage: false,
		})),
	}),
);

mock.module(
	"../../../../src/modules/construction-planning/imports/parser",
	() => ({
		parseWorkbook,
		parseWorkbookByKind,
		REQUIRED_SHEETS: [
			{ displayName: "Obra", aliases: ["Obra"] },
			{ displayName: "Orcamento", aliases: ["Orcamento", "Orçamento"] },
			{ displayName: "Cronograma Original", aliases: ["Cronograma Original"] },
			{ displayName: "Replanejamento", aliases: ["Replanejamento"] },
			{
				displayName: "Medicoes",
				aliases: ["Medicoes Obra", "Medicoes", "Medições"],
			},
			{ displayName: "Custos Realizados", aliases: ["Custos Realizados"] },
		],
		SHEET_NAME_ALIASES: {},
		findSheetMap: mock(() => new Map()),
	}),
);

mock.module("../../../../src/modules/organizations/repository", () => ({
	getCostCenterByIdOnly,
}));

mock.module(
	"../../../../src/modules/construction-planning/governance-guard",
	() => ({
		budgetGovernanceGuard: { assertWritable: mock(async () => undefined) },
		constructionGovernanceGuard: {
			assertWritable: mock(async () => undefined),
		},
		assertNoPendingEffect: mock(async () => undefined),
	}),
);

mock.module("../governance-guard", () => ({
	budgetGovernanceGuard: { assertWritable: mock(async () => undefined) },
	constructionGovernanceGuard: { assertWritable: mock(async () => undefined) },
	assertNoPendingEffect: mock(async () => undefined),
}));

mock.module("../contract-governance-scope", () => ({
	contractGovernanceScope: {
		getWorkId: mock(async () => "work-1"),
	},
}));

// resolver fake LIVE-only construido sobre os mocks de obra.
const metricResolverResolve = mock(
	async (request: { ownerId: string; workId: string; asOfDate?: Date }) => {
		const work = await getWorkWithItems(request.ownerId, request.workId);
		if (!work) {
			throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
		}
		const snapshot = buildWorkMetricsSnapshot({
			work: work as never,
			asOf: request.asOfDate,
		});
		return {
			mode: "LIVE",
			ownerId: request.ownerId,
			workId: request.workId,
			snapshotId: null,
			version: null,
			fingerprint: "live",
			asOfDate: snapshot.metrics.dataDate,
			input: snapshot.input,
			metrics: snapshot.metrics,
			manualMeasurements: snapshot.manualMeasurements,
			series: { points: [] },
			contracts: [],
			quality: { missing: 0, invalid: 0, unlinked: 0, duplicated: 0, stale: 0 },
			snapshot: null,
		};
	},
);

mock.module(
	"../../../../src/modules/construction-planning/bi/metric-source-resolver",
	() => ({
		MetricSourceResolver: class {
			async resolve(request: never) {
				return metricResolverResolve(request);
			}
		},
		metricSourceResolver: { resolve: metricResolverResolve },
		resolveMetricSource: metricResolverResolve,
	}),
);

const auditLogFindMany = mock(async () => [
	{
		id: "audit-1",
		ownerId: "owner-1",
		userId: "owner-1",
		action: "CREATE",
		entityType: "BI_SNAPSHOT",
		entityId: "snap-1",
		entityDescription: "work-1:CURRENT:v1",
		createdAt: new Date("2026-06-01T00:00:00.000Z"),
		user: { id: "owner-1", name: "Owner", email: "owner@test.com" },
	},
]);
const auditLogCount = mock(async () => 1);

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		$transaction: transaction,
		user: {
			findUnique: mock(async () => ({ role: "GERENTE" })),
		},
		auditLog: {
			create: mock(async () => ({ id: "audit-1" })),
			findMany: auditLogFindMany,
			count: auditLogCount,
		},
		constructionWork: {
			findUnique: mock(async () => ({
				id: "work-1",
				ownerId: "owner-1",
				code: "OBRA-001",
				name: "Obra Teste",
				costCenterId: "cc-1",
			})),
		},
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
		constructionMeasurement: {
			findUnique: mock(async () => ({
				id: "measurement-1",
				index: "1",
				title: "Medicao Teste",
			})),
		},
		workMeasurement: {
			findUnique: mock(async () => ({
				id: "measurement-1",
				number: 1,
				title: "Medicao Teste",
			})),
		},
		constructionActualCost: {
			findUnique: mock(async () => ({
				id: "cost-1",
				category: "MATERIAL",
				description: "Custo Teste",
			})),
		},
	},
}));

function makeWorkbook() {
	return {
		fileName: "unificado.xlsx",
		sheetName: "Obra",
		header: {
			workCode: "LEGACY-CODE",
			workName: "Legacy Name",
			plannedStart: null,
			plannedEnd: null,
			baseDate: null,
		},
		work: {
			code: "OBRA-001",
			name: "Edificio Horizonte",
			clientName: "Cliente A",
			baseDate: "2026-01-15",
			plannedStart: "2026-01-01",
			plannedEnd: "2026-12-31",
		},
		budgetRows: [
			{
				rowNumber: 2,
				index: "1",
				type: "Item",
				description: "Escavacao",
				unit: "m3",
				quantity: 10,
				laborUnitCost: 20,
				materialUnitCost: 30,
				equipmentUnitCost: 5,
				otherUnitCost: 2,
				providedStatus: "Ativo",
			},
		],
		itensRows: [],
		baselineRows: [
			{
				rowNumber: 2,
				index: "1",
				plannedStart: "2026-01-01",
				plannedEnd: "2026-01-31",
				plannedWeight: null,
			},
		],
		replanningRows: [
			{
				rowNumber: 2,
				index: "1",
				version: "R1",
				replannedStart: "2026-01-05",
				replannedEnd: "2026-02-05",
				revisionDate: "2026-01-10",
				reason: "Chuva",
			},
		],
		measurementRows: [
			{
				rowNumber: 2,
				index: "1",
				measurementDate: "2026-01-15",
				measuredPercentageAccumulated: 0.5,
				measuredQuantityAccumulated: 5,
				notes: "Parcial",
			},
		],
		contractRows: [],
		serviceRows: [],
		contractMeasurementRows: [],
		paymentRows: [],
		actualCostRows: [
			{
				rowNumber: 2,
				costDate: "2026-01-20",
				budgetIndex: "1",
				category: "Material",
				description: "NF",
				amount: 200,
				costType: "Atual",
				sourceDocument: "NF-1",
			},
		],
		sheetNames: [
			"Obra",
			"Orcamento",
			"Cronograma Original",
			"Replanejamento",
			"Medicoes",
			"Custos Realizados",
		],
	};
}

function makeStoredUnifiedWork() {
	return {
		id: "work-1",
		ownerId: "owner-1",
		code: "OBRA-001",
		name: "Obra Unificada",
		clientName: "Cliente A",
		plannedStart: new Date("2026-01-01T00:00:00.000Z"),
		plannedEnd: new Date("2026-01-31T00:00:00.000Z"),
		baseDate: new Date("2026-01-15T00:00:00.000Z"),
		activeImportId: "import-1",
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		imports: [{ createdAt: new Date("2026-01-02T00:00:00.000Z") }],
		items: [
			{
				id: "stage-1",
				parentId: null,
				index: "1",
				type: "STAGE",
				description: "Fundacao",
				unit: null,
				quantity: null,
				unitCost: null,
				totalCost: 0,
				totalBudget: 0,
				plannedStart: null,
				plannedEnd: null,
				actualStart: null,
				actualEnd: null,
				completionPercentage: 0,
				providedStatus: null,
				computedStatus: "NOT_STARTED",
				sortOrder: 1,
			},
			{
				id: "item-1",
				parentId: "stage-1",
				index: "1.1",
				type: "ITEM",
				description: "Escavacao",
				unit: "m3",
				quantity: 10,
				unitCost: 55,
				totalCost: 550,
				totalBudget: 550,
				plannedStart: null,
				plannedEnd: null,
				actualStart: null,
				actualEnd: null,
				completionPercentage: 0,
				providedStatus: "Ativo",
				computedStatus: "IN_PROGRESS",
				sortOrder: 2,
			},
		],
		baselineSchedules: [
			{
				id: "baseline-1",
				budgetItemId: "item-1",
				index: "1.1",
				plannedStart: new Date("2026-01-01T00:00:00.000Z"),
				plannedEnd: new Date("2026-01-31T00:00:00.000Z"),
				plannedWeight: null,
			},
		],
		scheduleRevisions: [
			{
				id: "revision-1",
				budgetItemId: "item-1",
				index: "1.1",
				replannedStart: new Date("2026-01-05T00:00:00.000Z"),
				replannedEnd: new Date("2026-02-05T00:00:00.000Z"),
				revisionDate: new Date("2026-01-10T00:00:00.000Z"),
			},
		],
		measurements: [
			{
				id: "measurement-1",
				budgetItemId: "item-1",
				index: "1.1",
				measurementDate: new Date("2026-01-15T00:00:00.000Z"),
				measuredPercentageAccumulated: 0.5,
				measuredQuantityAccumulated: null,
			},
		],
		actualCosts: [
			{
				id: "cost-1",
				budgetItemId: "item-1",
				budgetIndex: "1.1",
				costDate: new Date("2026-01-10T00:00:00.000Z"),
				amount: 200,
				costType: "CURRENT",
				category: "MATERIAL",
				appropriationStatus: "APPROPRIATED",
			},
		],
	};
}

describe("constructionPlanningController", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		getSessionUser.mockResolvedValue({ id: "owner-1", role: "GERENTE" });
	});

	it("returns selectable import row ids in one scoped batch operation", async () => {
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);
		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/import-batches/batch-1/selectable-row-ids",
			),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			batchId: "batch-1",
			rowIds: ["row-1", "row-2"],
		});
		expect(listSelectableImportRowIds).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			"batch-1",
		);
	});

	it("does not return row ids for a batch outside the requested work", async () => {
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);
		listSelectableImportRowIds.mockResolvedValueOnce(null);
		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-2/import-batches/batch-1/selectable-row-ids",
			),
		);

		expect(response.status).toBe(404);
		expect(listSelectableImportRowIds).toHaveBeenCalledWith(
			"owner-1",
			"work-2",
			"batch-1",
		);
	});

	it("requires authentication for protected work routes", async () => {
		getSessionUser.mockImplementationOnce(async () => {
			throw new ConstructionError("UNAUTHORIZED", "Login obrigatorio", 401);
		});
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works"),
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			message: "Login obrigatorio",
			errors: [],
		});
		expect(listWorks).not.toHaveBeenCalled();
	});

	it("does not expose the obra-completa template endpoint", async () => {
		getSessionUser.mockImplementation(async () => {
			throw new ConstructionError("UNAUTHORIZED", "Login obrigatorio", 401);
		});
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/templates/obra-completa"),
		);

		expect(response.status).toBe(404);
		expect(getSessionUser).not.toHaveBeenCalled();
	});

	it("keeps template orcamento-aditivo endpoint public", async () => {
		getSessionUser.mockImplementation(async () => {
			throw new ConstructionError("UNAUTHORIZED", "Login obrigatorio", 401);
		});
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/templates/orcamento-aditivo"),
		);

		expect(response.status).toBe(200);
		expect(getSessionUser).not.toHaveBeenCalled();
		expect(response.headers.get("content-type")).toContain(
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		);
		expect(response.headers.get("content-disposition")).toContain(
			"modelo-orcamento-aditivo.xlsx",
		);
	});

	it("keeps template medicao-obra endpoint public", async () => {
		getSessionUser.mockImplementation(async () => {
			throw new ConstructionError("UNAUTHORIZED", "Login obrigatorio", 401);
		});
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/templates/medicao-obra"),
		);

		expect(response.status).toBe(200);
		expect(getSessionUser).not.toHaveBeenCalled();
		expect(response.headers.get("content-type")).toContain(
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		);
		expect(response.headers.get("content-disposition")).toContain(
			"modelo-medicao-obra.xlsx",
		);
	});

	it("keeps template custos endpoint public", async () => {
		getSessionUser.mockImplementation(async () => {
			throw new ConstructionError("UNAUTHORIZED", "Login obrigatorio", 401);
		});
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/templates/custos"),
		);

		expect(response.status).toBe(200);
		expect(getSessionUser).not.toHaveBeenCalled();
		expect(response.headers.get("content-type")).toContain(
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		);
		expect(response.headers.get("content-disposition")).toContain(
			"modelo-custos.xlsx",
		);
	});

	it("keeps template cotacao endpoint public", async () => {
		getSessionUser.mockImplementation(async () => {
			throw new ConstructionError("UNAUTHORIZED", "Login obrigatorio", 401);
		});
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/templates/cotacao"),
		);

		expect(response.status).toBe(200);
		expect(getSessionUser).not.toHaveBeenCalled();
		expect(response.headers.get("content-type")).toContain(
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		);
		expect(response.headers.get("content-disposition")).toContain(
			"modelo-cotacao.xlsx",
		);
	});

	it("keeps template cronograma endpoint public", async () => {
		getSessionUser.mockImplementation(async () => {
			throw new ConstructionError("UNAUTHORIZED", "Login obrigatorio", 401);
		});
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/templates/cronograma"),
		);

		expect(response.status).toBe(200);
		expect(getSessionUser).not.toHaveBeenCalled();
		expect(response.headers.get("content-type")).toContain(
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		);
		expect(response.headers.get("content-disposition")).toContain(
			"modelo-cronograma.xlsx",
		);
	});

	it("keeps template medicao-contrato endpoint public", async () => {
		getSessionUser.mockImplementation(async () => {
			throw new ConstructionError("UNAUTHORIZED", "Login obrigatorio", 401);
		});
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/templates/medicao-contrato"),
		);

		expect(response.status).toBe(200);
		expect(getSessionUser).not.toHaveBeenCalled();
		expect(response.headers.get("content-type")).toContain(
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		);
		expect(response.headers.get("content-disposition")).toContain(
			"modelo-medicao-contrato.xlsx",
		);
	});

	it("rejects invalid multiworks BI query params", async () => {
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/bi/multiworks?status=INVALID"),
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			message: "Parametros invalidos",
			errors: [
				{
					field: "status",
					code: "invalid_value",
					message:
						'Invalid option: expected one of "NOT_STARTED"|"IN_PROGRESS"|"DONE"|"SUSPENDED"|"IGNORED"',
				},
			],
		});
		expect(getAllWorksWithItems).not.toHaveBeenCalled();
	});

	it("reads BI work items using owner-scoped lookup", async () => {
		const { ConstructionBIService } = await import(
			"../../../../src/modules/construction-planning/bi/bi-service"
		);
		const biService = new ConstructionBIService(
			(await import(
				"../../../../src/modules/construction-planning/repository"
			)) as never,
		);

		await expect(
			biService.getWorkBI("owner-1", "work-1"),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			status: 404,
		});

		expect(getWorkWithItems).toHaveBeenCalledWith("owner-1", "work-1");
	});

	it("returns structured not found when deleting a missing work", async () => {
		deleteWork.mockResolvedValueOnce(null as unknown as undefined);
		const { constructionWorkService } = await import(
			"../../../../src/modules/construction-planning/works/work-service"
		);
		const deleteSpy = spyOn(
			constructionWorkService,
			"delete",
		).mockImplementationOnce(async () => {
			throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
		});

		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works/missing-work", {
				method: "DELETE",
			}),
		);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({
			message: "Obra nao encontrada",
			errors: [],
		});
		expect(deleteSpy).toHaveBeenCalledWith("owner-1", "missing-work", {
			userId: "owner-1",
		});
	});

	it("returns expanded work BI contract at the overview endpoint", async () => {
		getWorkWithItems.mockResolvedValueOnce(makeStoredUnifiedWork() as never);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works/work-1/overview"),
		);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.indicators.costPerformanceIndex).toMatchObject({
			formula: "EV / AC",
			status: "AVAILABLE",
		});
		expect(json.sCurve[0]).toHaveProperty("trendProjected");
		expect(json.costByStage[0]).toHaveProperty("actualCost");
		expect(json.calculationAudit).toEqual(
			expect.arrayContaining([expect.objectContaining({ key: "PV" })]),
		);
		expect(json.qualityIssues).toEqual(expect.any(Array));
	});

	it("returns sourceMode LIVE with no snapshot in the overview by default", async () => {
		getWorkWithItems.mockResolvedValueOnce(makeStoredUnifiedWork() as never);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works/work-1/overview"),
		);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.sourceMode).toBe("LIVE");
		expect(json.snapshot).toBeNull();
		expect(json.summary).toMatchObject({ activeBudget: 550, earnedValue: 275 });
	});

	it("returns expanded multiworks BI contract at the preserved path", async () => {
		getAllWorksWithItems.mockResolvedValueOnce([
			makeStoredUnifiedWork(),
		] as never);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/bi/multiworks"),
		);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.cards).toMatchObject({ totalWorks: 1, totalActualCost: 200 });
		expect(json.rankings.costPerformance[0]).toMatchObject({
			workId: "work-1",
		});
		expect(json.portfolioChart[0]).toMatchObject({
			workId: "work-1",
			workName: "Obra Unificada",
			activeBudget: 550,
			earnedValue: 275,
			actualCost: 200,
			plannedValue: expect.any(Number),
			spi: expect.any(Number),
			cpi: expect.any(Number),
		});
		expect(json.works[0]).toMatchObject({ workId: "work-1", actualCost: 200 });
		expect(json.costsByWork[0]).toMatchObject({
			workId: "work-1",
			currentBudgetBalance: 350,
		});
		expect(json.scheduleByWork[0]).toMatchObject({
			workId: "work-1",
			measuredPercentage: 0.5,
		});
		expect(json.dataCompleteness).toMatchObject({
			hasMeasurements: true,
			hasActualCosts: true,
		});
		expect(json.qualityIssues).toEqual(expect.any(Array));
	});

	it("returns schedule work, items and gantt at the preserved path", async () => {
		getWorkWithItems.mockResolvedValueOnce(makeStoredUnifiedWork() as never);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works/work-1/schedule"),
		);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.work.id).toBe("work-1");
		expect(json.items).toHaveLength(1);
		expect(json.gantt[0]).toMatchObject({
			id: "item-1",
			index: "1.1",
			label: "Escavacao",
			itemId: "item-1",
			measuredPercentage: 0.5,
			status: "IN_PROGRESS",
		});
	});

	it("does not expose the legacy whole-work import endpoint", async () => {
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);
		const form = new FormData();
		form.append("costCenterId", "cc-test");
		form.append(
			"file",
			new File([new Uint8Array([1])], "unificado.xlsx", {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/imports", {
				method: "POST",
				body: form,
			}),
		);

		expect(response.status).toBe(404);
		expect(parseWorkbookByKind).not.toHaveBeenCalled();
	});

	it("imports a cronograma workbook at the schedule import endpoint", async () => {
		existingBudgetIndexes.mockImplementation(
			async (_ctx, indexes) => new Set(indexes.filter((i) => i === "1")),
		);
		const { ConstructionScheduleService } = await import(
			"../../../../src/modules/construction-planning/schedule/schedule-service"
		);
		const importSpy = spyOn(
			ConstructionScheduleService.prototype,
			"importSchedule",
		).mockResolvedValueOnce({ work: { id: "work-1" } } as never);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);
		const form = new FormData();
		form.append(
			"file",
			new File([new Uint8Array([1])], "cronograma.xlsx", {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/schedule/import",
				{
					method: "POST",
					body: form,
				},
			),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			workId: "work-1",
			imported: 1,
			importedCount: 1,
			rejectedCount: 0,
			processedSheets: ["Cronograma Original", "Replanejamento"],
			errors: [],
		});
		expect(parseWorkbookByKind).toHaveBeenCalledWith(
			expect.anything(),
			"cronograma.xlsx",
			"cronograma",
		);
		expect(importSpy).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			expect.arrayContaining([
				expect.objectContaining({ index: "1", plannedStart: "2026-01-01" }),
			]),
			[],
			"owner-1",
		);
	});

	it("persists replanning rows from a cronograma workbook and reports them", async () => {
		existingBudgetIndexes.mockImplementation(
			async (_ctx, indexes) => new Set(indexes.filter((i) => i === "1")),
		);
		parseWorkbookByKind.mockImplementationOnce((() => ({
			...makeWorkbook(),
			budgetRows: [],
			baselineRows: [
				{
					rowNumber: 2,
					index: "1",
					plannedStart: "2026-01-01",
					plannedEnd: "2026-01-31",
					plannedWeight: null,
				},
			],
			replanningRows: [
				{
					rowNumber: 2,
					index: "1",
					version: "R1",
					replannedStart: "2026-01-05",
					replannedEnd: "2026-02-05",
					revisionDate: "2026-01-10",
					reason: "Chuva",
				},
			],
			measurementRows: [],
			contractRows: [],
			serviceRows: [],
			contractMeasurementRows: [],
			paymentRows: [],
			actualCostRows: [],
		})) as never);
		const { ConstructionScheduleService } = await import(
			"../../../../src/modules/construction-planning/schedule/schedule-service"
		);
		const importSpy = spyOn(
			ConstructionScheduleService.prototype,
			"importSchedule",
		).mockResolvedValueOnce({
			work: { id: "work-1" },
			replanningImported: 1,
		} as never);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);
		const form = new FormData();
		form.append(
			"file",
			new File([new Uint8Array([1])], "cronograma.xlsx", {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/schedule/import",
				{
					method: "POST",
					body: form,
				},
			),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			workId: "work-1",
			imported: 2,
			importedCount: 2,
			rejectedCount: 0,
			processedSheets: ["Cronograma Original", "Replanejamento"],
			errors: [],
		});
		expect(importSpy).toHaveBeenCalledTimes(1);
		expect(importSpy).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			expect.arrayContaining([
				expect.objectContaining({ index: "1", plannedStart: "2026-01-01" }),
			]),
			expect.arrayContaining([
				expect.objectContaining({ index: "1", version: "R1" }),
			]),
			"owner-1",
		);
	});

	it("returns partial success when some cronograma rows are invalid", async () => {
		existingBudgetIndexes.mockImplementation(
			async (_ctx, indexes) => new Set(indexes.filter((i) => i === "1")),
		);
		parseWorkbookByKind.mockImplementationOnce((() => ({
			...makeWorkbook(),
			budgetRows: [],
			baselineRows: [
				{
					rowNumber: 2,
					index: "1",
					plannedStart: "2026-01-01",
					plannedEnd: "2026-01-31",
					plannedWeight: null,
				},
				{
					rowNumber: 3,
					index: "9.9",
					plannedStart: "2026-01-01",
					plannedEnd: "2026-01-31",
					plannedWeight: null,
				},
			],
			replanningRows: [],
			measurementRows: [],
			contractRows: [],
			serviceRows: [],
			contractMeasurementRows: [],
			paymentRows: [],
			actualCostRows: [],
		})) as never);
		const { ConstructionScheduleService } = await import(
			"../../../../src/modules/construction-planning/schedule/schedule-service"
		);
		const importSpy = spyOn(
			ConstructionScheduleService.prototype,
			"importSchedule",
		).mockResolvedValueOnce({ work: { id: "work-1" } } as never);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);
		const form = new FormData();
		form.append(
			"file",
			new File([new Uint8Array([1])], "cronograma.xlsx", {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/schedule/import",
				{
					method: "POST",
					body: form,
				},
			),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toMatchObject({
			workId: "work-1",
			importedCount: 1,
			rejectedCount: 1,
			errors: [
				expect.objectContaining({
					sheet: "Cronograma Original",
					row: 3,
					field: "Indice",
					code: "MISSING_BUDGET_DEPENDENCY",
					dependency: "9.9",
				}),
			],
		});
		expect(importSpy).toHaveBeenCalledTimes(1);
		expect(importSpy.mock.calls[0][2]).toHaveLength(1);
		expect(importSpy).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			expect.arrayContaining([expect.objectContaining({ index: "1" })]),
			[],
			"owner-1",
		);
	});

	it("rejects schedule imports with structural errors without persisting rows", async () => {
		const validatorModule = await import(
			"../../../../src/modules/construction-planning/imports/validator"
		);
		const validationSpy = spyOn(
			validatorModule,
			"validateWorkbookByKind",
		).mockReturnValueOnce({
			valid: false,
			errors: [
				{
					sheet: "Obra",
					code: "MISSING_REQUIRED_FIELD",
					field: "Codigo da obra",
					message: "Codigo da obra obrigatorio",
				},
			],
		} as never);
		const { ConstructionScheduleService } = await import(
			"../../../../src/modules/construction-planning/schedule/schedule-service"
		);
		const importSpy = spyOn(
			ConstructionScheduleService.prototype,
			"importSchedule",
		);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);
		const form = new FormData();
		form.append(
			"file",
			new File([new Uint8Array([1])], "cronograma.xlsx", {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/schedule/import",
				{
					method: "POST",
					body: form,
				},
			),
		);

		expect(response.status).toBe(422);
		const body = await response.json();
		expect(body.message).toBe("Planilha invalida");
		expect(body.errors).toEqual([
			expect.objectContaining({ field: "Codigo da obra" }),
		]);
		expect(importSpy).not.toHaveBeenCalled();
		expect(validationSpy).toHaveBeenCalledWith(expect.anything(), "cronograma");
	});

	it("rejects a cronograma workbook with no rows as 400", async () => {
		parseWorkbookByKind.mockImplementationOnce((() => ({
			...makeWorkbook(),
			budgetRows: [],
			baselineRows: [],
			replanningRows: [],
			measurementRows: [],
			contractRows: [],
			serviceRows: [],
			contractMeasurementRows: [],
			paymentRows: [],
			actualCostRows: [],
		})) as never);
		const { ConstructionScheduleService } = await import(
			"../../../../src/modules/construction-planning/schedule/schedule-service"
		);
		const importSpy = spyOn(
			ConstructionScheduleService.prototype,
			"importSchedule",
		);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);
		const form = new FormData();
		form.append(
			"file",
			new File([new Uint8Array([1])], "cronograma.xlsx", {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/schedule/import",
				{
					method: "POST",
					body: form,
				},
			),
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			message: "Nenhum item de cronograma encontrado",
		});
		expect(importSpy).not.toHaveBeenCalled();
	});

	it("imports a medicao-obra workbook at the measurements import endpoint", async () => {
		const { constructionManualEntryService } = await import(
			"../../../../src/modules/construction-planning/entries/manual-entry-service"
		);
		existingBudgetIndexes.mockImplementation(
			async (_ctx, indexes) => new Set(indexes.filter((i) => i === "1")),
		);
		const importSpy = spyOn(
			constructionManualEntryService,
			"importMeasurements",
		).mockResolvedValueOnce([
			{
				id: "measurement-imported",
				workId: "work-1",
			} as never,
		]);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);
		const form = new FormData();
		form.append(
			"file",
			new File([new Uint8Array([1])], "medicoes.xlsx", {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/measurements/import",
				{
					method: "POST",
					body: form,
				},
			),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			workId: "work-1",
			imported: 1,
			importedCount: 1,
			rejectedCount: 0,
			processedSheets: ["Medicoes Obra"],
			importedSections: expect.any(Array),
			warningCount: 0,
			warnings: [],
			errors: [],
		});
		expect(parseWorkbookByKind).toHaveBeenCalledWith(
			expect.anything(),
			"medicoes.xlsx",
			"medicao-obra",
		);
		expect(importSpy).toHaveBeenCalledTimes(1);
		expect(importSpy).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			expect.arrayContaining([
				expect.objectContaining({
					index: "1",
					measurementDate: "2026-01-15",
				}),
			]),
		);
	});

	it("returns an error and aborts the batch when the measurements import fails", async () => {
		const { constructionManualEntryService } = await import(
			"../../../../src/modules/construction-planning/entries/manual-entry-service"
		);
		existingBudgetIndexes.mockImplementation(
			async (_ctx, indexes) => new Set(indexes),
		);
		const importSpy = spyOn(
			constructionManualEntryService,
			"importMeasurements",
		).mockRejectedValueOnce(
			new ConstructionError(
				"NOT_FOUND",
				"Item de orcamento nao encontrado para o indice 1.1",
				404,
			),
		);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);
		const form = new FormData();
		form.append(
			"file",
			new File([new Uint8Array([1])], "medicoes.xlsx", {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/measurements/import",
				{
					method: "POST",
					body: form,
				},
			),
		);

		expect(response.status).toBe(404);
		expect(importSpy).toHaveBeenCalledTimes(1);
	});

	it("rejects invalid measurement rows pointwise and persists the valid ones", async () => {
		parseWorkbookByKind.mockImplementationOnce((() => ({
			...makeWorkbook(),
			budgetRows: [],
			baselineRows: [],
			replanningRows: [],
			contractRows: [],
			serviceRows: [],
			contractMeasurementRows: [],
			paymentRows: [],
			actualCostRows: [],
			measurementRows: [
				{
					rowNumber: 2,
					index: "1",
					measurementDate: "2026-01-15",
					measuredPercentageAccumulated: 0.5,
					measuredQuantityAccumulated: 5,
					notes: null,
				},
				{
					rowNumber: 3,
					index: "1",
					measurementDate: "nao-e-data",
					measuredPercentageAccumulated: 0.5,
					measuredQuantityAccumulated: 5,
					notes: null,
				},
			],
		})) as never);
		const { constructionManualEntryService } = await import(
			"../../../../src/modules/construction-planning/entries/manual-entry-service"
		);
		existingBudgetIndexes.mockImplementation(
			async (_ctx, indexes) => new Set(indexes.filter((i) => i === "1")),
		);
		const importSpy = spyOn(
			constructionManualEntryService,
			"importMeasurements",
		).mockResolvedValueOnce([
			{
				id: "measurement-imported",
				workId: "work-1",
			} as never,
		]);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);
		const form = new FormData();
		form.append(
			"file",
			new File([new Uint8Array([1])], "medicoes.xlsx", {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/measurements/import",
				{
					method: "POST",
					body: form,
				},
			),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toMatchObject({
			workId: "work-1",
			imported: 1,
			importedCount: 1,
			rejectedCount: 1,
			warnings: [],
		});
		expect(body.errors).toEqual([
			expect.objectContaining({
				sheet: "Medicoes",
				row: 3,
				field: "Data da medicao",
				code: "INVALID_DATE",
			}),
		]);
		expect(importSpy).toHaveBeenCalledTimes(1);
		expect(importSpy.mock.calls[0][2]).toHaveLength(1);
		expect(importSpy.mock.calls[0][2][0]).toMatchObject({
			index: "1",
			measurementDate: "2026-01-15",
		});
	});

	it("rejects measurement rows whose budget index cannot be bound and does not persist anything", async () => {
		existingBudgetIndexes.mockImplementation(async () => new Set());
		const { constructionManualEntryService } = await import(
			"../../../../src/modules/construction-planning/entries/manual-entry-service"
		);
		const importSpy = spyOn(
			constructionManualEntryService,
			"importMeasurements",
		);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);
		const form = new FormData();
		form.append(
			"file",
			new File([new Uint8Array([1])], "medicoes.xlsx", {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/measurements/import",
				{
					method: "POST",
					body: form,
				},
			),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toMatchObject({
			workId: "work-1",
			imported: 0,
			importedCount: 0,
			rejectedCount: 1,
		});
		expect(body.errors).toEqual([
			expect.objectContaining({
				sheet: "Medicoes",
				row: 2,
				field: "Indice",
				code: "MISSING_BUDGET_DEPENDENCY",
				dependency: "1",
			}),
		]);
		expect(importSpy).not.toHaveBeenCalled();
	});

	it("imports a custos workbook at the actual-costs import endpoint", async () => {
		const { constructionManualEntryService } = await import(
			"../../../../src/modules/construction-planning/entries/manual-entry-service"
		);
		existingBudgetIndexes.mockImplementation(
			async (_ctx, indexes) => new Set(indexes.filter((i) => i === "1")),
		);
		const importSpy = spyOn(
			constructionManualEntryService,
			"importActualCosts",
		).mockResolvedValueOnce([
			{
				id: "cost-imported",
				workId: "work-1",
			} as never,
		]);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);
		const form = new FormData();
		form.append(
			"file",
			new File([new Uint8Array([1])], "custos.xlsx", {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/actual-costs/import",
				{
					method: "POST",
					body: form,
				},
			),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			workId: "work-1",
			imported: 1,
			importedCount: 1,
			rejectedCount: 0,
			processedSheets: ["Custos Realizados"],
			importedSections: expect.any(Array),
			warningCount: 0,
			warnings: [],
			errors: [],
		});
		expect(parseWorkbookByKind).toHaveBeenCalledWith(
			expect.anything(),
			"custos.xlsx",
			"custos",
		);
		expect(importSpy).toHaveBeenCalledTimes(1);
		expect(importSpy).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			expect.arrayContaining([
				expect.objectContaining({
					budgetIndex: "1",
					category: "MATERIAL",
					amount: 200,
				}),
			]),
		);
	});

	it("returns an error and aborts the batch when the actual-costs import fails", async () => {
		const { constructionManualEntryService } = await import(
			"../../../../src/modules/construction-planning/entries/manual-entry-service"
		);
		existingBudgetIndexes.mockImplementation(
			async (_ctx, indexes) => new Set(indexes),
		);
		const importSpy = spyOn(
			constructionManualEntryService,
			"importActualCosts",
		).mockRejectedValueOnce(
			new ConstructionError(
				"INVALID_INPUT",
				"Item de orcamento nao encontrado",
				400,
			),
		);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);
		const form = new FormData();
		form.append(
			"file",
			new File([new Uint8Array([1])], "custos.xlsx", {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/actual-costs/import",
				{
					method: "POST",
					body: form,
				},
			),
		);

		expect(response.status).toBe(400);
		expect(importSpy).toHaveBeenCalledTimes(1);
	});

	it("rejects actual-cost rows with an unbindable budget index pointwise and persists the valid ones", async () => {
		parseWorkbookByKind.mockImplementationOnce((() => ({
			...makeWorkbook(),
			budgetRows: [],
			baselineRows: [],
			replanningRows: [],
			measurementRows: [],
			contractRows: [],
			serviceRows: [],
			contractMeasurementRows: [],
			paymentRows: [],
			actualCostRows: [
				{
					rowNumber: 2,
					costDate: "2026-01-20",
					budgetIndex: "1",
					category: "Material",
					description: "NF",
					amount: 200,
					costType: "Atual",
					sourceDocument: "NF-1",
					supplierName: null,
					costGroup: null,
					paymentStatus: null,
					competenceDate: null,
					dueDate: null,
					paymentDate: null,
					documentNumber: null,
				},
				{
					rowNumber: 3,
					costDate: "2026-01-20",
					budgetIndex: "9.9",
					category: "Material",
					description: "NF sem indice",
					amount: 300,
					costType: "Atual",
					sourceDocument: "NF-2",
					supplierName: null,
					costGroup: null,
					paymentStatus: null,
					competenceDate: null,
					dueDate: null,
					paymentDate: null,
					documentNumber: null,
				},
			],
		})) as never);
		const { constructionManualEntryService } = await import(
			"../../../../src/modules/construction-planning/entries/manual-entry-service"
		);
		existingBudgetIndexes.mockImplementation(
			async (_ctx, indexes) => new Set(indexes.filter((i) => i === "1")),
		);
		const importSpy = spyOn(
			constructionManualEntryService,
			"importActualCosts",
		).mockResolvedValueOnce([
			{
				id: "cost-imported",
				workId: "work-1",
			} as never,
		]);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);
		const form = new FormData();
		form.append(
			"file",
			new File([new Uint8Array([1])], "custos.xlsx", {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/actual-costs/import",
				{
					method: "POST",
					body: form,
				},
			),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toMatchObject({
			workId: "work-1",
			imported: 1,
			importedCount: 1,
			rejectedCount: 1,
			warnings: [],
		});
		expect(body.errors).toEqual([
			expect.objectContaining({
				sheet: "Custos Realizados",
				row: 3,
				field: "Indice",
				code: "MISSING_BUDGET_DEPENDENCY",
				dependency: "9.9",
			}),
		]);
		expect(importSpy).toHaveBeenCalledTimes(1);
		expect(importSpy.mock.calls[0][2]).toHaveLength(1);
		expect(importSpy.mock.calls[0][2][0]).toMatchObject({
			budgetIndex: "1",
			amount: 200,
		});
	});

	it("keeps unappropriated actual costs without a budget index", async () => {
		parseWorkbookByKind.mockImplementationOnce((() => ({
			...makeWorkbook(),
			budgetRows: [],
			baselineRows: [],
			replanningRows: [],
			measurementRows: [],
			contractRows: [],
			serviceRows: [],
			contractMeasurementRows: [],
			paymentRows: [],
			actualCostRows: [
				{
					rowNumber: 2,
					costDate: "2026-01-20",
					budgetIndex: null,
					category: "Outros",
					description: "Reserva",
					amount: 50,
					costType: "Futuro",
					sourceDocument: null,
					supplierName: null,
					costGroup: null,
					paymentStatus: null,
					competenceDate: null,
					dueDate: null,
					paymentDate: null,
					documentNumber: null,
				},
			],
		})) as never);
		const { constructionManualEntryService } = await import(
			"../../../../src/modules/construction-planning/entries/manual-entry-service"
		);
		const importSpy = spyOn(
			constructionManualEntryService,
			"importActualCosts",
		).mockResolvedValueOnce([
			{
				id: "cost-imported",
				workId: "work-1",
			} as never,
		]);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);
		const form = new FormData();
		form.append(
			"file",
			new File([new Uint8Array([1])], "custos.xlsx", {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/actual-costs/import",
				{
					method: "POST",
					body: form,
				},
			),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toMatchObject({
			workId: "work-1",
			imported: 1,
			importedCount: 1,
			rejectedCount: 0,
		});
		expect(importSpy).toHaveBeenCalledTimes(1);
		expect(importSpy.mock.calls[0][2][0]).toMatchObject({
			budgetIndex: undefined,
			category: "OTHER",
			costType: "FUTURE",
		});
	});

	it("imports a medicao-contrato workbook at the contract measurements import endpoint", async () => {
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);
		const form = new FormData();
		form.append(
			"file",
			new File([new Uint8Array([1])], "medicoes-contrato.xlsx", {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/contracts/contract-1/measurements/import",
				{
					method: "POST",
					body: form,
				},
			),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			workId: "work-1",
			imported: 1,
			paymentsImported: 1,
			contractsImported: 1,
			importedCount: 3,
			rejectedCount: 0,
			processedSheets: [
				"Contrato",
				"Servicos",
				"Medicoes Contrato",
				"Pagamentos",
			],
			importedSections: expect.any(Array),
			warningCount: 0,
			warnings: [],
			errors: [],
		});
		expect(parseWorkbookByKind).toHaveBeenCalledWith(
			expect.anything(),
			"medicoes-contrato.xlsx",
			"medicao-contrato",
		);
		expect(transaction).toHaveBeenCalledTimes(1);
		expect(txContractCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					code: "C-001",
					supplierName: "Fornecedor A",
					contractValue: 50000,
					status: "EM_ANDAMENTO",
					workId: "work-1",
				}),
			}),
		);
		expect(txServiceCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					type: "ITEM",
					description: "Item A",
					unit: "m2",
					quantity: 10,
					unitCost: 100,
					totalCost: 1000,
					budgetItemId: "budget-item-1",
					contractId: "contract-1",
				}),
			}),
		);
		expect(txMeasurementCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					number: 1,
					contractId: "contract-1",
					date: expect.any(Date),
					title: "Medicao 1",
				}),
			}),
		);
		expect(txItemCreateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: [
					expect.objectContaining({
						measurementId: "measurement-imported",
						serviceId: "service-1",
					}),
				],
			}),
		);
		expect(txPaymentCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					value: 10000,
					paidValue: 10000,
					status: "PAGO",
				}),
			}),
		);
	});

	it("rejects the contract import with 409 when a contract code already exists", async () => {
		txContractFindMany.mockResolvedValueOnce([{ code: "C-001" }]);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);
		const form = new FormData();
		form.append(
			"file",
			new File([new Uint8Array([1])], "medicoes-contrato.xlsx", {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/contracts/contract-1/measurements/import",
				{
					method: "POST",
					body: form,
				},
			),
		);

		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.message).toBe(
			"Ja existe um contrato com este codigo nesta obra.",
		);
		expect(txContractCreate).not.toHaveBeenCalled();
		expect(txServiceCreate).not.toHaveBeenCalled();
	});

	it("skips contract measurements without services and reports a warning", async () => {
		parseWorkbookByKind.mockImplementationOnce(() => ({
			...makeWorkbook(),
			budgetRows: [],
			baselineRows: [],
			replanningRows: [],
			measurementRows: [],
			sheetNames: [
				"Guia",
				"Contrato",
				"Servicos",
				"Medicoes Contrato",
				"Pagamentos",
			],
			contractRows: [],
			serviceRows: [],
			contractMeasurementRows: [
				{
					rowNumber: 2,
					number: "1",
					date: "2026-01-15",
					title: "Medicao 1",
					status: "APROVADA",
					discountValue: null,
					retentionValue: null,
					notes: null,
				},
			],
			paymentRows: [],
			actualCostRows: [],
		}));
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);
		const form = new FormData();
		form.append(
			"file",
			new File([new Uint8Array([1])], "medicoes-contrato.xlsx", {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/contracts/contract-1/measurements/import",
				{
					method: "POST",
					body: form,
				},
			),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			workId: "work-1",
			imported: 0,
			paymentsImported: 0,
			contractsImported: 0,
			importedCount: 0,
			rejectedCount: 0,
			processedSheets: [
				"Contrato",
				"Servicos",
				"Medicoes Contrato",
				"Pagamentos",
			],
			importedSections: expect.any(Array),
			warningCount: 1,
			warnings: [
				expect.objectContaining({
					sheet: "Medicoes Contrato",
					row: 2,
					code: "SKIPPED_NO_SERVICES",
				}),
			],
			errors: [],
		});
		expect(txMeasurementCreate).not.toHaveBeenCalled();
	});

	it("returns partial success with per-row errors and persists the valid rows on invalid contract measurement rows", async () => {
		parseWorkbookByKind.mockImplementationOnce(() => ({
			...makeWorkbook(),
			budgetRows: [],
			baselineRows: [],
			replanningRows: [],
			measurementRows: [],
			sheetNames: [
				"Guia",
				"Contrato",
				"Servicos",
				"Medicoes Contrato",
				"Pagamentos",
			],
			contractRows: [],
			serviceRows: [
				{
					rowNumber: 2,
					index: "1",
					type: "ITEM",
					description: "Servico A",
					unit: "m2",
					quantity: 10,
					unitCost: 100,
					totalCost: 1000,
				},
			],
			contractMeasurementRows: [
				{
					rowNumber: 2,
					number: "1",
					date: "data-invalida",
					title: "Medicao 1",
					status: "APROVADA",
					discountValue: null,
					retentionValue: null,
					notes: null,
				},
				{
					rowNumber: 3,
					number: "2",
					date: "2026-02-15",
					title: "Medicao valida",
					status: "APROVADA",
					discountValue: null,
					retentionValue: null,
					notes: null,
				},
			],
			paymentRows: [
				{
					rowNumber: 4,
					date: "2026-01-20",
					value: 10000,
					paidValue: 10000,
					description: "Pagamento 1",
					retentionValue: null,
					discountValue: null,
					status: "SITUACAO-DESCONHECIDA",
				},
			],
			actualCostRows: [],
		}));
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);
		const form = new FormData();
		form.append(
			"file",
			new File([new Uint8Array([1])], "medicoes-contrato.xlsx", {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/contracts/contract-1/measurements/import",
				{
					method: "POST",
					body: form,
				},
			),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toMatchObject({
			workId: "work-1",
			imported: 1,
			paymentsImported: 1,
			contractsImported: 0,
			importedCount: 2,
			rejectedCount: 2,
			warningCount: 0,
			warnings: [],
		});
		expect(body.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					row: 2,
					sheet: "Medicoes Contrato",
					field: "Data",
					code: "INVALID_DATE",
					message: "Data invalida",
				}),
				expect.objectContaining({
					row: 4,
					sheet: "Pagamentos",
					field: "Situacao do pagamento",
					code: "INVALID_PAYMENT_STATUS",
					message: "Situacao do pagamento invalida na linha 4",
				}),
			]),
		);
		expect(transaction).toHaveBeenCalledTimes(1);
		expect(txMeasurementCreate).toHaveBeenCalledTimes(1);
		expect(txMeasurementCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					title: "Medicao valida",
				}),
			}),
		);
	});

	it("returns partial success with INVALID_NUMBER errors for unparseable money and persists only valid rows", async () => {
		parseWorkbookByKind.mockImplementationOnce((() => ({
			...makeWorkbook(),
			budgetRows: [],
			baselineRows: [],
			replanningRows: [],
			measurementRows: [],
			sheetNames: [
				"Guia",
				"Contrato",
				"Servicos",
				"Medicoes Contrato",
				"Pagamentos",
			],
			contractRows: [],
			serviceRows: [
				{
					rowNumber: 2,
					index: "1",
					type: "ITEM",
					description: "Servico A",
					unit: "m2",
					quantity: "nao-e-numero",
					unitCost: 100,
					totalCost: 1000,
				},
			],
			contractMeasurementRows: [
				{
					rowNumber: 3,
					number: "1",
					date: "2026-01-15",
					title: "Medicao 1",
					status: "APROVADA",
					discountValue: null,
					retentionValue: null,
					notes: null,
				},
			],
			paymentRows: [
				{
					rowNumber: 4,
					date: "2026-01-20",
					value: "abc",
					paidValue: 10000,
					description: "Pagamento 1",
					retentionValue: null,
					discountValue: null,
					status: "PAGO",
				},
			],
			actualCostRows: [],
		})) as never);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);
		const form = new FormData();
		form.append(
			"file",
			new File([new Uint8Array([1])], "medicoes-contrato.xlsx", {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/contracts/contract-1/measurements/import",
				{
					method: "POST",
					body: form,
				},
			),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.message).toBeUndefined();
		expect(body).toMatchObject({
			workId: "work-1",
			imported: 1,
			paymentsImported: 0,
			contractsImported: 0,
			importedCount: 1,
			rejectedCount: 2,
			warningCount: 0,
			warnings: [],
		});
		expect(body.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					row: 2,
					sheet: "Servicos",
					field: "Quantidade",
					code: "INVALID_NUMBER",
					message: "Numero invalido na linha 2",
				}),
				expect.objectContaining({
					row: 4,
					sheet: "Pagamentos",
					field: "Valor",
					code: "INVALID_NUMBER",
					message: "Numero invalido na linha 4",
				}),
			]),
		);
		expect(transaction).toHaveBeenCalledTimes(1);
		expect(txMeasurementCreate).toHaveBeenCalledTimes(1);
	});

	it("dedups service Indice and contract Codigo within the workbook and counts warnings", async () => {
		parseWorkbookByKind.mockImplementationOnce((() => ({
			...makeWorkbook(),
			budgetRows: [],
			baselineRows: [],
			replanningRows: [],
			measurementRows: [],
			sheetNames: [
				"Guia",
				"Contrato",
				"Servicos",
				"Medicoes Contrato",
				"Pagamentos",
			],
			contractRows: [
				{
					rowNumber: 2,
					code: "C-001",
					supplierName: "Fornecedor A",
					contractValue: 50000,
					serviceType: "Servico",
					title: "Contrato 1",
					startDate: "2026-01-01",
					endDate: "2026-12-31",
					status: "Ativo",
					notes: null,
				},
				{
					rowNumber: 3,
					code: "C-001",
					supplierName: "Fornecedor B",
					contractValue: 99999,
					serviceType: "Servico",
					title: "Duplicado",
					startDate: "2026-02-01",
					endDate: "2026-12-31",
					status: "Ativo",
					notes: null,
				},
			],
			serviceRows: [
				{
					rowNumber: 2,
					index: "1",
					type: "ITEM",
					description: "Servico A",
					unit: "m2",
					quantity: 10,
					unitCost: 100,
					totalCost: 1000,
				},
				{
					rowNumber: 3,
					index: "1",
					type: "ITEM",
					description: "Servico duplicado",
					unit: "m2",
					quantity: 5,
					unitCost: 50,
					totalCost: 250,
				},
			],
			contractMeasurementRows: [],
			paymentRows: [],
			actualCostRows: [],
		})) as never);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);
		const form = new FormData();
		form.append(
			"file",
			new File([new Uint8Array([1])], "medicoes-contrato.xlsx", {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/contracts/contract-1/measurements/import",
				{
					method: "POST",
					body: form,
				},
			),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			workId: "work-1",
			imported: 0,
			paymentsImported: 0,
			contractsImported: 1,
			importedCount: 1,
			rejectedCount: 0,
			processedSheets: [
				"Contrato",
				"Servicos",
				"Medicoes Contrato",
				"Pagamentos",
			],
			importedSections: expect.any(Array),
			warningCount: 2,
			warnings: [
				expect.objectContaining({
					sheet: "Contrato",
					row: 3,
					code: "DUPLICATE_CONTRACT",
				}),
				expect.objectContaining({
					sheet: "Servicos",
					row: 3,
					code: "DUPLICATE_SERVICE",
				}),
			],
			errors: [],
		});
		expect(txContractCreate).toHaveBeenCalledTimes(1);
		expect(txServiceCreate).toHaveBeenCalledTimes(1);
		expect(txServiceCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					description: "Item A",
					budgetItemId: "budget-item-1",
				}),
			}),
		);
	});

	it("proceeds when only the Contrato sheet has data and persists contracts", async () => {
		parseWorkbookByKind.mockImplementationOnce((() => ({
			...makeWorkbook(),
			budgetRows: [],
			baselineRows: [],
			replanningRows: [],
			measurementRows: [],
			sheetNames: [
				"Guia",
				"Contrato",
				"Servicos",
				"Medicoes Contrato",
				"Pagamentos",
			],
			contractRows: [
				{
					rowNumber: 2,
					code: "C-100",
					supplierName: "Fornecedor Z",
					contractValue: 25000,
					serviceType: "Servico",
					title: "Contrato 2",
					startDate: "2026-03-01",
					endDate: "2026-12-31",
					status: "Finalizado",
					notes: null,
				},
			],
			serviceRows: [],
			contractMeasurementRows: [],
			paymentRows: [],
			actualCostRows: [],
		})) as never);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);
		const form = new FormData();
		form.append(
			"file",
			new File([new Uint8Array([1])], "medicoes-contrato.xlsx", {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/contracts/contract-1/measurements/import",
				{
					method: "POST",
					body: form,
				},
			),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			workId: "work-1",
			imported: 0,
			paymentsImported: 0,
			contractsImported: 1,
			importedCount: 1,
			rejectedCount: 0,
			processedSheets: [
				"Contrato",
				"Servicos",
				"Medicoes Contrato",
				"Pagamentos",
			],
			importedSections: expect.any(Array),
			warningCount: 0,
			warnings: [],
			errors: [],
		});
		expect(txContractCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					code: "C-100",
					contractValue: 25000,
					status: "FINALIZADO",
				}),
			}),
		);
		expect(txServiceCreate).not.toHaveBeenCalled();
	});

	it("does not expose the obra-completa or unified workbook templates", async () => {
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/templates/obra-completa"),
		);

		expect(response.status).toBe(404);

		const unifiedResponse = await constructionPlanningController.handle(
			new Request("http://localhost/construction/templates/unificado"),
		);

		expect(unifiedResponse.status).toBe(404);
	});

	it("creates manual works through the works service boundary", async () => {
		const { constructionWorkService } = await import(
			"../../../../src/modules/construction-planning/works/work-service"
		);
		const createSpy = spyOn(
			constructionWorkService,
			"create",
		).mockResolvedValueOnce({
			id: "work-created",
			ownerId: "owner-1",
			code: "OBRA-NEW",
			name: "Obra Nova",
		} as never);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					code: " OBRA-NEW ",
					name: " Obra Nova ",
					costCenterId: "cc-test",
					clientName: " Cliente ",
				}),
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			id: "work-created",
			code: "OBRA-NEW",
		});
		expect(createSpy).toHaveBeenCalledWith(
			"owner-1",
			expect.objectContaining({
				code: "OBRA-NEW",
				name: "Obra Nova",
				clientName: "Cliente",
			}),
		);
		expect(createWorkManual).not.toHaveBeenCalled();
	});

	it("accepts the multipart payload used to create a work with budget", async () => {
		const { constructionWorkService } = await import(
			"../../../../src/modules/construction-planning/works/work-service"
		);
		const { budgetService } = await import(
			"../../../../src/modules/construction-planning/budget.service"
		);
		const createSpy = spyOn(
			constructionWorkService,
			"create",
		).mockResolvedValueOnce({
			id: "work-created",
			ownerId: "owner-1",
			code: "OBRA-NEW",
			name: "Obra Nova",
		} as never);
		const importSpy = spyOn(
			budgetService,
			"importBudget",
		).mockResolvedValueOnce({
			errors: [],
			importedCount: 1,
		} as never);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);
		const form = new FormData();
		form.append("name", "teste teste teste");
		form.append("costCenterId", "cmsw4hcjt0005kokhwcw9lxhw");
		form.append(
			"structuredAddress",
			JSON.stringify({
				zipCode: "59680000",
				street: "teste",
				district: "teste",
				number: "123",
				city: "Campo Grande",
				state: "RN",
				complement: "",
				latitude: -5.86389,
				longitude: -37.31,
			}),
		);
		form.append("plannedStart", "2026-08-07");
		form.append("plannedEnd", "2026-10-28");
		form.append("responsibleName", "Financeiro EngPac");
		form.append(
			"file",
			new File(["xlsx"], "orcamento.xlsx", {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works/with-budget", {
				method: "POST",
				headers: { "idempotency-key": "work-with-budget-test" },
				body: form,
			}),
		);

		expect(response.status).toBe(201);
		expect(await response.json()).toMatchObject({
			status: "IMPORTED",
			work: { id: "work-created" },
		});
		expect(createSpy).toHaveBeenCalledWith(
			"owner-1",
			expect.objectContaining({
				name: "teste teste teste",
				costCenterId: "cmsw4hcjt0005kokhwcw9lxhw",
			}),
		);
		expect(importSpy).toHaveBeenCalledWith(
			"owner-1",
			"work-created",
			expect.objectContaining({ file: expect.any(File) }),
		);
	});

	it("accepts a JSON payload when no budget file is selected", async () => {
		const { constructionWorkService } = await import(
			"../../../../src/modules/construction-planning/works/work-service"
		);
		const createSpy = spyOn(
			constructionWorkService,
			"create",
		).mockResolvedValueOnce({
			id: "work-created-without-file",
			ownerId: "owner-1",
			code: "OBRA-NEW",
			name: "Obra Nova",
		} as never);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works/with-budget", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"idempotency-key": "work-without-budget-file-test",
				},
				body: JSON.stringify({
					name: "Obra Nova",
					costCenterId: "cc-test",
					structuredAddress: {
						zipCode: "59680000",
						city: "Campo Grande",
						state: "RN",
					},
					plannedStart: "2026-08-01",
				}),
			}),
		);

		expect(response.status).toBe(201);
		expect(await response.json()).toMatchObject({
			status: "NO_UPLOAD",
			work: { id: "work-created-without-file" },
		});
		expect(createSpy).toHaveBeenCalledWith(
			"owner-1",
			expect.objectContaining({
				name: "Obra Nova",
				costCenterId: "cc-test",
			}),
		);
	});

	it("lists works through the works service boundary", async () => {
		const { constructionWorkService } = await import(
			"../../../../src/modules/construction-planning/works/work-service"
		);
		const listSpy = spyOn(
			constructionWorkService,
			"list",
		).mockResolvedValueOnce({
			data: [{ id: "work-1", code: "OBRA-001" }],
			currentPage: 2,
			nextPage: null,
			previousPage: 1,
			pageCount: 2,
			totalCount: 11,
			isLastPage: true,
			isFirstPage: false,
		} as never);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works?page=2&limit=10"),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			currentPage: 2,
			totalCount: 11,
		});
		expect(listSpy).toHaveBeenCalledWith("owner-1", { page: 2, limit: 10 });
		expect(listWorks).not.toHaveBeenCalled();
	});

	it("reads work details through the works service boundary", async () => {
		const { constructionWorkService } = await import(
			"../../../../src/modules/construction-planning/works/work-service"
		);
		const getSpy = spyOn(constructionWorkService, "get").mockResolvedValueOnce({
			id: "work-1",
			ownerId: "owner-1",
			code: "OBRA-001",
		} as never);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works/work-1"),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			id: "work-1",
			code: "OBRA-001",
		});
		expect(getSpy).toHaveBeenCalledWith("owner-1", "work-1");
		expect(getWorkById).not.toHaveBeenCalled();
	});

	it("updates works through the works service boundary", async () => {
		const { constructionWorkService } = await import(
			"../../../../src/modules/construction-planning/works/work-service"
		);
		const updateSpy = spyOn(
			constructionWorkService,
			"update",
		).mockResolvedValueOnce({
			id: "work-1",
			ownerId: "owner-1",
			name: "Obra Atualizada",
		} as never);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works/work-1", {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: "Obra Atualizada" }),
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			id: "work-1",
			name: "Obra Atualizada",
		});
		expect(updateSpy).toHaveBeenCalledWith("owner-1", "work-1", {
			name: "Obra Atualizada",
		});
		expect(updateWork).not.toHaveBeenCalled();
	});

	it("deletes works through the works service boundary", async () => {
		const { constructionWorkService } = await import(
			"../../../../src/modules/construction-planning/works/work-service"
		);
		const deleteSpy = spyOn(
			constructionWorkService,
			"delete",
		).mockResolvedValueOnce({
			id: "work-1",
		} as never);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works/work-1", {
				method: "DELETE",
			}),
		);

		expect(response.status).toBe(204);
		expect(deleteSpy).toHaveBeenCalledWith("owner-1", "work-1", {
			userId: "owner-1",
		});
		expect(deleteWork).not.toHaveBeenCalled();
	});

	it("creates measurements through the entries service boundary", async () => {
		workMeasurementCreate.mockResolvedValueOnce({
			id: "measurement-1",
			workId: "work-1",
		});
		const measurement = {
			date: "2026-01-15",
			title: "Medicao de janeiro",
			items: [{ budgetItemId: "item-1", measuredQuantity: 5 }],
		};
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/work-measurements",
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(measurement),
				},
			),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			id: "measurement-1",
			workId: "work-1",
		});
		expect(workMeasurementCreate).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			{ ...measurement, balanceOverride: false },
			{ userId: "owner-1", role: "GERENTE" },
		);
	});

	it("lists measurements through the entries service boundary", async () => {
		workMeasurementList.mockResolvedValueOnce([
			{ id: "measurement-1", workId: "work-1" },
		]);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/work-measurements",
			),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual([
			{ id: "measurement-1", workId: "work-1" },
		]);
		expect(workMeasurementList).toHaveBeenCalledWith("owner-1", "work-1", {
			page: 1,
			limit: 10,
		});
	});

	it("deletes measurements through the entries service boundary", async () => {
		workMeasurementDelete.mockResolvedValueOnce(undefined);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/work-measurements/measurement-1",
				{
					method: "DELETE",
				},
			),
		);

		expect(response.status).toBe(204);
		expect(workMeasurementDelete).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			"measurement-1",
		);
	});

	it("creates actual costs through the entries service boundary", async () => {
		const { constructionManualEntryService } = await import(
			"../../../../src/modules/construction-planning/entries/manual-entry-service"
		);
		const createSpy = spyOn(
			constructionManualEntryService,
			"createActualCost",
		).mockResolvedValueOnce({
			id: "cost-1",
			workId: "work-1",
			amount: 123,
		} as never);
		const actualCost = {
			costDate: "2026-01-20",
			description: "Compra de materiais",
			budgetIndex: "1.1",
			category: "MATERIAL",
			amount: 123,
			costType: "CURRENT",
			paymentStatus: "OPEN",
			allocations: [{ budgetItemId: "item-1", percentage: 100 }],
		};
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works/work-1/actual-costs", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(actualCost),
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			id: "cost-1",
			workId: "work-1",
			amount: 123,
		});
		expect(createSpy).toHaveBeenCalledWith("owner-1", "work-1", actualCost, {
			userId: "owner-1",
		});
		expect(createActualCost).not.toHaveBeenCalled();
	});

	it("lists actual costs through the entries service boundary", async () => {
		const { constructionManualEntryService } = await import(
			"../../../../src/modules/construction-planning/entries/manual-entry-service"
		);
		const listSpy = spyOn(
			constructionManualEntryService,
			"listActualCosts",
		).mockResolvedValueOnce([
			{ id: "cost-1", workId: "work-1", amount: 123 },
		] as never);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works/work-1/actual-costs"),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual([
			{ id: "cost-1", workId: "work-1", amount: 123 },
		]);
		expect(listSpy).toHaveBeenCalledWith("owner-1", "work-1", {
			limit: 10,
			page: 1,
		});
		expect(listActualCosts).not.toHaveBeenCalled();
	});

	it("deletes actual costs through the entries service boundary", async () => {
		const { constructionManualEntryService } = await import(
			"../../../../src/modules/construction-planning/entries/manual-entry-service"
		);
		const deleteSpy = spyOn(
			constructionManualEntryService,
			"deleteActualCost",
		).mockResolvedValueOnce({
			id: "cost-1",
			workId: "work-1",
		} as never);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/actual-costs/cost-1",
				{
					method: "DELETE",
				},
			),
		);

		expect(response.status).toBe(204);
		expect(deleteSpy).toHaveBeenCalledWith("owner-1", "work-1", "cost-1");
		expect(deleteActualCost).not.toHaveBeenCalled();
	});

	it("returns expanded works summaries at the preserved path", async () => {
		const worksResponse = {
			data: [
				{
					id: "work-1",
					code: "OBRA-001",
					name: "Obra Unificada",
					clientName: "Cliente A",
					plannedStart: "2026-01-01T00:00:00.000Z",
					plannedEnd: "2026-01-31T00:00:00.000Z",
					baseDate: "2026-01-15T00:00:00.000Z",
					totalBudget: 550,
					activeBudget: 550,
					plannedValue: 266.1290322580645,
					earnedValue: 275,
					actualCost: 200,
					measuredPercentage: 0.5,
					plannedPercentage: 15 / 31,
					schedulePerformanceIndex: 1.0333333333333334,
					costPerformanceIndex: 1.375,
					currentBudgetBalance: 350,
					projectedBudgetBalance: 350,
					balance: 350,
					organizationId: "org-1",
					organizationName: "Org 1",
					costCenterName: "CC 1",
					dataCompleteness: { hasActualCosts: true },
					computedStatus: "IN_PROGRESS",
					lastImportAt: "2026-01-02T00:00:00.000Z",
				},
			],
			currentPage: 1,
			nextPage: null,
			previousPage: null,
			pageCount: 1,
			totalCount: 1,
			isLastPage: true,
			isFirstPage: true,
		} as never;
		listWorks.mockResolvedValueOnce(worksResponse);
		const { constructionPlanningController } = await import(
			"../../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works"),
		);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.data[0]).toEqual(
			expect.objectContaining({
				clientName: "Cliente A",
				activeBudget: 550,
				plannedValue: 266.1290322580645,
				earnedValue: 275,
				actualCost: 200,
				schedulePerformanceIndex: 1.0333333333333334,
				costPerformanceIndex: 1.375,
				currentBudgetBalance: 350,
				organizationId: "org-1",
				organizationName: "Org 1",
				costCenterName: "CC 1",
				dataCompleteness: expect.objectContaining({ hasActualCosts: true }),
				baseDate: "2026-01-15T00:00:00.000Z",
				totalBudget: 550,
				balance: 350,
			}),
		);
	});
});
